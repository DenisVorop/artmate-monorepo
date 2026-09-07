import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import {
  AuthProvider as PrismaAuthProvider,
  Prisma,
  UserStatus,
} from "../generated/prisma/client";
import { NotificationQueueService } from "../notifications/notification-queue.service";
import { PrismaService } from "../prisma/prisma.service";

import {
  AUTH_PASSWORD_RESET_DEFAULT_IP_MAX_SENDS_PER_HOUR,
  AUTH_PASSWORD_RESET_DEFAULT_MAX_SENDS_PER_HOUR,
  AUTH_PASSWORD_RESET_DEFAULT_RESEND_COOLDOWN_SECONDS,
  AUTH_PASSWORD_RESET_DEFAULT_TOKEN_TTL_SECONDS,
} from "./auth.constants";
import { CredentialsAuthService } from "./credentials-auth.service";
import {
  createPasswordResetToken,
  createPasswordResetTokenHash,
  createPasswordResetTokenId,
} from "./password-reset-token";

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

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly credentialsAuthService: CredentialsAuthService,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly prisma: PrismaService,
  ) {}

  async requestReset(input: RequestPasswordResetInput) {
    const account = await this.findCredentialAccount(input.email);

    if (!account || account.status !== UserStatus.ACTIVE || !account.email) {
      return { ok: true as const };
    }

    const email = account.email;
    await this.assertCanSendToken(account.userId, input.ipAddress);
    await this.prisma.$transaction(async (tx) => {
      await this.consumeActiveTokens(tx, account.userId);
      await this.createAndQueueToken(
        tx,
        account.userId,
        email,
        input.ipAddress,
      );
    });

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
      await prisma.$queryRaw`SELECT id FROM users WHERE id = ${token.userId} FOR UPDATE`;
      await prisma.$queryRaw`SELECT id FROM auth_password_reset_tokens WHERE id = ${token.id} FOR UPDATE`;

      const lockedToken = await prisma.authPasswordResetToken.findUnique({
        where: { id: token.id },
      });
      const lockedNow = new Date();

      if (
        !lockedToken ||
        lockedToken.id !== token.id ||
        lockedToken.userId !== token.userId ||
        lockedToken.tokenHash !== tokenHash ||
        lockedToken.consumedAt ||
        lockedToken.expiresAt <= lockedNow
      ) {
        throw new BadRequestException(
          "Password reset link is invalid or expired",
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: lockedToken.userId },
        select: { status: true },
      });
      const account = await prisma.authAccount.findFirst({
        where: {
          provider: PrismaAuthProvider.CREDENTIALS,
          userId: lockedToken.userId,
        },
        include: {
          credential: true,
        },
      });

      if (user?.status !== UserStatus.ACTIVE || !account?.credential) {
        throw new BadRequestException(
          "Password reset link is invalid or expired",
        );
      }

      const consumedToken = await prisma.authPasswordResetToken.updateMany({
        where: {
          id: lockedToken.id,
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: lockedNow },
        },
        data: {
          consumedAt: now,
        },
      });

      if (consumedToken.count !== 1) {
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

      await prisma.user.update({
        where: { id: lockedToken.userId },
        data: { authVersion: { increment: 1 } },
      });

      await prisma.authPasswordResetToken.updateMany({
        where: {
          userId: lockedToken.userId,
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

  private async consumeActiveTokens(
    prisma: Prisma.TransactionClient,
    userId: string,
  ) {
    await prisma.authPasswordResetToken.updateMany({
      where: {
        userId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  private async createAndQueueToken(
    prisma: Prisma.TransactionClient,
    userId: string,
    email: string,
    ipAddress?: string,
  ) {
    const tokenId = createPasswordResetTokenId();
    const token = createPasswordResetToken(tokenId, this.getSecret());
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.getTokenTtlSeconds() * 1000,
    );

    const storedToken = await prisma.authPasswordResetToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash: this.createTokenHash(token),
        expiresAt,
        ipAddress,
        sentAt: now,
      },
    });

    await this.notificationQueueService.enqueuePasswordReset(
      {
        passwordResetTokenId: storedToken.id,
        recipient: email,
      },
      prisma,
    );
  }

  private createTokenHash(token: string) {
    return createPasswordResetTokenHash(token, this.getSecret());
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
