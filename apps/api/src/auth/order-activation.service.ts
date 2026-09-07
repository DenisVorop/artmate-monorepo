import crypto from "node:crypto";

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

import {
  AuthProvider as PrismaAuthProvider,
  AuthRecoveryThrottleScope,
  Prisma,
  UserStatus,
} from "../generated/prisma/client";
import { MailerService } from "../mailer/mailer.service";
import { NotificationQueueService } from "../notifications/notification-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

import type { AuthPrincipal } from "./auth.types";
import { CredentialsAuthService } from "./credentials-auth.service";
import {
  createOrderActivationToken,
  createOrderActivationTokenHash,
  createOrderActivationTokenId,
  verifyOrderActivationToken,
} from "./order-activation-token";
import { PasswordResetService } from "./password-reset.service";

const activationTokenTtlSeconds = 60 * 60 * 24;
const activationResendCooldownSeconds = 60;
const activationMaxSendsPerHour = 5;
const activationIpMaxSendsPerHour = 20;
const recoveryThrottleWindowMs = 60 * 60 * 1000;

export type PaidGuestOrder = {
  readonly id: string;
  readonly userId: string | null;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly customerPhone: string | null;
};

type RecoveryInput = {
  readonly email: string;
  readonly ipAddress?: string;
};

type ConfirmActivationInput = {
  readonly password: string;
  readonly token: string;
};

type RecoveryThrottleSubject = {
  readonly hash: string;
  readonly maxRequests: number;
  readonly scope: AuthRecoveryThrottleScope;
};

@Injectable()
export class OrderActivationService {
  private readonly logger = new Logger(OrderActivationService.name);

