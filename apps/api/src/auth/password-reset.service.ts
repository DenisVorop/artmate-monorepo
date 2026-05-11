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
  renderEmailButton,
  renderEmailNotice,
  renderEmailParagraph,
  renderSupportEmailFooter,
  renderSupportEmailFooterText,
} from "../mailer/branded-email";
import { MailerService } from "../mailer/mailer.service";
import { PrismaService } from "../prisma/prisma.service";

import {
  AUTH_PASSWORD_RESET_DEFAULT_IP_MAX_SENDS_PER_HOUR,
  AUTH_PASSWORD_RESET_DEFAULT_MAX_SENDS_PER_HOUR,
  AUTH_PASSWORD_RESET_DEFAULT_RESEND_COOLDOWN_SECONDS,
  AUTH_PASSWORD_RESET_DEFAULT_TOKEN_TTL_SECONDS,
} from "./auth.constants";
import { CredentialsAuthService } from "./credentials-auth.service";

type RequestPasswordResetInput = {
  readonly email: string;
  readonly ipAddress?: string;
};

type ConfirmPasswordResetInput = {
  readonly password: string;
  readonly token: string;
};

type StoredCredentialAccount = {
  readonly email: string | null;
  readonly status: UserStatus;
  readonly userId: string;
};

const tokenPurpose = "password-reset";

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly credentialsAuthService: CredentialsAuthService,
    private readonly mailerService: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  async requestReset(input: RequestPasswordResetInput) {
    const account = await this.findCredentialAccount(input.email);

    if (!account || account.status !== UserStatus.ACTIVE || !account.email) {
      return { ok: true as const };
    }

    await this.assertCanSendToken(account.userId, input.ipAddress);
    await this.consumeActiveTokens(account.userId);
    await this.createAndSendToken(
      account.userId,
      account.email,
      input.ipAddress,
    );

    return { ok: true as const };
  }

  async confirmReset(input: ConfirmPasswordResetInput) {
    const tokenHash = this.createTokenHash(input.token);
    const token = await this.prisma.authPasswordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !token ||
      token.consumedAt ||
      token.expiresAt <= new Date() ||
      token.user.status !== UserStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Password reset link is invalid or expired",
      );
    }

    const passwordHash = await this.credentialsAuthService.createPasswordHash(
      input.password,
    );
    const now = new Date();

    await this.prisma.$transaction(async (prisma) => {
      const account = await prisma.authAccount.findFirst({
        where: {
          provider: PrismaAuthProvider.CREDENTIALS,
          userId: token.userId,
        },
        include: {
          credential: true,
        },
      });

      if (!account?.credential) {
        throw new BadRequestException(
          "Password reset link is invalid or expired",
        );
      }

      await prisma.authCredential.update({
        where: { id: account.credential.id },
        data: {
          passwordHash,
          passwordUpdatedAt: now,
        },
      });

      await prisma.authPasswordResetToken.updateMany({
        where: {
          userId: token.userId,
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      });
    });

    return { ok: true as const };
  }

  private async findCredentialAccount(
    email: string,
  ): Promise<StoredCredentialAccount | undefined> {
    const account = await this.prisma.authAccount.findFirst({
      where: {
        provider: PrismaAuthProvider.CREDENTIALS,
        user: {
          email: this.normalizeEmail(email),
        },
      },
      include: {
        credential: true,
        user: true,
      },
    });

    if (!account?.credential) {
      return undefined;
    }

    return {
      email: account.user.email,
      status: account.user.status,
      userId: account.user.id,
    };
  }

  private async assertCanSendToken(userId: string, ipAddress?: string) {
    const latestToken = await this.prisma.authPasswordResetToken.findFirst({
      where: { userId },
      orderBy: { sentAt: "desc" },
    });
    const now = Date.now();
    const resendCooldownMs = this.getResendCooldownSeconds() * 1000;

    if (latestToken && latestToken.sentAt.getTime() + resendCooldownMs > now) {
      throw this.createRateLimitException(
        "Password reset email resend is temporarily unavailable",
        Math.ceil(
          (latestToken.sentAt.getTime() + resendCooldownMs - now) / 1000,
        ),
      );
    }

    const sentSince = new Date(now - 1000 * 60 * 60);
    const sentCount = await this.prisma.authPasswordResetToken.count({
      where: {
        userId,
        sentAt: {
          gte: sentSince,
        },
      },
    });

    if (sentCount >= this.getMaxSendsPerHour()) {
      throw this.createRateLimitException(
        "Password reset email hourly limit exceeded",
        60 * 60,
      );
    }

    if (!ipAddress) {
      return;
    }

    const ipSentCount = await this.prisma.authPasswordResetToken.count({
      where: {
        ipAddress,
        sentAt: {
          gte: sentSince,
        },
      },
    });

    if (ipSentCount >= this.getIpMaxSendsPerHour()) {
      throw this.createRateLimitException(
        "Password reset email IP hourly limit exceeded",
        60 * 60,
      );
    }
  }

  private async consumeActiveTokens(userId: string) {
    await this.prisma.authPasswordResetToken.updateMany({
      where: {
        userId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  private async createAndSendToken(
    userId: string,
    email: string,
    ipAddress?: string,
  ) {
    const token = this.createRawToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.getTokenTtlSeconds() * 1000,
    );
    const resetUrl = this.createResetUrl(token);

    await this.prisma.authPasswordResetToken.create({
      data: {
        userId,
        tokenHash: this.createTokenHash(token),
        expiresAt,
        ipAddress,
        sentAt: now,
      },
    });

    await this.mailerService.sendMail({
      to: email,
      subject: "Восстановление пароля Artmate",
      text: this.renderTextEmail(resetUrl),
      html: this.renderHtmlEmail(resetUrl),
    });
  }

  private createRawToken() {
    return crypto.randomBytes(32).toString("base64url");
  }

  private createTokenHash(token: string) {
    return crypto
      .createHmac("sha256", this.getSecret())
      .update(`${tokenPurpose}:${token}`)
      .digest("hex");
  }

  private createResetUrl(token: string) {
    const resetUrl = new URL(
      this.getOptionalEnv("AUTH_PASSWORD_RESET_URL") ??
        `${this.getSiteUrl()}/auth/reset-password`,
    );

    resetUrl.searchParams.set("token", token);

    return resetUrl.toString();
  }

  private renderTextEmail(resetUrl: string) {
    const ttlMinutes = this.getTokenTtlMinutes();

    return [
      "ARTMATE",
      "",
      "Мы получили запрос на смену пароля.",
      "",
      `Ссылка для смены пароля: ${resetUrl}`,
      "",
      `Ссылка действует ${ttlMinutes} минут.`,
      "Если вы не запрашивали смену пароля, просто игнорируйте письмо.",
      "",
      renderSupportEmailFooterText(),
    ].join("\n");
  }

  private renderHtmlEmail(resetUrl: string) {
    const ttlMinutes = this.getTokenTtlMinutes();

    return renderBrandedEmail({
      title: "Смена пароля",
      previewText: "Ссылка для восстановления пароля Artmate.",
      contentHtml: `
        ${renderEmailParagraph("Перейдите по ссылке, чтобы задать новый пароль для аккаунта Artmate.")}
        ${renderEmailButton({ href: resetUrl, label: "Сменить пароль" })}
        ${renderEmailNotice(
          `Ссылка действует <strong style="color:#202530;">${ttlMinutes} минут</strong>. Если вы не запрашивали смену пароля, просто игнорируйте это письмо.`,
        )}
      `,
      footerHtml: renderSupportEmailFooter(),
    });
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

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getSecret() {
    const secret = process.env.AUTH_PASSWORD_RESET_SECRET?.trim();

    if (!secret) {
      throw new InternalServerErrorException(
        "AUTH_PASSWORD_RESET_SECRET is not configured",
      );
    }

    return secret;
  }

  private getSiteUrl() {
    return this.getOptionalEnv("SITE_URL") ?? "http://localhost:3000";
  }

  private getTokenTtlMinutes() {
    return Math.max(1, Math.floor(this.getTokenTtlSeconds() / 60));
  }

  private getTokenTtlSeconds() {
    return this.getPositiveIntegerEnv(
      "AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS",
      AUTH_PASSWORD_RESET_DEFAULT_TOKEN_TTL_SECONDS,
    );
  }

  private getResendCooldownSeconds() {
    return this.getPositiveIntegerEnv(
      "AUTH_PASSWORD_RESET_RESEND_COOLDOWN_SECONDS",
      AUTH_PASSWORD_RESET_DEFAULT_RESEND_COOLDOWN_SECONDS,
    );
  }

  private getMaxSendsPerHour() {
    return this.getPositiveIntegerEnv(
      "AUTH_PASSWORD_RESET_MAX_SENDS_PER_HOUR",
      AUTH_PASSWORD_RESET_DEFAULT_MAX_SENDS_PER_HOUR,
    );
  }

  private getIpMaxSendsPerHour() {
    return this.getPositiveIntegerEnv(
      "AUTH_PASSWORD_RESET_IP_MAX_SENDS_PER_HOUR",
      AUTH_PASSWORD_RESET_DEFAULT_IP_MAX_SENDS_PER_HOUR,
    );
  }

  private getOptionalEnv(name: string) {
    const value = process.env[name]?.trim();

    return value ? value : undefined;
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
