import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import {
  getTelegramBotMethodUrl,
  getTelegramRequestHeaders,
} from "../telegram/telegram-api";

import type { CreateContactMessageRequestDTO } from "./dto";

type TelegramSendMessageResponse = {
  ok?: boolean;
  description?: string;
  error_code?: number;
};

@Injectable()
export class ContactsService {
  async createMessage(request: CreateContactMessageRequestDTO) {
    await this.sendTelegramMessage(this.formatTelegramMessage(request));

    return { sent: true };
  }

  private async sendTelegramMessage(text: string) {
    const response = await this.requestTelegram(text);
    const responseBody = (await this.parseTelegramResponseBody(
      response,
    )) as TelegramSendMessageResponse;

    if (!response.ok || responseBody.ok === false) {
      throw new BadGatewayException({
        message: "Telegram contact message request failed",
        status: response.status,
        errorCode: responseBody.error_code,
        description: responseBody.description,
      });
    }
  }

  private async requestTelegram(text: string) {
    try {
      const botToken = this.getTelegramBotToken();

      return await fetch(getTelegramBotMethodUrl(botToken, "sendMessage"), {
        method: "POST",
        headers: getTelegramRequestHeaders(botToken),
        body: JSON.stringify({
          chat_id: this.getTelegramContactsChatId(),
          disable_web_page_preview: true,
          parse_mode: "HTML",
          text,
        }),
      });
    } catch (error) {
      throw new BadGatewayException({
        message: "Telegram contact message request failed",
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private formatTelegramMessage(request: CreateContactMessageRequestDTO) {
    const lines = [
      "<b>Новое сообщение с сайта Artmate</b>",
      "",
      `<b>Имя:</b> ${this.formatText(request.name)}`,
      `<b>Email:</b> <code>${this.formatText(request.email)}</code>`,
      request.topic ? `<b>Тема:</b> ${this.formatText(request.topic)}` : undefined,
      request.order
        ? `<b>Номер заказа:</b> <code>${this.formatText(request.order)}</code>`
        : undefined,
      "<b>Согласие на обработку ПДн:</b> получено",
      "",
      "<b>Сообщение:</b>",
      this.formatMessage(request.message),
    ].filter((line): line is string => typeof line === "string");

    return lines.join("\n");
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

  private getTelegramBotToken() {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token) {
      throw new InternalServerErrorException("TELEGRAM_BOT_TOKEN is not configured");
    }

    return token;
  }

  private getTelegramContactsChatId() {
    const chatId = process.env.TELEGRAM_CONTACTS_CHAT_ID?.trim();

    if (!chatId) {
      throw new InternalServerErrorException("TELEGRAM_CONTACTS_CHAT_ID is not configured");
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
