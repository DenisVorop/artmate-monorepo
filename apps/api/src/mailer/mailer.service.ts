import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

type SendMailInput = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
};

const mailRetryAttempts = 3;
const mailRetryDelayMs = 2000;
const retryableMailErrorCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENETDOWN",
  "ENOTFOUND",
  "EPIPE",
  "ESOCKET",
  "ETIMEDOUT",
]);

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: Transporter;

  async sendMail(input: SendMailInput) {
    if (this.shouldLogOnly()) {
      console.info("[mail:log-only]", {
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      return;
    }

    const mail = {
      from: this.getRequiredEnv("MAIL_FROM"),
      replyTo: this.getOptionalEnv("MAIL_REPLY_TO"),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    };

    for (let attempt = 1; attempt <= mailRetryAttempts; attempt += 1) {
      try {
        const info = await (await this.getTransporter()).sendMail(mail);

        this.logDelivery(input, info);
        return;
      } catch (error) {
        if (
          attempt === mailRetryAttempts ||
          !this.isRetryableMailError(error)
        ) {
          throw error;
        }

        this.logger.warn(
          `Mail send attempt ${attempt} failed with ${this.getMailErrorCode(error)}, retrying`,
        );
        this.transporter = undefined;
        await this.delay(mailRetryDelayMs * attempt);
      }
    }
  }

  private async getTransporter() {
    if (!this.transporter) {
      const smtpHost = this.getRequiredEnv("SMTP_HOST");
      const resolvedHost = await this.resolveSmtpHost(smtpHost);

      this.transporter = nodemailer.createTransport({
        host: resolvedHost,
        port: this.getRequiredIntegerEnv("SMTP_PORT"),
        secure: this.getBooleanEnv("SMTP_SECURE", false),
        ...(resolvedHost !== smtpHost
          ? {
              tls: {
                servername: smtpHost,
              },
            }
          : {}),
        auth: {
          user: this.getRequiredEnv("SMTP_USER"),
          pass: this.getRequiredEnv("SMTP_PASSWORD"),
        },
      });
    }

    return this.transporter;
  }

  private async resolveSmtpHost(host: string) {
    if (isIP(host)) {
      return host;
    }

    const address = await lookup(host, { family: 4 });

    return address.address;
  }

  private shouldLogOnly() {
    return (
      process.env.NODE_ENV !== "production" &&
      process.env.MAIL_LOG_ONLY === "true"
    );
  }

  private logDelivery(input: SendMailInput, info: unknown) {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    this.logger.log({
      accepted: this.getMailInfoField(info, "accepted"),
      message: "Mail accepted by SMTP",
      messageId: this.getMailInfoField(info, "messageId"),
      rejected: this.getMailInfoField(info, "rejected"),
      subject: input.subject,
      to: input.to,
    });
  }

  private isRetryableMailError(error: unknown) {
    if (!error || typeof error !== "object") {
      return false;
    }

    const code = this.getMailErrorCode(error);

    return retryableMailErrorCodes.has(code.toUpperCase());
  }

  private getMailErrorCode(error: unknown) {
    if (!error || typeof error !== "object") {
      return "unknown";
    }

    const code = (error as { code?: unknown }).code;

    return typeof code === "string" && code.trim() ? code.trim() : "unknown";
  }

  private getMailInfoField(info: unknown, field: string) {
    if (!info || typeof info !== "object") {
      return undefined;
    }

    return (info as Record<string, unknown>)[field];
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getBooleanEnv(name: string, defaultValue: boolean) {
    const value = this.getOptionalEnv(name);

    if (!value) {
      return defaultValue;
    }

    return value === "true";
  }

  private getRequiredIntegerEnv(name: string) {
    const value = Number(this.getRequiredEnv(name));

    if (!Number.isInteger(value) || value < 0 || value >= 65536) {
      throw new InternalServerErrorException(`${name} must be a valid port`);
    }

    return value;
  }

  private getOptionalEnv(name: string) {
    const value = process.env[name]?.trim();

    return value ? value : undefined;
  }

  private getRequiredEnv(name: string) {
    const value = this.getOptionalEnv(name);

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }
}
