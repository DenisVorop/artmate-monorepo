import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import type { OrderDTO } from "./dto";

type TelegramSendMessageResponse = {
  ok?: boolean;
  description?: string;
  error_code?: number;
};

const telegramRequestTimeoutMs = 10000;

@Injectable()
export class OrdersTelegramService {
  async sendOrderCreated(order: OrderDTO) {
    const response = await this.requestTelegram(this.formatOrderMessage(order));
    const responseBody = (await this.parseTelegramResponseBody(
      response,
    )) as TelegramSendMessageResponse;

    if (!response.ok || responseBody.ok === false) {
      throw new BadGatewayException({
        message: "Telegram order message request failed",
        status: response.status,
        errorCode: responseBody.error_code,
        description: responseBody.description,
      });
    }
  }

  private async requestTelegram(text: string) {
    try {
      return await fetch(this.getTelegramSendMessageUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.getTelegramOrdersChatId(),
          disable_web_page_preview: true,
          parse_mode: "HTML",
          text,
        }),
        signal: AbortSignal.timeout(telegramRequestTimeoutMs),
      });
    } catch (error) {
      throw new BadGatewayException({
        message: "Telegram order message request failed",
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private formatOrderMessage(order: OrderDTO) {
    const lines = [
      "<b>Новый заказ Artmate</b>",
      "",
      `<b>Номер:</b> <code>${this.formatText(order.id)}</code>`,
      `<b>Дата:</b> ${this.formatText(this.formatDate(order.createdAt))}`,
      "",
      "<b>Клиент</b>",
      `<b>Имя:</b> ${this.formatText(order.customer.name)}`,
      `<b>Телефон:</b> <code>${this.formatText(order.customer.phone)}</code>`,
      `<b>Email:</b> <code>${this.formatText(order.customer.email)}</code>`,
      "",
      "<b>Товары</b>",
      ...order.items.map((item, index) =>
        [
          `<b>${index + 1}.</b> ${this.formatText(item.title)}`,
          `${item.quantity} шт. x ${this.formatMoney(item.price)} = ${this.formatMoney(
            item.lineTotal,
          )}`,
        ].join("\n"),
      ),
      "",
      `<b>Итого:</b> ${this.formatMoney(order.total)}`,
      order.comment ? "" : undefined,
      order.comment ? "<b>Комментарий</b>" : undefined,
      order.comment ? this.formatMessage(order.comment) : undefined,
    ].filter((line): line is string => typeof line === "string");

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private formatDate(value: string) {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Moscow",
    }).format(new Date(value));
  }

  private formatMoney(value: number) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatText(value: string) {
    return this.escapeHtml(value.trim().replaceAll(/\s+/g, " "));
  }

  private formatMessage(value: string) {
    return this.escapeHtml(value.trim());
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  private trimTelegramMessage(text: string) {
    const maxTelegramMessageLength = 4096;

    if (text.length <= maxTelegramMessageLength) {
      return text;
    }

    return `${text.slice(0, maxTelegramMessageLength - 20)}\n\n...`;
  }

  private getTelegramSendMessageUrl() {
    return `https://api.telegram.org/bot${this.getTelegramBotToken()}/sendMessage`;
  }

  private getTelegramBotToken() {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token) {
      throw new InternalServerErrorException("TELEGRAM_BOT_TOKEN is not configured");
    }

    return token;
  }

  private getTelegramOrdersChatId() {
    const chatId =
      process.env.TELEGRAM_ORDERS_CHAT_ID?.trim() ||
      process.env.TELEGRAM_CONTACTS_CHAT_ID?.trim();

    if (!chatId) {
      throw new InternalServerErrorException(
        "TELEGRAM_ORDERS_CHAT_ID or TELEGRAM_CONTACTS_CHAT_ID is not configured",
      );
    }

    return chatId;
  }

  private async parseTelegramResponseBody(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown;
    }

    return { description: await response.text() };
  }
}
