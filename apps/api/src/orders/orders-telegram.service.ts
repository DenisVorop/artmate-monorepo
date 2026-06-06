import { Injectable, InternalServerErrorException } from "@nestjs/common";

import { NotificationQueueService } from "../notifications/notification-queue.service";

import type { OrderDTO } from "./dto";
import type { OrderStatus } from "./orders.constants";

type CdekShipmentStatusChangedInput = {
  isReadyForPickup: boolean;
  nextStatusCode: string;
  nextStatusName: string;
  order: OrderDTO;
  previousStatusCode?: string;
};

const defaultTelegramWebAppUrl = "https://artmate.ru";

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
  constructor(
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  async sendOrderCreated(order: OrderDTO) {
    await this.enqueueOrderTelegram(this.formatOrderMessage(order));
  }

  async sendOrderPaid(order: OrderDTO) {
    await this.enqueueOrderTelegram(this.formatOrderPaidMessage(order));
  }

  async sendCdekShipmentStatusChanged(input: CdekShipmentStatusChangedInput) {
    await this.enqueueOrderTelegram(
      this.formatCdekShipmentStatusChangedMessage(input),
    );
  }

  async sendOrderStatusChangedToCustomer(input: {
    chatId: string;
    order: OrderDTO;
    previousStatus: OrderStatus;
    nextStatus: OrderStatus;
  }) {
    await this.enqueueCustomerTelegram(
      input.chatId,
      this.formatOrderStatusChangedMessage(input),
    );
  }

  async sendOrderCreatedToCustomer(input: { chatId: string; order: OrderDTO }) {
    const action = this.getCustomerOrderAction(input.order);
    await this.enqueueCustomerTelegram(
      input.chatId,
      this.formatCustomerOrderCreatedMessage(input.order),
      action,
    );
  }

  async sendCdekShipmentStatusChangedToCustomer(
    input: CdekShipmentStatusChangedInput & { chatId: string },
  ) {
    await this.enqueueCustomerTelegram(
      input.chatId,
      this.formatCustomerCdekShipmentStatusChangedMessage(input),
      {
        buttonText: "Открыть Artmate",
        buttonUrl: this.getTelegramWebAppUrl(),
      },
    );
  }

  private async enqueueOrderTelegram(text: string) {
    await this.notificationQueueService.enqueueTelegram({
      bot: "orders",
      chatId: this.getTelegramOrdersChatId(),
      disableWebPagePreview: true,
      parseMode: "HTML",
      text,
    });
  }

  private async enqueueCustomerTelegram(
    chatId: string,
    text: string,
    action?: { buttonText: string; buttonUrl: string },
  ) {
    await this.notificationQueueService.enqueueTelegram({
      bot: "mini_app",
      chatId,
      disableWebPagePreview: true,
      parseMode: "HTML",
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: action?.buttonText ?? "Открыть Artmate",
              web_app: {
                url: action?.buttonUrl ?? this.getTelegramWebAppUrl(),
              },
            },
          ],
        ],
      },
      text,
    });
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
    const cdekTrackNumber =
      input.nextStatus === "paid"
        ? this.getCdekTrackNumber(input.order)
        : undefined;
    const lines = [
      input.nextStatus === "paid"
        ? "<b>Оплата прошла успешно</b>"
        : "<b>Статус заказа изменен</b>",
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
      cdekTrackNumber ? "" : undefined,
      cdekTrackNumber
        ? `<b>Трек-номер СДЭК:</b> <code>${this.formatText(cdekTrackNumber)}</code>`
        : undefined,
    ].filter((line): line is string => typeof line === "string");

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private formatOrderPaidMessage(order: OrderDTO) {
    const cdekTrackNumber = this.getCdekTrackNumber(order);
    const lines = [
      "<b>Заказ оплачен</b>",
      "",
      `<b>Номер:</b> <code>${this.formatText(order.id)}</code>`,
      `<b>Клиент:</b> ${this.formatText(order.customer.name)}`,
      `<b>Телефон:</b> <code>${this.formatText(order.customer.phone)}</code>`,
      `<b>Email:</b> <code>${this.formatText(order.customer.email)}</code>`,
      `<b>Способ оплаты:</b> ${this.formatText(
        this.getPaymentMethodLabel(order.payment.method),
      )}`,
      `<b>Итого:</b> ${this.formatMoney(order.total)}`,
      cdekTrackNumber
        ? `<b>Трек-номер СДЭК:</b> <code>${this.formatText(cdekTrackNumber)}</code>`
        : undefined,
    ].filter((line): line is string => typeof line === "string");

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private formatCdekShipmentStatusChangedMessage(
    input: CdekShipmentStatusChangedInput,
  ) {
    const cdekTrackNumber = this.getCdekTrackNumber(input.order);
    const lines = [
      input.isReadyForPickup
        ? "<b>Заказ ожидает выдачи в ПВЗ</b>"
        : "<b>Статус доставки СДЭК изменен</b>",
      "",
      `<b>Заказ:</b> <code>${this.formatText(input.order.id)}</code>`,
      `<b>Клиент:</b> ${this.formatText(input.order.customer.name)}`,
      `<b>Телефон:</b> <code>${this.formatText(input.order.customer.phone)}</code>`,
      `<b>Email:</b> <code>${this.formatText(input.order.customer.email)}</code>`,
      input.previousStatusCode
        ? `<b>Было:</b> ${this.formatText(
            this.getCdekShipmentStatusLabel(input.previousStatusCode),
          )}`
        : undefined,
      `<b>Стало:</b> ${this.formatText(input.nextStatusName)}`,
      cdekTrackNumber
        ? `<b>Трек-номер СДЭК:</b> <code>${this.formatText(cdekTrackNumber)}</code>`
        : undefined,
      "",
      `<b>ПВЗ:</b> ${this.formatText(input.order.delivery.pickupPoint.address)}`,
      input.isReadyForPickup
        ? "Клиенту отправлено уведомление о возможности забрать заказ."
        : undefined,
    ].filter((line): line is string => typeof line === "string");

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private formatCustomerOrderCreatedMessage(order: OrderDTO) {
    const lines = [
      this.getCustomerOrderCreatedTitle(order),
      "",
      `<b>Заказ:</b> <code>${this.formatText(order.id)}</code>`,
      `<b>Товары:</b> ${this.formatMoney(order.subtotal)}`,
      `<b>Доставка:</b> ${this.formatMoney(order.deliveryPrice)}`,
      `<b>Итого:</b> ${this.formatMoney(order.total)}`,
      `<b>Статус:</b> ${this.formatText(customerOrderStatusLabels[order.status])}`,
      "",
      ...this.getCustomerOrderCreatedHint(order),
    ];

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private formatCustomerCdekShipmentStatusChangedMessage(
    input: CdekShipmentStatusChangedInput,
  ) {
    const cdekTrackNumber = this.getCdekTrackNumber(input.order);
    const lines = [
      input.isReadyForPickup
        ? "<b>Заказ можно забрать</b>"
        : "<b>Статус доставки изменен</b>",
      "",
      `<b>Заказ:</b> <code>${this.formatText(input.order.id)}</code>`,
      `<b>Статус:</b> ${this.formatText(input.nextStatusName)}`,
      cdekTrackNumber
        ? `<b>Трек-номер СДЭК:</b> <code>${this.formatText(cdekTrackNumber)}</code>`
        : undefined,
      "",
      ...this.getCustomerCdekShipmentStatusHint(input),
    ].filter((line): line is string => typeof line === "string");

    return this.trimTelegramMessage(lines.join("\n"));
  }

  private getCustomerOrderCreatedTitle(order: OrderDTO) {
    return this.isOnlineAcquiringOrder(order)
      ? "<b>Заказ ожидает оплаты</b>"
      : "<b>Заказ принят</b>";
  }

  private getCustomerOrderCreatedHint(order: OrderDTO) {
    if (this.isOnlineAcquiringOrder(order)) {
      const paymentUrl = this.createCustomerOrderPaymentUrl(order);

      return [
        "Заказ оформлен, ожидается оплата.",
        `<a href="${this.formatUrl(paymentUrl)}">Перейти к оплате</a>`,
      ];
    }

    return ["Спасибо! Мы получили ваш заказ и скоро передадим его в доставку."];
  }

  private getCustomerOrderAction(order: OrderDTO) {
    if (!this.isOnlineAcquiringOrder(order)) {
      return undefined;
    }

    return {
      buttonText:
        order.payment.status === "paid" ? "Открыть заказ" : "Оплатить заказ",
      buttonUrl: this.createCustomerOrderPaymentUrl(order),
    };
  }

  private createCustomerOrderPaymentUrl(order: OrderDTO) {
    const url = new URL("/checkout/payment", `${this.getTelegramWebAppUrl()}/`);

    url.searchParams.set("orderId", order.id);

    return url.toString();
  }

  private getStatusHint(status: OrderStatus) {
    switch (status) {
      case "new":
      case "in_progress":
        return "Мы обновили информацию по вашему заказу.";
      case "waiting_payment":
        return "Заказ ожидает оплаты. Откройте Artmate, чтобы посмотреть детали.";
      case "paid":
        return "Заказ оплачен. Скоро передадим его в доставку.";
      case "delivering":
        return "Заказ передан в доставку.";
      case "completed":
        return "Заказ завершен.";
      case "cancelled":
        return "Заказ отменен. Если это ошибка, свяжитесь с нами.";
    }
  }

  private getCustomerCdekShipmentStatusHint(
    input: CdekShipmentStatusChangedInput,
  ) {
    if (input.isReadyForPickup) {
      return [
        "Заказ ожидает вас в выбранном ПВЗ.",
        `<b>Адрес:</b> ${this.formatText(input.order.delivery.pickupPoint.address)}`,
        `<b>График:</b> ${this.formatText(input.order.delivery.pickupPoint.workHours)}`,
      ];
    }

    switch (input.nextStatusCode.toUpperCase()) {
      case "DELIVERED":
      case "POSTOMAT_RECEIVED":
        return ["Заказ отмечен как полученный."];
      case "NOT_DELIVERED":
        return [
          "СДЭК отметил заказ как неврученный.",
          "Если нужна помощь, свяжитесь с нами.",
        ];
      case "REMOVED":
        return ["Отправление удалено в СДЭК."];
      case "INVALID":
        return ["СДЭК сообщил о проблеме с отправлением. Мы проверим данные."];
      default:
        return ["Мы сообщим, когда заказ можно будет забрать."];
    }
  }

  private getDeliveryProviderLabel(provider: OrderDTO["delivery"]["provider"]) {
    return provider === "cdek" ? "СДЭК" : "Ozon";
  }

  private getPaymentMethodLabel(method: OrderDTO["payment"]["method"]) {
    switch (method) {
      case "ozon_acquiring":
        return "Ozon Acquiring";
      case "tbank_acquiring":
        return "T-Bank Acquiring";
      case "bank_card_mock":
        return "Банковская карта";
    }
  }

  private isOnlineAcquiringOrder(order: OrderDTO) {
    return (
      order.payment.method === "ozon_acquiring" ||
      order.payment.method === "tbank_acquiring"
    );
  }

  private getCdekTrackNumber(order: OrderDTO) {
    if (order.delivery.provider !== "cdek") {
      return undefined;
    }

    return order.shipments.find((shipment) => shipment.provider === "cdek")
      ?.externalNumber;
  }

  private getCdekShipmentStatusLabel(statusCode: string) {
    switch (statusCode.trim().toUpperCase()) {
      case "ACCEPTED":
        return "Принят";
      case "ACCEPTED_AT_PICK_UP_POINT":
      case "ENTERED_TO_PICK_UP_POINT":
        return "Ожидает в ПВЗ";
      case "ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE":
      case "ACCEPTED_IN_RECIPIENT_CITY":
        return "В городе получателя";
      case "CREATED":
        return "Создан";
      case "DELIVERED":
        return "Получен";
      case "INVALID":
        return "Некорректный заказ";
      case "NOT_DELIVERED":
        return "Не вручен";
      case "POSTOMAT_POSTED":
        return "Ожидает в постамате";
      case "POSTOMAT_RECEIVED":
        return "Получен из постамата";
      case "RECEIVED_AT_SHIPMENT_WAREHOUSE":
        return "Принят на склад отправителя";
      case "REMOVED":
        return "Удален";
      case "TAKEN_BY_COURIER":
        return "У курьера";
      default:
        return statusCode.trim().toUpperCase();
    }
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

  private formatUrl(value: string) {
    return this.escapeHtml(value.trim());
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
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
}
