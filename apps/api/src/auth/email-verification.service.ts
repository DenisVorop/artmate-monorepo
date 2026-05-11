import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import crypto from "node:crypto";

import {
  AuthProvider as PrismaAuthProvider,
  UserStatus,
} from "../generated/prisma/client";
import {
  renderBrandedEmail,
  renderEmailNotice,
  renderEmailParagraph,
  renderSupportEmailFooter,
  renderSupportEmailFooterText,
} from "../mailer/branded-email";
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
      return this.createGenericVerificationState(normalizedEmail);
    }

    return this.createAndSendCode({
      userId: account.user.id,
      email: account.user.email,
      ipAddress,
    });
  }

  createGenericVerificationState(email: string): VerificationState {
    const normalizedEmail = this.normalizeEmail(email);
    const now = Date.now();

    return {
      email: normalizedEmail,
      emailMasked: this.maskEmail(normalizedEmail),
      expiresAt: new Date(now + this.getCodeTtlSeconds() * 1000).toISOString(),
      resendAvailableAt: new Date(
        now + this.getResendCooldownSeconds() * 1000,
      ).toISOString(),
    };
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
      throw new BadRequestException("Invalid verification code");
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException("Invalid verification code");
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
      "",
      renderSupportEmailFooterText(),
    ].join("\n");
  }

  private renderHtmlEmail(code: string) {
    const ttlMinutes = this.getCodeTtlMinutes();
    const codeCells = code
      .split("")
      .map(
        (digit) => `
          <td style="width:42px;height:50px;border:1px solid #f2bfd7;border-radius:12px;background:#fff9fc;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:50px;font-weight:700;color:#202530;">
            ${digit}
          </td>
        `,
      )
      .join('<td style="width:8px;"></td>');

    return renderBrandedEmail({
      title: "Подтверждение почты",
      previewText: `Код подтверждения Artmate: ${code}`,
      contentHtml: `
        ${renderEmailParagraph("Введите этот код на сайте, чтобы завершить регистрацию и войти в аккаунт.")}
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px auto 4px;">
          <tr>${codeCells}</tr>
        </table>
        ${renderEmailNotice(
          `Код действует <strong style="color:#202530;">${ttlMinutes} минут</strong>. Если вы не регистрировались в Artmate, просто игнорируйте это письмо.`,
        )}
      `,
      footerHtml: renderSupportEmailFooter(),
    });
  }

  private getCodeTtlMinutes() {
    return Math.max(1, Math.floor(this.getCodeTtlSeconds() / 60));
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