  constructor(
    private readonly credentialsAuthService: CredentialsAuthService,
    private readonly mailerService: MailerService,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly passwordResetService: PasswordResetService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async attachPaidGuestOrderInTransaction(
    tx: Prisma.TransactionClient,
    order: PaidGuestOrder,
  ): Promise<string | undefined> {
    if (order.userId) return order.userId;

    const email = this.normalizeEmail(order.customerEmail);
    const existingUser = await tx.user.findUnique({ where: { email } });

    if (existingUser) {
      if (existingUser.status !== UserStatus.ACTIVE) return undefined;
      return this.attachPaidOrderToUser(tx, order.id, existingUser.id, email);
    }

    const user = await tx.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        emailVerifiedAt: null,
        name: this.getOptionalString(order.customerName),
        phone: this.getOptionalString(order.customerPhone ?? undefined),
        roles: this.usersService.getDefaultPrismaRoles(),
        status: UserStatus.ACTIVE,
      },
    });

    return this.attachPaidOrderToUser(tx, order.id, user.id, email, true);
  }

  async requestRecovery(input: RecoveryInput) {
    const email = this.normalizeEmail(input.email);
    const blockedUntil = await this.prisma.$transaction(async (tx) => {
      let latestBlock: Date | undefined;

      for (const subject of this.getRecoveryThrottleSubjects(
        email,
        input.ipAddress,
      )) {
        const block = await this.incrementRecoveryThrottle(tx, subject);
        if (block && (!latestBlock || block > latestBlock)) latestBlock = block;
      }

      return latestBlock;
    });
    if (blockedUntil) {
      throw this.rateLimitException(
        Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000)),
      );
    }

    try {
      const shouldRequestPasswordReset = await this.prisma.$transaction(
        async (tx) => {
          const account = await tx.authAccount.findFirst({
            where: {
              provider: PrismaAuthProvider.CREDENTIALS,
              user: { email },
            },
            include: { credential: true, user: true },
          });
          if (!account) return false;

          await tx.$queryRaw`SELECT id FROM users WHERE id = ${account.userId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM auth_accounts WHERE id = ${account.id} FOR UPDATE`;
          const lockedAccount = await tx.authAccount.findFirst({
            where: { id: account.id },
            include: { credential: true, user: true },
          });
          if (
            !lockedAccount ||
            lockedAccount.user.status !== UserStatus.ACTIVE
          ) {
            return false;
          }

          if (lockedAccount.credential) return true;

          await this.createAndQueueToken(
            tx,
            lockedAccount.userId,
            email,
            input.ipAddress,
          );
          return false;
        },
      );

      if (shouldRequestPasswordReset) {
        await this.passwordResetService.requestReset(input);
      }
    } catch {
      this.logger.warn("Account recovery processing failed");
    }

    return { ok: true as const };
  }

  async validateActivation(token: string) {
    const secret = this.getSecret();
    const tokenId = verifyOrderActivationToken(token, secret);
    if (!tokenId) return { valid: false };

    const storedToken = await this.prisma.authOrderActivationToken.findUnique({
      where: { id: tokenId },
    });
    const now = new Date();
    if (
      !storedToken ||
      storedToken.tokenHash !== createOrderActivationTokenHash(token, secret) ||
      storedToken.consumedAt ||
      storedToken.expiresAt <= now
    ) {
      return { valid: false };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });
    if (!user || user.status !== UserStatus.ACTIVE) return { valid: false };

    const credentialsAccount = await this.prisma.authAccount.findFirst({
      where: {
        provider: PrismaAuthProvider.CREDENTIALS,
        userId: storedToken.userId,
      },
      include: { credential: true },
    });
    const oauthAccount = await this.prisma.authAccount.findFirst({
      where: {
        provider: { not: PrismaAuthProvider.CREDENTIALS },
        userId: storedToken.userId,
      },
    });

    return {
      valid: Boolean(
        credentialsAccount && !credentialsAccount.credential && !oauthAccount,
      ),
    };
  }

  async confirmActivation(input: ConfirmActivationInput): Promise<AuthPrincipal> {
    const secret = this.getSecret();
    const tokenId = verifyOrderActivationToken(input.token, secret);
    if (!tokenId) throw this.invalidTokenException();
    const tokenHash = createOrderActivationTokenHash(input.token, secret);
    const initialToken = await this.prisma.authOrderActivationToken.findUnique({
      where: { id: tokenId },
    });
    const initialNow = new Date();
    if (
      !initialToken ||
      initialToken.tokenHash !== tokenHash ||
      initialToken.consumedAt ||
      initialToken.expiresAt <= initialNow
    ) {
      throw this.invalidTokenException();
    }
    const passwordHash = await this.credentialsAuthService.createPasswordHash(
      input.password,
    );
    const activatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${initialToken.userId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM auth_order_activation_tokens WHERE id = ${tokenId} FOR UPDATE`;
      const token = await tx.authOrderActivationToken.findUnique({
        where: { id: tokenId },
      });
      const now = new Date();

      if (
        !token ||
        token.tokenHash !== tokenHash ||
        token.consumedAt ||
        token.expiresAt <= now ||
        token.userId !== initialToken.userId
      ) {
        throw this.invalidTokenException();
      }

      const account = await tx.authAccount.findFirst({
        where: {
          provider: PrismaAuthProvider.CREDENTIALS,
          userId: token.userId,
          user: { status: UserStatus.ACTIVE },
        },
        include: { credential: true },
      });
      const oauthAccount = await tx.authAccount.findFirst({
        where: {
          provider: { not: PrismaAuthProvider.CREDENTIALS },
          userId: token.userId,
        },
      });
      if (!account || account.credential || oauthAccount) {
        throw this.invalidTokenException();
      }

      await tx.authCredential.create({
        data: { accountId: account.id, passwordHash, passwordUpdatedAt: now },
      });
      const activatedUser = await tx.user.update({
        where: { id: token.userId },
        data: {
          authVersion: { increment: 1 },
          emailVerifiedAt: now,
        },
        select: { authVersion: true, id: true },
      });
      await this.consumeActiveTokens(tx, token.userId, now);
      await tx.authPasswordResetToken.updateMany({
        where: { userId: token.userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.authEmailVerificationCode.updateMany({
        where: { userId: token.userId, consumedAt: null },
        data: { consumedAt: now },
      });

      return activatedUser;
    });

    return {
      ...(await this.credentialsAuthService.getCredentialsUserById(
        activatedUser.id,
      )),
      authVersion: activatedUser.authVersion,
    };
  }

  private async attachOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
  ) {
    await tx.order.updateMany({
      where: { id: orderId, userId: null },
      data: { userId },
    });
  }

  private async attachPaidOrderToUser(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
    email: string,
    provisionCredentialsAccount = false,
  ): Promise<string | undefined> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) return undefined;

    let credentialsAccount = await tx.authAccount.findFirst({
      where: { provider: PrismaAuthProvider.CREDENTIALS, userId },
      include: { credential: true },
    });
    const oauthAccount = await tx.authAccount.findFirst({
      where: { provider: { not: PrismaAuthProvider.CREDENTIALS }, userId },
    });

    if (provisionCredentialsAccount && !credentialsAccount && !oauthAccount) {
      credentialsAccount = await tx.authAccount.upsert({
        where: {
          provider_providerUserId: {
            provider: PrismaAuthProvider.CREDENTIALS,
            providerUserId: email,
          },
        },
        update: {},
        create: {
          provider: PrismaAuthProvider.CREDENTIALS,
          providerEmail: email,
          providerUserId: email,
          userId,
        },
        include: { credential: true },
      });
    }

    await this.attachOrder(tx, orderId, userId);
    if (credentialsAccount && !credentialsAccount.credential && !oauthAccount) {
      await this.createAndQueueToken(tx, userId, email);
    } else {
      await this.notificationQueueService.enqueueEmail(
        this.mailerService.createPaidOrderLoginEmail(email),
        tx,
      );
    }
    return userId;
  }

  private async incrementRecoveryThrottle(
    tx: Prisma.TransactionClient,
    subject: RecoveryThrottleSubject,
  ) {
    const now = new Date();
    const key = { scope: subject.scope, subjectHash: subject.hash };
    await tx.authRecoveryThrottle.upsert({
      where: { scope_subjectHash: key },
      create: {
        ...key,
        requestCount: 0,
        windowStartedAt: now,
        lastRequestAt: now,
      },
      update: {},
    });
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "auth_recovery_throttles" WHERE "scope" = ${subject.scope}::"auth_recovery_throttle_scope" AND "subject_hash" = ${subject.hash} FOR UPDATE`,
    );
    const bucket = await tx.authRecoveryThrottle.findUnique({
      where: { scope_subjectHash: key },
    });
    if (!bucket) throw new Error("Recovery throttle bucket not found");
    if (bucket.blockedUntil && bucket.blockedUntil > now) {
      return bucket.blockedUntil;
    }

    const windowExpired =
      bucket.windowStartedAt.getTime() <= now.getTime() - recoveryThrottleWindowMs;
    const requestCount = windowExpired ? 1 : bucket.requestCount + 1;
    const cooldownBlock =
      subject.scope === AuthRecoveryThrottleScope.EMAIL &&
      bucket.requestCount > 0 &&
      bucket.lastRequestAt.getTime() + activationResendCooldownSeconds * 1000 >
        now.getTime()
        ? new Date(
            bucket.lastRequestAt.getTime() +
              activationResendCooldownSeconds * 1000,
          )
        : undefined;
    const hourlyBlock =
      requestCount > subject.maxRequests
        ? new Date(now.getTime() + recoveryThrottleWindowMs)
        : undefined;
    const blockedUntil =
      cooldownBlock && hourlyBlock
        ? cooldownBlock > hourlyBlock
          ? cooldownBlock
          : hourlyBlock
        : cooldownBlock ?? hourlyBlock;

    await tx.authRecoveryThrottle.update({
      where: { id: bucket.id },
      data: {
        requestCount,
        windowStartedAt: windowExpired ? now : bucket.windowStartedAt,
        lastRequestAt: now,
        blockedUntil: blockedUntil ?? null,
      },
    });

    return blockedUntil;
  }

  private getRecoveryThrottleSubjects(
    email: string,
    ipAddress?: string,
  ): RecoveryThrottleSubject[] {
    const subjects: RecoveryThrottleSubject[] = [
      {
        hash: this.createHmac(`recovery-throttle:email:${email}`),
        maxRequests: activationMaxSendsPerHour,
        scope: AuthRecoveryThrottleScope.EMAIL,
      },
    ];
    if (ipAddress) {
      subjects.push({
        hash: this.createHmac(`recovery-throttle:ip:${ipAddress}`),
        maxRequests: activationIpMaxSendsPerHour,
        scope: AuthRecoveryThrottleScope.IP,
      });
    }
    return subjects;
  }

  private async consumeActiveTokens(
    tx: Prisma.TransactionClient,
    userId: string,
    consumedAt = new Date(),
  ) {
    await tx.authOrderActivationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt },
    });
  }

  private async createAndQueueToken(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
    ipAddress?: string,
  ) {
    const now = new Date();
    const secret = this.getSecret();
    const activeToken = await tx.authOrderActivationToken.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
    });
    let activationTokenId: string | undefined;

    if (activeToken) {
      const token = createOrderActivationToken(activeToken.id, secret);
      if (
        activeToken.tokenHash === createOrderActivationTokenHash(token, secret)
      ) {
        activationTokenId = activeToken.id;
      }
    }

    if (!activationTokenId) {
      await this.consumeActiveTokens(tx, userId, now);
      activationTokenId = createOrderActivationTokenId();
      const token = createOrderActivationToken(activationTokenId, secret);
      await tx.authOrderActivationToken.create({
        data: {
          id: activationTokenId,
          userId,
          tokenHash: createOrderActivationTokenHash(token, secret),
          expiresAt: new Date(now.getTime() + activationTokenTtlSeconds * 1000),
          ipHash: ipAddress ? this.createIpHash(ipAddress) : undefined,
          sentAt: now,
        },
      });
    }

    await this.notificationQueueService.enqueueOrderActivation(
      { activationTokenId, email },
      tx,
    );
  }

  private createIpHash(ipAddress: string) {
    return this.createHmac(`order-activation-ip:${ipAddress}`);
  }

  private createHmac(value: string) {
    return crypto.createHmac("sha256", this.getSecret()).update(value).digest("hex");
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getOptionalString(value?: string) {
    const normalized = value?.trim();
    return normalized || undefined;
  }

  private getSecret() {
    const secret = process.env.AUTH_JWT_SECRET?.trim();
    if (!secret) {
      throw new InternalServerErrorException("AUTH_JWT_SECRET is not configured");
    }
    return secret;
  }

  private invalidTokenException() {
    return new BadRequestException("Order activation link is invalid or expired");
  }

  private rateLimitException(retryAfterSeconds: number) {
    return new HttpException(
      { message: "Account recovery is temporarily unavailable", retryAfterSeconds },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
