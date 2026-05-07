import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";

import {
  AuthProvider as PrismaAuthProvider,
  UserStatus,
} from "../generated/prisma/client";
import { MailerService } from "../mailer/mailer.service";
import { PrismaService } from "../prisma/prisma.service";

import {
  AUTH_EMAIL_VERIFICATION_DEFAULT_CODE_TTL_SECONDS,
  AUTH_EMAIL_VERIFICATION_DEFAULT_IP_MAX_SENDS_PER_HOUR,
  AUTH_EMAIL_VERIFICATION_DEFAULT_MAX_ATTEMPTS,
  AUTH_EMAIL_VERIFICATION_DEFAULT_MAX_SENDS_PER_HOUR,
  AUTH_EMAIL_VERIFICATION_DEFAULT_RESEND_COOLDOWN_SECONDS,
} from "./auth.constants";

type VerificationState = {
  email: string;
  emailMasked?: string;
  expiresAt?: string;
  resendAvailableAt: string;
};

type CreateAndSendCodeInput = {
  readonly userId: string;
  readonly email: string;
  readonly ipAddress?: string;
};

const codePurpose = "email-verification";

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  async createAndSendCode(
    input: CreateAndSendCodeInput,
  ): Promise<VerificationState> {
    const email = this.normalizeEmail(input.email);

    await this.assertCanSendCode(input.userId, input.ipAddress);
    await this.consumeActiveCodes(input.userId);

    return this.createCode(input.userId, email, input.ipAddress);
  }

  async resendCode(
    email: string,
    ipAddress?: string,
  ): Promise<VerificationState> {
    const normalizedEmail = this.normalizeEmail(email);
    const account = await this.prisma.authAccount.findFirst({
      where: {
        provider: PrismaAuthProvider.CREDENTIALS,
        user: {
          email: normalizedEmail,
        },
      },
      include: {
        credential: true,
        user: true,
      },
    });

    if (
      !account?.credential ||
      account.user.emailVerifiedAt ||
      !account.user.email
    ) {
      return this.getGenericVerificationState(normalizedEmail);
    }

    return this.createAndSendCode({
      userId: account.user.id,
      email: account.user.email,
      ipAddress,
    });
  }

  async confirmCode(email: string, code: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const account = await this.prisma.authAccount.findFirst({
      where: {
        provider: PrismaAuthProvider.CREDENTIALS,
        user: {
          email: normalizedEmail,
        },
      },
      include: {
        credential: true,
        user: true,
      },
    });

    if (!account?.credential || !account.user.email) {
      throw new BadRequestException("Invalid verification code");
    }

    const user = account.user;

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User account is not active");
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException("Email is already verified");
    }

    const verificationCode =
      await this.prisma.authEmailVerificationCode.findFirst({
        where: {
          userId: user.id,
          consumedAt: null,
        },
        orderBy: {
          sentAt: "desc",
        },
      });

    if (!verificationCode || verificationCode.expiresAt <= new Date()) {
      throw new BadRequestException("Verification code expired");
    }

    if (verificationCode.failedAttempts >= this.getMaxAttempts()) {
      throw new BadRequestException("Verification code attempts exceeded");
    }

    const expectedCodeHash = this.createCodeHash(user.id, code);

    if (!this.safeCompare(expectedCodeHash, verificationCode.codeHash)) {
      const failedAttempts = verificationCode.failedAttempts + 1;
      const shouldConsumeCode = failedAttempts >= this.getMaxAttempts();

      await this.prisma.authEmailVerificationCode.update({
        where: { id: verificationCode.id },
        data: {
          failedAttempts,
          ...(shouldConsumeCode ? { consumedAt: new Date() } : {}),
        },
      });

      throw new BadRequestException(
        shouldConsumeCode
          ? "Verification code attempts exceeded"
          : "Invalid verification code",
      );
    }

    await this.prisma.$transaction([
      this.prisma.authEmailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    return user.id;
  }

  private async assertCanSendCode(userId: string, ipAddress?: string) {
    const latestCode = await this.prisma.authEmailVerificationCode.findFirst({
      where: { userId },
      orderBy: { sentAt: "desc" },
    });
    const now = Date.now();
    const resendCooldownMs = this.getResendCooldownSeconds() * 1000;

    if (latestCode && latestCode.sentAt.getTime() + resendCooldownMs > now) {
      throw this.createRateLimitException(
        "Email verification code resend is temporarily unavailable",
        Math.ceil(
          (latestCode.sentAt.getTime() + resendCooldownMs - now) / 1000,
        ),
      );
    }

    const sentSince = new Date(now - 1000 * 60 * 60);
    const sentCount = await this.prisma.authEmailVerificationCode.count({
      where: {
        userId,
        sentAt: {
          gte: sentSince,
        },
      },
    });

    if (sentCount >= this.getMaxSendsPerHour()) {
      throw this.createRateLimitException(
        "Email verification code hourly limit exceeded",
        60 * 60,
      );
    }

    if (!ipAddress) {
      return;
    }

    const ipSentCount = await this.prisma.authEmailVerificationCode.count({
      where: {
        ipAddress,
        sentAt: {
          gte: sentSince,
        },
      },
    });

    if (ipSentCount >= this.getIpMaxSendsPerHour()) {
      throw this.createRateLimitException(
        "Email verification code IP hourly limit exceeded",
        60 * 60,
      );
    }
  }

  private async consumeActiveCodes(userId: string) {
    await this.prisma.authEmailVerificationCode.updateMany({
      where: {
        userId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  private async createCode(userId: string, email: string, ipAddress?: string) {
    const code = this.createRawCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.getCodeTtlSeconds() * 1000);
    const resendAvailableAt = new Date(
      now.getTime() + this.getResendCooldownSeconds() * 1000,
    );

    await this.prisma.authEmailVerificationCode.create({
      data: {
        userId,
        codeHash: this.createCodeHash(userId, code),
        expiresAt,
        ipAddress,
        sentAt: now,
      },
    });

    await this.mailerService.sendMail({
      to: email,
      subject: "Код подтверждения Artmate",
      text: this.renderTextEmail(code),
      html: this.renderHtmlEmail(code),
    });

    return {
      email,
      emailMasked: this.maskEmail(email),
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
    };
  }

  private createRawCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private createCodeHash(userId: string, code: string) {
    return crypto
      .createHmac("sha256", this.getSecret())
      .update(`${codePurpose}:${userId}:${code}`)
      .digest("hex");
  }

  private safeCompare(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private renderTextEmail(code: string) {
    const ttlMinutes = this.getCodeTtlMinutes();

    return [
      "ARTMATE",
      "",
      `Код подтверждения: ${code}`,
      "",
      `Код действует ${ttlMinutes} минут.`,
      "Если вы не регистрировались в Artmate, просто игнорируйте письмо.",
    ].join("\n");
  }

  private renderHtmlEmail(code: string) {
    const ttlMinutes = this.getCodeTtlMinutes();
    const codeCells = code
      .split("")
      .map(
        (digit) => `
          <td style="width:42px;height:48px;border:1px solid #d8cfc3;border-radius:10px;background:#fffdf8;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:48px;font-weight:700;color:#2f2923;">
            ${digit}
          </td>
        `,
      )
      .join('<td style="width:8px;"></td>');

    return `
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Код подтверждения Artmate</title>
        </head>
        <body style="margin:0;padding:0;background:#f4f1ec;color:#2f2923;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ec;margin:0;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e6ded3;border-radius:18px;overflow:hidden;">
                  <tr>
                    <td style="padding:28px 32px 22px;background:#2f2923;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#d9b46d;">ARTMATE</div>
                      <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;font-weight:700;color:#fffaf0;">Подтверждение почты</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px 32px 12px;font-family:Arial,Helvetica,sans-serif;">
                      <p style="margin:0;color:#5f554b;font-size:16px;line-height:24px;">Введите этот код на сайте, чтобы завершить регистрацию и войти в аккаунт.</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 32px 14px;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>${codeCells}</tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 32px 30px;font-family:Arial,Helvetica,sans-serif;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;background:#faf7f1;">
                        <tr>
                          <td style="padding:16px 18px;color:#6b6055;font-size:14px;line-height:21px;">
                            Код действует ${ttlMinutes} минут. Если вы не регистрировались в Artmate, просто игнорируйте это письмо.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 32px;background:#fbfaf8;border-top:1px solid #eee7dc;font-family:Arial,Helvetica,sans-serif;color:#8b8177;font-size:12px;line-height:18px;">
                      Artmate отправляет это письмо только для подтверждения действия в аккаунте.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private getCodeTtlMinutes() {
    return Math.max(1, Math.floor(this.getCodeTtlSeconds() / 60));
  }

  private getGenericVerificationState(email: string): VerificationState {
    return {
      email,
      resendAvailableAt: new Date().toISOString(),
    };
  }

  private createRateLimitException(message: string, retryAfterSeconds: number) {
    return new HttpException(
      {
        message,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private maskEmail(email: string) {
    const [localPart, domain] = email.split("@");

    if (!localPart || !domain) {
      return email;
    }

    return `${localPart.slice(0, 1)}***@${domain}`;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getSecret() {
    const secret = process.env.AUTH_EMAIL_VERIFICATION_SECRET?.trim();

    if (!secret) {
      throw new InternalServerErrorException(
        "AUTH_EMAIL_VERIFICATION_SECRET is not configured",
      );
    }

    return secret;
  }

  private getCodeTtlSeconds() {
    return this.getPositiveIntegerEnv(
      "AUTH_EMAIL_VERIFICATION_CODE_TTL_SECONDS",
      AUTH_EMAIL_VERIFICATION_DEFAULT_CODE_TTL_SECONDS,
    );
  }

  private getResendCooldownSeconds() {
    return this.getPositiveIntegerEnv(
      "AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS",
      AUTH_EMAIL_VERIFICATION_DEFAULT_RESEND_COOLDOWN_SECONDS,
    );
  }

  private getMaxAttempts() {
    return this.getPositiveIntegerEnv(
      "AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS",
      AUTH_EMAIL_VERIFICATION_DEFAULT_MAX_ATTEMPTS,
    );
  }

  private getMaxSendsPerHour() {
    return this.getPositiveIntegerEnv(
      "AUTH_EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR",
      AUTH_EMAIL_VERIFICATION_DEFAULT_MAX_SENDS_PER_HOUR,
    );
  }

  private getIpMaxSendsPerHour() {
    return this.getPositiveIntegerEnv(
      "AUTH_EMAIL_VERIFICATION_IP_MAX_SENDS_PER_HOUR",
      AUTH_EMAIL_VERIFICATION_DEFAULT_IP_MAX_SENDS_PER_HOUR,
    );
  }

  private getPositiveIntegerEnv(name: string, defaultValue: number) {
    const rawValue = process.env[name]?.trim();

    if (!rawValue) {
      return defaultValue;
    }

    const value = Number(rawValue);

    if (!Number.isInteger(value) || value <= 0) {
      throw new InternalServerErrorException(
        `${name} must be a positive integer`,
      );
    }

    return value;
  }
}
