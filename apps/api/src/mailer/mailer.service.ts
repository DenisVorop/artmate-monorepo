import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

import {
  renderBrandedEmail,
  renderEmailButton,
  renderEmailNotice,
  renderEmailParagraph,
  renderSupportEmailFooter,
  renderSupportEmailFooterText,
} from "./branded-email";

export type SendMailInput = {
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
        subject: input.subject,
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

  createOrderActivationEmail(email: string, activationUrl: string): SendMailInput {
    return {
      to: email,
      subject: "Завершите регистрацию в Artmate",
      text: [
        "ARTMATE",
        "",
        "Оплата подтверждена. Завершите регистрацию, чтобы войти и посмотреть заказ",
        "",
        `Ссылка для завершения регистрации: ${activationUrl}`,
        "",
        "Ссылка одноразовая. Если срок действия истек, запросите восстановление доступа.",
        "",
        renderSupportEmailFooterText(),
      ].join("\n"),
      html: renderBrandedEmail({
        title: "Ваш заказ оплачен",
        previewText: "Завершите регистрацию в Artmate.",
        contentHtml: `
          ${renderEmailParagraph("Оплата подтверждена. Завершите регистрацию, чтобы войти и посмотреть заказ")}
          ${renderEmailButton({ href: activationUrl, label: "Завершить регистрацию" })}
          ${renderEmailNotice("Ссылка одноразовая. Если срок действия истек, запросите восстановление доступа.")}
        `,
        footerHtml: renderSupportEmailFooter(),
      }),
    };
  }

  createPasswordResetEmail(
    email: string,
    resetUrl: string,
    ttlMinutes: number,
  ): SendMailInput {
    return {
      to: email,
      subject: "Восстановление пароля Artmate",
      text: [
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
      ].join("\n"),
      html: renderBrandedEmail({
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
      }),
    };
  }

  createPaidOrderLoginEmail(email: string): SendMailInput {
    const loginUrl = `${this.getSiteUrl()}/auth`;
    const recoveryUrl = `${this.getSiteUrl()}/auth/recovery`;

    return {
      to: email,
      subject: "Оплаченный заказ добавлен в ваш аккаунт Artmate",
      text: [
        "ARTMATE",
        "",
        "Оплаченный заказ добавлен в ваш аккаунт.",
        `Войти: ${loginUrl}`,
        `Восстановить доступ: ${recoveryUrl}`,
        "",
        renderSupportEmailFooterText(),
      ].join("\n"),
      html: renderBrandedEmail({
        title: "Заказ в вашем аккаунте",
        previewText: "Оплаченный заказ добавлен в ваш аккаунт Artmate.",
        contentHtml: `
          ${renderEmailParagraph("Оплаченный заказ добавлен в ваш аккаунт. Войдите с обычными учетными данными или восстановите доступ.")}
          ${renderEmailButton({ href: loginUrl, label: "Войти" })}
          ${renderEmailParagraph(`<a href="${recoveryUrl}">Восстановить доступ</a>`)}
        `,
        footerHtml: renderSupportEmailFooter(),
      }),
    };
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
      message: "Mail accepted by SMTP",
      messageId: this.getMailInfoField(info, "messageId"),
      subject: input.subject,
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

  private getSiteUrl() {
    return this.getOptionalEnv("SITE_URL") ?? "http://localhost:3000";
  }

  private getRequiredEnv(name: string) {
    const value = this.getOptionalEnv(name);

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }
}
