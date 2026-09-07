import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import {
  createOrderActivationToken,
  createOrderActivationTokenHash,
} from "../auth/order-activation-token";
import {
  createPasswordResetToken,
  createPasswordResetTokenHash,
} from "../auth/password-reset-token";
import {
  AuthProvider as PrismaAuthProvider,
  NotificationJobChannel,
  NotificationJobStatus,
  Prisma,
  UserStatus,
  type NotificationJob,
} from "../generated/prisma/client";
import { MailerService, type SendMailInput } from "../mailer/mailer.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  getTelegramBotMethodUrl,
  getTelegramRequestHeaders,
} from "../telegram/telegram-api";

type EmailNotificationInput = SendMailInput;

type NotificationJobWriter = Pick<PrismaService, "notificationJob">;

type OrderActivationNotificationInput = {
  readonly activationTokenId: string;
  readonly email: string;
};

type PasswordResetNotificationInput = {
  readonly passwordResetTokenId: string;
  readonly recipient: string;
};

type TelegramBotKind = "orders" | "mini_app";

type TelegramNotificationInput = {
  readonly bot: TelegramBotKind;
  readonly chatId: string;
  readonly text: string;
  readonly disableWebPagePreview?: boolean;
  readonly parseMode?: "HTML";
  readonly replyMarkup?: Prisma.InputJsonValue;
};

type TelegramSendMessageResponse = {
  readonly ok?: boolean;
  readonly description?: string;
  readonly error_code?: number;
};

