import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import crypto from "node:crypto";

import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  AuthTelegramAccountDTO,
  CreateTelegramLinkCodeRequestDTO,
} from "./dto";

const codePurpose = "telegram-link";
const defaultCodeTtlSeconds = 600;
const defaultMaxAttempts = 5;
const defaultResendCooldownSeconds = 60;
const defaultTelegramWebAppUrl = "https://www.art-mate.ru";
const telegramRequestTimeoutMs = 10000;

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);

  constructor(private readonly prisma: PrismaService) {}

  assertServiceToken(token: string | undefined) {
    const expectedToken = this.getServiceToken();

    if (!token || !this.safeCompare(token, expectedToken)) {
      throw new BadRequestException("Invalid Telegram link service token");
    }
  }

  async createLinkCode(input: CreateTelegramLinkCodeRequestDTO) {
    const telegramUserId = this.normalizeRequiredString(
      input.telegramUserId,
      "telegramUserId",
    );
    const telegramChatId = this.normalizeRequiredString(
      input.telegramChatId,
      "telegramChatId",
    );
    const phone = this.normalizeRequiredString(input.phone, "phone");
    const existingAccount = await this.prisma.telegramAccount.findUnique({
      where: { telegramUserId },
    });

    if (existingAccount) {
      throw new ConflictException("Telegram account is already linked");
    }

    await this.assertCanSendCode(telegramUserId);
    await this.consumeActiveCodes(telegramUserId);

    const code = this.createRawCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.getCodeTtlSeconds() * 1000);

    await this.prisma.authTelegramLinkCode.create({
      data: {
        telegramUserId,
        telegramChatId,
        phone,
        username: this.normalizeOptionalString(input.username),
        firstName: this.normalizeOptionalString(input.firstName),
        lastName: this.normalizeOptionalString(input.lastName),
        codeHash: this.createCodeHash(code),
        expiresAt,
        sentAt: now,
      },
    });

    return {
      code,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getLinkStatus(userId: string) {
    const account = await this.prisma.telegramAccount.findUnique({
      where: { userId },
    });

    return {
      linked: Boolean(account),
      botUrl: this.getBotUrl(),
      ...(account ? { account: this.mapAccount(account) } : {}),
    };
  }

  async confirmLinkCode(userId: string, code: string) {
    const linkCode = await this.prisma.authTelegramLinkCode.findFirst({
      where: {
        codeHash: this.createCodeHash(code),
        consumedAt: null,
      },
      orderBy: {
        sentAt: "desc",
      },
    });

    if (!linkCode) {
      throw new BadRequestException("Invalid Telegram link code");
    }

    if (linkCode.expiresAt <= new Date()) {
      await this.consumeCode(linkCode.id);
      throw new BadRequestException("Telegram link code expired");
    }

    if (linkCode.failedAttempts >= this.getMaxAttempts()) {
      await this.consumeCode(linkCode.id);
      throw new BadRequestException("Telegram link code attempts exceeded");
    }

    const [existingUserAccount, existingTelegramAccount] = await Promise.all([
      this.prisma.telegramAccount.findUnique({
        where: { userId },
      }),
      this.prisma.telegramAccount.findUnique({
        where: { telegramUserId: linkCode.telegramUserId },
      }),
    ]);

    if (existingUserAccount) {
      throw new ConflictException("User already has a linked Telegram account");
    }

    if (existingTelegramAccount) {
      throw new ConflictException("Telegram account is already linked");
    }

    try {
      const account = await this.prisma.$transaction(async (tx) => {
        await tx.authTelegramLinkCode.update({
          where: { id: linkCode.id },
          data: { consumedAt: new Date() },
        });
        await tx.authTelegramLinkCode.updateMany({
          where: {
            telegramUserId: linkCode.telegramUserId,
            consumedAt: null,
          },
          data: { consumedAt: new Date() },
        });
        await tx.user.update({
          where: { id: userId },
          data: { phone: linkCode.phone },
        });

        return tx.telegramAccount.create({
          data: {
            userId,
            telegramUserId: linkCode.telegramUserId,
            telegramChatId: linkCode.telegramChatId,
            phone: linkCode.phone,
            username: linkCode.username,
            firstName: linkCode.firstName,
            lastName: linkCode.lastName,
          },
        });
      });

      await this.sendLinkedMessage(account.telegramChatId).catch(
        (error: unknown) => {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown Telegram notification error";

          this.logger.error(
            `Failed to send Telegram link notification: ${message}`,
          );
        },
      );

      return {
        linked: true as const,
        account: this.mapAccount(account),
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Telegram account is already linked");
      }

      throw error;
    }
  }

  private async assertCanSendCode(telegramUserId: string) {
    const latestCode = await this.prisma.authTelegramLinkCode.findFirst({
      where: { telegramUserId },
      orderBy: { sentAt: "desc" },
    });

    if (!latestCode) {
      return;
    }

    const resendAvailableAt =
      latestCode.sentAt.getTime() + this.getResendCooldownSeconds() * 1000;
    const now = Date.now();

    if (resendAvailableAt > now) {
      throw this.createRateLimitException(
        "Telegram link code resend is temporarily unavailable",
        Math.ceil((resendAvailableAt - now) / 1000),
      );
    }
  }

  private async consumeActiveCodes(telegramUserId: string) {
    await this.prisma.authTelegramLinkCode.updateMany({
      where: {
        telegramUserId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  private async consumeCode(id: string) {
    await this.prisma.authTelegramLinkCode.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  private async sendLinkedMessage(chatId: string) {
    const token = process.env.TELEGRAM_MINI_APP_BOT_TOKEN?.trim();

    if (!token) {
      this.logger.warn(
        "TELEGRAM_MINI_APP_BOT_TOKEN is not configured; skipping Telegram link notification",
      );
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      telegramRequestTimeoutMs,
    );

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          body: JSON.stringify({
            chat_id: chatId,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Открыть Artmate",
                    web_app: {
                      url: this.getTelegramWebAppUrl(),
                    },
                  },
                ],
              ],
            },
            text: "Готово, Telegram подключён к аккаунту Artmate.",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Telegram API request failed: ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapAccount(account: {
    phone: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    linkedAt: Date;
  }): AuthTelegramAccountDTO {
    return {
      phone: account.phone,
      username: account.username ?? undefined,
      firstName: account.firstName ?? undefined,
      lastName: account.lastName ?? undefined,
      linkedAt: account.linkedAt.toISOString(),
    };
  }

  private createRawCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private createCodeHash(code: string) {
    return crypto
      .createHmac("sha256", this.getCodeSecret())
      .update(`${codePurpose}:${code}`)
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

  private normalizeRequiredString(value: string, name: string) {
    const normalizedValue = this.normalizeOptionalString(value);

    if (!normalizedValue) {
      throw new BadRequestException(`${name} is required`);
    }

    return normalizedValue;
  }

  private normalizeOptionalString(value: string | undefined) {
    const normalizedValue = value?.trim();

    return normalizedValue ? normalizedValue : undefined;
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

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private getBotUrl() {
    const rawUrl = process.env.TELEGRAM_MINI_APP_BOT_URL;

    if (!rawUrl) {
      return undefined;
    }

    try {
      const url = new URL(rawUrl);
      url.searchParams.set("start", "link");

      return url.toString();
    } catch {
      return undefined;
    }
  }

  private getTelegramWebAppUrl() {
    const rawUrl =
      process.env.TELEGRAM_WEB_APP_URL?.trim() ??
      process.env.SITE_URL?.trim() ??
      defaultTelegramWebAppUrl;

    try {
      return new URL(rawUrl).toString();
    } catch {
      return defaultTelegramWebAppUrl;
    }
  }

  private getServiceToken() {
    const token = process.env.TELEGRAM_LINK_SERVICE_TOKEN?.trim();

    if (!token) {
      throw new InternalServerErrorException(
        "TELEGRAM_LINK_SERVICE_TOKEN is not configured",
      );
    }

    return token;
  }

  private getCodeSecret() {
    const secret =
      process.env.AUTH_TELEGRAM_LINK_CODE_SECRET?.trim() ??
      process.env.AUTH_EMAIL_VERIFICATION_SECRET?.trim();

    if (!secret) {
      throw new InternalServerErrorException(
        "AUTH_TELEGRAM_LINK_CODE_SECRET or AUTH_EMAIL_VERIFICATION_SECRET is not configured",
      );
    }

    return secret;
  }

  private getCodeTtlSeconds() {
    return this.getPositiveIntegerEnv(
      "AUTH_TELEGRAM_LINK_CODE_TTL_SECONDS",
      defaultCodeTtlSeconds,
    );
  }

  private getMaxAttempts() {
    return this.getPositiveIntegerEnv(
      "AUTH_TELEGRAM_LINK_CODE_MAX_ATTEMPTS",
      defaultMaxAttempts,
    );
  }

  private getResendCooldownSeconds() {
    return this.getPositiveIntegerEnv(
      "AUTH_TELEGRAM_LINK_CODE_RESEND_COOLDOWN_SECONDS",
      defaultResendCooldownSeconds,
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
