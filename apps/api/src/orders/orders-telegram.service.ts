import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import type { OrderDTO } from "./dto";
import type { OrderStatus } from "./orders.constants";

type TelegramSendMessageResponse = {
  ok?: boolean;
  description?: string;
  error_code?: number;
};

const telegramRequestTimeoutMs = 10000;
const defaultTelegramWebAppUrl = "https://www.art-mate.ru";

const customerOrderStatusLabels: Record<OrderStatus, string> = {
  new: "В обработке",
  in_progress: "В работе",
  waiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  delivering: "Доставляется",
  completed: "Завершен",
  cancelled: "Отменен",
};

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

  async sendOrderStatusChangedToCustomer(input: {
    chatId: string;
    order: OrderDTO;
    previousStatus: OrderStatus;
    nextStatus: OrderStatus;
  }) {
    const response = await this.requestTelegramToCustomer(
      input.chatId,
      this.formatOrderStatusChangedMessage(input),
    );
    const responseBody = (await this.parseTelegramResponseBody(
      response,
    )) as TelegramSendMessageResponse;

    if (!response.ok || responseBody.ok === false) {
      throw new BadGatewayException({
        message: "Telegram order status message request failed",
        status: response.status,
        errorCode: responseBody.error_code,
        description: responseBody.description,
      });
    }
  }

  async sendOrderCreatedToCustomer(input: { chatId: string; order: OrderDTO }) {
    const response = await this.requestTelegramToCustomer(
      input.chatId,
      this.formatCustomerOrderCreatedMessage(input.order),
    );
    const responseBody = (await this.parseTelegramResponseBody(
      response,
    )) as TelegramSendMessageResponse;

    if (!response.ok || responseBody.ok === false) {
      throw new BadGatewayException({
        message: "Telegram customer order message request failed",
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

  private async requestTelegramToCustomer(chatId: string, text: string) {
    try {
      return await fetch(this.getTelegramMiniAppSendMessageUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          disable_web_page_preview: true,
          parse_mode: "HTML",
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
          text,
        }),
        signal: AbortSignal.timeout(telegramRequestTimeoutMs),
      });
    } catch (error) {
      throw new BadGatewayException({
        message: "Telegram order status message request failed",
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
      "<b>Доставка</b>",
      `<b>Служба:</b> ${this.formatText(this.getDeliveryProviderLabel(order.delivery.provider))}`,
      `<b>ПВЗ:</b> ${this.formatText(order.delivery.pickupPoint.address)}`,
      `<b>Стоимость:</b> ${this.formatMoney(order.deliveryPrice)}`,
      "",
      `<b>Статус:</b> ${this.formatText(customerOrderStatusLabels[order.status])}`,
      `<b>Итого:</b> ${this.formatMoney(order.total)}`,
      order.comment ? "" : undefined,
      order.comment ? "<b>Комментарий</b>" : undefined,
      order.comment ? this.formatMessage(order.comment) : undefined,
    ].filter((line): line is string => typeof line === "string");

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private formatOrderStatusChangedMessage(input: {
    order: OrderDTO;
    previousStatus: OrderStatus;
    nextStatus: OrderStatus;
  }) {
    const lines = [
      "<b>Статус заказа изменен</b>",
      "",
      `<b>Заказ:</b> <code>${this.formatText(input.order.id)}</code>`,
      `<b>Было:</b> ${this.formatText(
        customerOrderStatusLabels[input.previousStatus],
      )}`,
      `<b>Стало:</b> ${this.formatText(
        customerOrderStatusLabels[input.nextStatus],
      )}`,
      "",
      this.getStatusHint(input.nextStatus),
    ];

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private formatCustomerOrderCreatedMessage(order: OrderDTO) {
    const lines = [
      "<b>Заказ принят</b>",
      "",
      `<b>Заказ:</b> <code>${this.formatText(order.id)}</code>`,
      `<b>Итого:</b> ${this.formatMoney(order.total)}`,
      `<b>Статус:</b> ${this.formatText(customerOrderStatusLabels[order.status])}`,
      "",
      "Спасибо! Мы получили ваш заказ. Менеджер проверит детали и отправит ссылку на оплату.",
    ];

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private getStatusHint(status: OrderStatus) {
    switch (status) {
      case "new":
      case "in_progress":
        return "Мы обновили информацию по вашему заказу.";
      case "waiting_payment":
        return "Заказ ожидает оплаты. Откройте Artmate, чтобы посмотреть детали.";
      case "paid":
        return "Оплата получена. Мы продолжим работу с заказом.";
      case "delivering":
        return "Заказ передан в доставку.";
      case "completed":
        return "Заказ завершен.";
      case "cancelled":
        return "Заказ отменен. Если это ошибка, свяжитесь с нами.";
    }
  }

  private getDeliveryProviderLabel(provider: OrderDTO["delivery"]["provider"]) {
    return provider === "cdek" ? "СДЭК" : "Ozon";
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

  private getTelegramMiniAppSendMessageUrl() {
    return `https://api.telegram.org/bot${this.getTelegramMiniAppBotToken()}/sendMessage`;
  }

  private getTelegramBotToken() {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token) {
      throw new InternalServerErrorException(
        "TELEGRAM_BOT_TOKEN is not configured",
      );
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

  private getTelegramMiniAppBotToken() {
    const token = process.env.TELEGRAM_MINI_APP_BOT_TOKEN?.trim();

    if (!token) {
      throw new InternalServerErrorException(
        "TELEGRAM_MINI_APP_BOT_TOKEN is not configured",
      );
    }

    return token;
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

  private async parseTelegramResponseBody(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown;
    }

    return { description: await response.text() };
  }
}