const notificationBatchSize = 10;
const notificationMaxAttempts = 5;
const notificationPollIntervalMs = 5000;
const notificationLockTimeoutMs = 1000 * 60 * 5;
const telegramRequestTimeoutMs = 10000;

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private isProcessing = false;
  private processingScheduled = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly mailerService: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processDueJobs();
    }, notificationPollIntervalMs);
    this.scheduleProcessing();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async enqueueEmail(
    input: EmailNotificationInput,
    writer: NotificationJobWriter = this.prisma,
  ) {
    const job = await writer.notificationJob.create({
      data: {
        channel: NotificationJobChannel.EMAIL,
        maxAttempts: notificationMaxAttempts,
        payload: this.toJsonPayload(input),
      },
    });

    this.scheduleProcessing();

    return job;
  }

  async enqueueOrderActivation(
    input: OrderActivationNotificationInput,
    writer: NotificationJobWriter = this.prisma,
  ) {
    const job = await writer.notificationJob.create({
      data: {
        channel: NotificationJobChannel.EMAIL,
        maxAttempts: notificationMaxAttempts,
        payload: this.toJsonPayload({ kind: "order_activation", ...input }),
      },
    });

    this.scheduleProcessing();
    return job;
  }

  async enqueuePasswordReset(
    input: PasswordResetNotificationInput,
    writer: NotificationJobWriter = this.prisma,
  ) {
    const job = await writer.notificationJob.create({
      data: {
        channel: NotificationJobChannel.EMAIL,
        maxAttempts: notificationMaxAttempts,
        payload: this.toJsonPayload({ kind: "password_reset", ...input }),
      },
    });

    this.scheduleProcessing();
    return job;
  }

  async enqueueTelegram(input: TelegramNotificationInput) {
    const job = await this.prisma.notificationJob.create({
      data: {
        channel: NotificationJobChannel.TELEGRAM,
        maxAttempts: notificationMaxAttempts,
        payload: this.toJsonPayload(input),
      },
    });

    this.scheduleProcessing();

    return job;
  }

  async processDueJobs() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.releaseStaleJobs();

      const jobs = await this.claimDueJobs();

      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (error) {
      this.logger.warn(
        `Notification queue processing failed: ${this.getErrorMessage(error)}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private scheduleProcessing() {
    if (this.processingScheduled) {
      return;
    }

    this.processingScheduled = true;

    setImmediate(() => {
      this.processingScheduled = false;
      void this.processDueJobs();
    });
  }

  private async releaseStaleJobs() {
    const staleLockedAt = new Date(Date.now() - notificationLockTimeoutMs);

    await this.prisma.notificationJob.updateMany({
      where: {
        status: NotificationJobStatus.PROCESSING,
        lockedAt: {
          lte: staleLockedAt,
        },
      },
      data: {
        lockedAt: null,
        nextAttemptAt: new Date(),
        status: NotificationJobStatus.PENDING,
      },
    });
  }

  private async claimDueJobs() {
    const now = new Date();
    const dueJobs = await this.prisma.notificationJob.findMany({
      where: {
        status: NotificationJobStatus.PENDING,
        nextAttemptAt: {
          lte: now,
        },
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: notificationBatchSize,
    });
    const claimedJobs: NotificationJob[] = [];

    for (const job of dueJobs) {
      const claim = await this.prisma.notificationJob.updateMany({
        where: {
          id: job.id,
          status: NotificationJobStatus.PENDING,
        },
        data: {
          lockedAt: now,
          status: NotificationJobStatus.PROCESSING,
        },
      });

      if (claim.count > 0) {
        claimedJobs.push(job);
      }
    }

    return claimedJobs;
  }

  private async processJob(job: NotificationJob) {
    try {
      await this.dispatchJob(job);
      await this.markJobSent(job);
    } catch (error) {
      await this.markJobFailed(job, error);
    }
  }

  private async dispatchJob(job: NotificationJob) {
    switch (job.channel) {
      case NotificationJobChannel.EMAIL:
        await this.dispatchEmail(job.payload);
        return;
      case NotificationJobChannel.TELEGRAM:
        await this.sendTelegram(this.parseTelegramPayload(job.payload));
        return;
    }
  }

  private async dispatchEmail(payload: Prisma.JsonValue) {
    const object = this.parseObject(payload, "email payload");
    if (object.kind === "order_activation") {
      const activationTokenId = this.parseRequiredString(
        object.activationTokenId,
        "email payload.activationTokenId",
      );
      const secret = this.getRequiredEnv("AUTH_JWT_SECRET");
      const token = createOrderActivationToken(activationTokenId, secret);
      const tokenHash = createOrderActivationTokenHash(token, secret);
      const activationToken =
        await this.prisma.authOrderActivationToken.findUnique({
          where: { id: activationTokenId },
          select: {
            consumedAt: true,
            expiresAt: true,
            tokenHash: true,
            userId: true,
          },
        });
      if (
        !activationToken ||
        activationToken.tokenHash !== tokenHash ||
        activationToken.consumedAt ||
        activationToken.expiresAt <= new Date()
      ) {
        return;
      }

      const eligibleActivationTokenId = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${activationToken.userId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM auth_order_activation_tokens WHERE id = ${activationTokenId} FOR UPDATE`;

          const lockedToken = await tx.authOrderActivationToken.findUnique({
            where: { id: activationTokenId },
            select: {
              consumedAt: true,
              expiresAt: true,
              id: true,
              tokenHash: true,
              userId: true,
            },
          });
          const now = new Date();
          if (
            !lockedToken ||
            lockedToken.userId !== activationToken.userId ||
            lockedToken.tokenHash !== tokenHash ||
            lockedToken.consumedAt ||
            lockedToken.expiresAt <= now
          ) {
            return undefined;
          }

          const user = await tx.user.findUnique({
            where: { id: lockedToken.userId },
            select: { status: true },
          });
          if (!user || user.status !== UserStatus.ACTIVE) return undefined;

          const credentialsAccount = await tx.authAccount.findFirst({
            where: {
              provider: PrismaAuthProvider.CREDENTIALS,
              userId: lockedToken.userId,
            },
            include: { credential: true },
          });
          const oauthAccount = await tx.authAccount.findFirst({
            where: {
              provider: { not: PrismaAuthProvider.CREDENTIALS },
              userId: lockedToken.userId,
            },
          });
          if (
            !credentialsAccount ||
            credentialsAccount.credential ||
            oauthAccount
          ) {
            return undefined;
          }

          return activationTokenId;
        },
      );
      if (!eligibleActivationTokenId) return;

      const url = new URL(
        `${process.env.SITE_URL?.trim() || "http://localhost:3000"}/auth/activate-order`,
      );
      url.searchParams.set("token", token);
      await this.mailerService.sendMail(
        this.mailerService.createOrderActivationEmail(
          this.parseRequiredString(object.email, "email payload.email"),
          url.toString(),
        ),
      );
      return;
    }

    if (object.kind === "password_reset") {
      const passwordResetTokenId = this.parseRequiredString(
        object.passwordResetTokenId,
        "email payload.passwordResetTokenId",
      );
      const secret = this.getRequiredEnv("AUTH_PASSWORD_RESET_SECRET");
      const rawToken = createPasswordResetToken(
        passwordResetTokenId,
        secret,
      );
      const tokenHash = createPasswordResetTokenHash(rawToken, secret);
      const token = await this.prisma.authPasswordResetToken.findUnique({
        where: { id: passwordResetTokenId },
        select: {
          consumedAt: true,
          expiresAt: true,
          sentAt: true,
          tokenHash: true,
          userId: true,
        },
      });
      if (
        !token ||
        token.tokenHash !== tokenHash ||
        token.consumedAt ||
        token.expiresAt <= new Date()
      ) {
        return;
      }

      const eligibleToken = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${token.userId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM auth_password_reset_tokens WHERE id = ${passwordResetTokenId} FOR UPDATE`;

        const lockedToken = await tx.authPasswordResetToken.findUnique({
          where: { id: passwordResetTokenId },
          select: {
            consumedAt: true,
            expiresAt: true,
            sentAt: true,
            tokenHash: true,
            userId: true,
          },
        });
        const now = new Date();
        if (
          !lockedToken ||
          lockedToken.userId !== token.userId ||
          lockedToken.tokenHash !== tokenHash ||
          lockedToken.consumedAt ||
          lockedToken.expiresAt <= now
        ) {
          return undefined;
        }

        const user = await tx.user.findUnique({
          where: { id: lockedToken.userId },
          select: { status: true },
        });
        if (!user || user.status !== UserStatus.ACTIVE) return undefined;

        const account = await tx.authAccount.findFirst({
          where: {
            provider: PrismaAuthProvider.CREDENTIALS,
            userId: lockedToken.userId,
          },
          include: { credential: true },
        });
        if (!account?.credential) return undefined;

        return lockedToken;
      });
      if (!eligibleToken) return;

      const resetUrl = new URL(
        process.env.AUTH_PASSWORD_RESET_URL?.trim() ||
          `${process.env.SITE_URL?.trim() || "http://localhost:3000"}/auth/reset-password`,
      );
      resetUrl.searchParams.set("token", rawToken);
      const ttlMinutes = Math.max(
        1,
        Math.floor(
          (eligibleToken.expiresAt.getTime() - eligibleToken.sentAt.getTime()) /
            60_000,
        ),
      );
      await this.mailerService.sendMail(
        this.mailerService.createPasswordResetEmail(
          this.parseRequiredString(
            object.recipient,
            "email payload.recipient",
          ),
          resetUrl.toString(),
          ttlMinutes,
        ),
      );
      return;
    }

    await this.mailerService.sendMail(this.parseEmailPayload(payload));
  }

  private async markJobSent(job: NotificationJob) {
    await this.prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        attempts: {
          increment: 1,
        },
        failedAt: null,
        lastError: null,
        lockedAt: null,
        sentAt: new Date(),
        status: NotificationJobStatus.SENT,
      },
    });
  }

  private async markJobFailed(job: NotificationJob, error: unknown) {
    const attempts = job.attempts + 1;
    const isFinalAttempt = attempts >= job.maxAttempts;
    const errorMessage = job.channel === NotificationJobChannel.EMAIL
      ? "Email notification delivery failed"
      : this.getErrorMessage(error);

    await this.prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        attempts,
        failedAt: isFinalAttempt ? new Date() : null,
        lastError: this.truncateError(errorMessage),
        lockedAt: null,
        nextAttemptAt: isFinalAttempt
          ? job.nextAttemptAt
          : new Date(Date.now() + this.getRetryDelayMs(attempts)),
        status: isFinalAttempt
          ? NotificationJobStatus.FAILED
          : NotificationJobStatus.PENDING,
      },
    });

    this.logger.warn(
      `Notification job ${job.id} failed on attempt ${attempts}/${job.maxAttempts}: ${errorMessage}`,
    );
  }

  private async sendTelegram(input: TelegramNotificationInput) {
    const botToken = this.getTelegramBotToken(input.bot);
    const response = await fetch(
      getTelegramBotMethodUrl(botToken, "sendMessage"),
      {
        method: "POST",
        headers: getTelegramRequestHeaders(botToken),
        body: JSON.stringify({
          chat_id: input.chatId,
          disable_web_page_preview: input.disableWebPagePreview ?? true,
          parse_mode: input.parseMode ?? "HTML",
          ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
          text: input.text,
        }),
        signal: AbortSignal.timeout(telegramRequestTimeoutMs),
      },
    );
    const responseBody = (await this.parseTelegramResponseBody(
      response,
    )) as TelegramSendMessageResponse;

    if (!response.ok || responseBody.ok === false) {
      throw new Error(
        `Telegram sendMessage failed: status=${response.status}, errorCode=${
          responseBody.error_code ?? "unknown"
        }, description=${responseBody.description ?? "unknown"}`,
      );
    }
  }

  private parseEmailPayload(value: Prisma.JsonValue): EmailNotificationInput {
    const payload = this.parseObject(value, "email payload");

    return {
      to: this.parseRequiredString(payload.to, "email payload.to"),
      subject: this.parseRequiredString(
        payload.subject,
        "email payload.subject",
      ),
      text: this.parseRequiredString(payload.text, "email payload.text"),
      html: this.parseOptionalString(payload.html),
    };
  }

  private parseTelegramPayload(
    value: Prisma.JsonValue,
  ): TelegramNotificationInput {
    const payload = this.parseObject(value, "telegram payload");
    const bot = this.parseRequiredString(payload.bot, "telegram payload.bot");

    if (bot !== "orders" && bot !== "mini_app") {
      throw new Error("telegram payload.bot is invalid");
    }

    const replyMarkup =
      payload.replyMarkup === undefined || payload.replyMarkup === null
        ? undefined
        : this.toJsonPayload(payload.replyMarkup);

    return {
      bot,
      chatId: this.parseRequiredString(
        payload.chatId,
        "telegram payload.chatId",
      ),
      text: this.parseRequiredString(payload.text, "telegram payload.text"),
      disableWebPagePreview: this.parseOptionalBoolean(
        payload.disableWebPagePreview,
      ),
      parseMode:
        this.parseOptionalString(payload.parseMode) === "HTML"
          ? "HTML"
          : undefined,
      replyMarkup,
    };
  }

  private parseObject(
    value: Prisma.JsonValue,
    field: string,
  ): Record<string, Prisma.JsonValue> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${field} must be an object`);
    }

    return value as Record<string, Prisma.JsonValue>;
  }

  private parseRequiredString(
    value: Prisma.JsonValue | undefined,
    field: string,
  ) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${field} must be a non-empty string`);
    }

    return value.trim();
  }

  private parseOptionalString(value: Prisma.JsonValue | undefined) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private parseOptionalBoolean(value: Prisma.JsonValue | undefined) {
    return typeof value === "boolean" ? value : undefined;
  }

  private toJsonPayload(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private async parseTelegramResponseBody(response: Response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  private getTelegramBotToken(bot: TelegramBotKind) {
    switch (bot) {
      case "orders":
        return this.getRequiredEnv("TELEGRAM_BOT_TOKEN");
      case "mini_app":
        return this.getRequiredEnv("TELEGRAM_MINI_APP_BOT_TOKEN");
    }
  }

  private getRequiredEnv(name: string) {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new Error(`${name} is not configured`);
    }

    return value;
  }

  private getRetryDelayMs(attempts: number) {
    return Math.min(1000 * 60 * 10, 1000 * 30 * 2 ** (attempts - 1));
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private truncateError(message: string) {
    return message.length > 2000 ? message.slice(0, 2000) : message;
  }
}
