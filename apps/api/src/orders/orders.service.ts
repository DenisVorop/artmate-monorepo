import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import { CartService } from "../cart/cart.service";
import { CartStorage } from "../cart/cart.storage";
import { DeliveryService } from "../delivery/delivery.service";
import type { DeliverySelection } from "../delivery/providers/delivery-provider.interface";
import {
  escapeEmailHtml,
  renderBrandedEmail,
  renderEmailButton,
  renderEmailDetails,
  renderEmailParagraph,
  renderSupportEmailFooter,
  renderSupportEmailFooterText,
} from "../mailer/branded-email";
import { MailerService } from "../mailer/mailer.service";
import { OzonAcquiringService } from "../ozon/ozon-acquiring.service";
import { OzonLogisticsService } from "../ozon/ozon-logistics.service";

import { ORDER_COMMENT_MAX_LENGTH } from "./orders.constants";
import {
  ORDER_ADMIN_COMMENT_MAX_LENGTH,
  orderStatuses,
  type OrderStatus,
} from "./orders.constants";
import type {
  CalculateCheckoutRequestDTO,
  CheckoutCalculationDTO,
  CreateOrderRequestDTO,
  AdminOrderDTO,
  OrderDTO,
  OrderShipmentDTO,
  OrderStateDTO,
  PickupPointDTO,
} from "./dto";
import { OrdersTelegramService } from "./orders-telegram.service";
import { OrdersStorage } from "./orders.storage";

const MAX_COMMENT_LENGTH = ORDER_COMMENT_MAX_LENGTH;
const MAX_ADMIN_COMMENT_LENGTH = ORDER_ADMIN_COMMENT_MAX_LENGTH;
const CDEK_SHIPMENT_STATUS_SYNC_INTERVAL_MS = 1000 * 60 * 15;
const CDEK_SHIPMENT_TRACK_NUMBER_ATTEMPTS = 3;
const CDEK_SHIPMENT_TRACK_NUMBER_RETRY_DELAY_MS = 1000;
const finalCdekShipmentStatusCodes = new Set([
  "DELIVERED",
  "INVALID",
  "NOT_DELIVERED",
]);

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly cartStorage: CartStorage,
    private readonly cartService: CartService,
    private readonly deliveryService: DeliveryService,
    private readonly mailerService: MailerService,
    private readonly ozonAcquiringService: OzonAcquiringService,
    private readonly ozonLogisticsService: OzonLogisticsService,
    private readonly ordersStorage: OrdersStorage,
    private readonly ordersTelegramService: OrdersTelegramService,
  ) {}

  getPickupPoints(): Promise<PickupPointDTO[]> {
    return this.ozonLogisticsService.getPickupPoints();
  }

  async getOrder(orderId: string, user: AuthUser): Promise<OrderDTO> {
    const parsedOrderId = this.parseOrderId(orderId);
    const order = await this.ordersStorage.getOrder(parsedOrderId, user.id);
    const didSyncShipments = await this.syncStaleCdekShipments([order]);

    return didSyncShipments
      ? this.ordersStorage.getOrder(parsedOrderId, user.id)
      : order;
  }

  async getOrderState(orderId: string, user: AuthUser): Promise<OrderStateDTO> {
    const order = await this.getOrder(orderId, user);

    return {
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment.status,
    };
  }

  async getMyOrders(user: AuthUser): Promise<OrderDTO[]> {
    const orders = await this.ordersStorage.getOrdersByUserId(user.id);
    const didSyncShipments = await this.syncStaleCdekShipments(orders);

    return didSyncShipments
      ? this.ordersStorage.getOrdersByUserId(user.id)
      : orders;
  }

  getAdminOrders(): Promise<AdminOrderDTO[]> {
    return this.ordersStorage.getAdminOrders();
  }

  getAdminOrder(orderId: string): Promise<AdminOrderDTO> {
    return this.ordersStorage.getAdminOrder(this.parseOrderId(orderId));
  }

  async updateAdminOrderStatus(
    orderId: string,
    status: unknown,
    author: AuthUser,
  ): Promise<AdminOrderDTO> {
    const result = await this.ordersStorage.updateAdminOrderStatus(
      this.parseOrderId(orderId),
      this.parseStatus(status),
      author.id,
    );

    if (result.changed) {
      await this.notifyCustomerAboutStatusChange(result);
    }

    return result.order;
  }

  createAdminOrderComment(
    orderId: string,
    body: unknown,
    author: AuthUser,
  ): Promise<AdminOrderDTO> {
    return this.ordersStorage.createAdminOrderComment(
      this.parseOrderId(orderId),
      this.parseAdminComment(body),
      author.id,
    );
  }

  async calculateCheckout(
    cartId: string | undefined,
    request: CalculateCheckoutRequestDTO,
  ): Promise<CheckoutCalculationDTO> {
    const cart = await this.cartStorage.ensureCart(cartId);
    const cartDTO = this.cartStorage.getDTO(cart);

    if (cartDTO.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    await this.cartService.assertItemsInStock(cartDTO.items);

    const delivery = await this.deliveryService.calculatePickupPointDelivery(
      this.parseDeliverySelection(request.delivery),
      cartDTO.items,
    );
    const deliveryPrice = delivery.deliveryPrice;

    return {
      cartId: cartDTO.id,
      itemsCount: cartDTO.itemsCount,
      subtotal: cartDTO.subtotal,
      deliveryPrice,
      total: cartDTO.subtotal + deliveryPrice,
      currency: "RUB",
      delivery: {
        provider: delivery.provider,
        pickupPoint: delivery.pickupPoint,
      },
    };
  }

  async createOrder(
    cartId: string | undefined,
    request: CreateOrderRequestDTO,
    user: AuthUser,
  ): Promise<OrderDTO> {
    const cart = await this.cartStorage.ensureCart(cartId);
    const cartDTO = this.cartStorage.getDTO(cart);

    if (cartDTO.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    await this.cartService.assertItemsInStock(cartDTO.items);

    const customer = this.parseCustomer(request.customer);
    const delivery = await this.deliveryService.calculatePickupPointDelivery(
      this.parseDeliverySelection(request.delivery),
      cartDTO.items,
    );
    const paymentMethod = request.payment?.method ?? "ozon_acquiring";
    const comment = this.parseComment(request.comment);

    if (
      paymentMethod !== "bank_card_mock" &&
      paymentMethod !== "ozon_acquiring"
    ) {
      throw new BadRequestException(
        "payment.method must be bank_card_mock or ozon_acquiring",
      );
    }

    if (request.acceptedLegal !== true) {
      throw new BadRequestException("Legal terms must be accepted");
    }

    if (request.acceptedPersonalDataConsent !== true) {
      throw new BadRequestException("Personal data consent must be accepted");
    }

    const order = await this.ordersStorage.createOrder({
      userId: user.id,
      cartId: cartDTO.id,
      customer,
      delivery: {
        provider: delivery.provider,
        pickupPoint: delivery.pickupPoint,
      },
      items: cartDTO.items,
      itemsCount: cartDTO.itemsCount,
      paymentMethod,
      subtotal: cartDTO.subtotal,
      comment,
    });

    if (paymentMethod === "ozon_acquiring") {
      return this.createOzonPaymentForOrder(order, user.id);
    }

    await this.cartService.clearCart(order.cartId);
    this.queueOrderCreatedNotifications(order, user.id);

    return order;
  }

  async handleOzonPaymentNotification(body: unknown) {
    const notification = this.parseOzonNotificationBody(body);

    this.ozonAcquiringService.assertValidNotification(notification);

    const parsedNotification =
      this.ozonAcquiringService.parseNotification(notification);
    const result = await this.ordersStorage.applyOzonAcquiringNotification({
      ...parsedNotification,
      raw: notification,
    });

    if (!result) {
      this.logger.warn(
        `Ozon Acquiring notification ignored: order not found for extOrderId=${
          parsedNotification.extOrderId ?? "unknown"
        }, extTransactionId=${
          parsedNotification.extTransactionId ?? "unknown"
        }, acquiringOrderId=${parsedNotification.acquiringOrderId ?? "unknown"}`,
      );
    }

    if (result?.paymentStatusChangedToPaid) {
      this.queueOrderPaidNotifications(
        result.order,
        result.userId,
        result.previousStatus,
      );
    }

    return { ok: true };
  }

  async confirmPayment(orderId: string, user: AuthUser): Promise<OrderDTO> {
    const order = await this.ordersStorage.markOrderAsPaid(
      this.parseOrderId(orderId),
      user.id,
    );
    await this.cartService.clearCart(order.cartId);

    return order;
  }

  private async createOzonPaymentForOrder(
    order: OrderDTO,
    userId: string,
  ): Promise<OrderDTO> {
    try {
      const payment = await this.ozonAcquiringService.createCheckoutPayment({
        amount: order.total,
        customer: order.customer,
        deliveryPrice: order.deliveryPrice,
        deliveryProvider: order.delivery.provider,
        failUrl: this.createSiteUrl("/checkout/failure", order.id),
        items: order.items,
        notificationUrl: this.createApiUrl(
          "/orders/payments/ozon/notifications",
        ),
        orderId: order.id,
        successUrl: this.createSiteUrl("/checkout/success", order.id),
      });
      const orderWithPayment =
        await this.ordersStorage.attachOzonAcquiringPayment(order.id, {
          acquiringOrderId: payment.acquiringOrderId,
          isTestMode: payment.isTestMode,
          paymentId: payment.paymentId,
          redirectUrl: payment.redirectUrl,
        });

      await this.cartService.clearCart(order.cartId);
      this.queueOrderCreatedNotifications(orderWithPayment, userId);

      return orderWithPayment;
    } catch (error) {
      await this.ordersStorage
        .markOzonAcquiringPaymentFailed(order.id, {
          errorMessage: this.getErrorMessage(error),
        })
        .catch((storageError) => {
          this.logger.warn(
            `Failed to mark Ozon Acquiring payment as failed for order ${order.id}: ${
              storageError instanceof Error
                ? storageError.message
                : String(storageError)
            }`,
          );
        });

      throw error;
    }
  }

  private parseOzonNotificationBody(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException(
        "Ozon Acquiring notification body is invalid",
      );
    }

    return value as Record<string, unknown>;
  }

  private createSiteUrl(path: string, orderId: string) {
    const url = new URL(path, `${this.getSiteUrl()}/`);

    url.searchParams.set("orderId", orderId);

    return url.toString();
  }

  private createApiUrl(path: string) {
    return new URL(path, `${this.getApiPublicUrl()}/`).toString();
  }

  private getSiteUrl() {
    return (process.env.SITE_URL ?? "http://localhost:3000").replace(
      /\/+$/,
      "",
    );
  }

  private getApiPublicUrl() {
    return (process.env.API_PUBLIC_URL ?? "http://localhost:3002").replace(
      /\/+$/,
      "",
    );
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof HttpException) {
      return this.getHttpExceptionMessage(error.getResponse()) ?? error.message;
    }

    return error instanceof Error ? error.message : String(error);
  }

  private getHttpExceptionMessage(response: string | object) {
    if (typeof response === "string" && response.trim()) {
      return response.trim();
    }

    if (!response || typeof response !== "object") {
      return undefined;
    }

    const message = (response as Record<string, unknown>).message;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }

    if (Array.isArray(message)) {
      const messages = message.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      );

      return messages.length > 0 ? messages.join(", ") : undefined;
    }

    return undefined;
  }

  private parseCustomer(value: unknown) {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("customer is required");
    }

    const customer = value as Record<string, unknown>;

    return {
      name: this.parseRequiredString(customer.name, "customer.name"),
      phone: this.parseRequiredString(customer.phone, "customer.phone"),
      email: this.parseEmail(customer.email),
    };
  }

  private parseDeliverySelection(value: unknown): DeliverySelection {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("delivery is required");
    }

    const delivery = value as Record<string, unknown>;
    const provider = delivery.provider;

    if (provider !== "ozon" && provider !== "cdek") {
      throw new BadRequestException("delivery.provider must be ozon or cdek");
    }

    return {
      cityCode: this.parseOptionalPositiveInteger(
        delivery.cityCode,
        "delivery.cityCode",
      ),
      pickupPointAddress: this.parseOptionalString(delivery.pickupPointAddress),
      pickupPointId: this.parseOptionalString(delivery.pickupPointId),
      provider,
    };
  }

  private parseOrderId(value: unknown): string {
    return this.parseRequiredString(value, "orderId");
  }

  private parseRequiredString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }

    return value.trim();
  }

  private parseOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private parseOptionalPositiveInteger(
    value: unknown,
    field: string,
  ): number | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const parsedValue = typeof value === "number" ? value : Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    return parsedValue;
  }

  private parseEmail(value: unknown): string {
    const email = this.parseRequiredString(value, "customer.email");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("customer.email must be a valid email");
    }

    return email;
  }

  private parseComment(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== "string") {
      throw new BadRequestException("comment must be a string");
    }

    const comment = value.trim();

    if (!comment) {
      return undefined;
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `comment must be ${MAX_COMMENT_LENGTH} characters or less`,
      );
    }

    return comment;
  }

  private parseAdminComment(value: unknown): string {
    const comment = this.parseRequiredString(value, "body");

    if (comment.length > MAX_ADMIN_COMMENT_LENGTH) {
      throw new BadRequestException(
        `body must be ${MAX_ADMIN_COMMENT_LENGTH} characters or less`,
      );
    }

    return comment;
  }

  private parseStatus(value: unknown): OrderStatus {
    if (
      typeof value !== "string" ||
      !orderStatuses.includes(value as OrderStatus)
    ) {
      throw new BadRequestException("status must be a valid order status");
    }

    return value as OrderStatus;
  }

  private async notifyCustomerAboutStatusChange(result: {
    order: OrderDTO;
    previousStatus: OrderStatus;
    nextStatus: OrderStatus;
    userId?: string;
  }) {
    if (!result.userId) {
      return;
    }

    try {
      const chatId = await this.ordersStorage.getUserTelegramChatId(
        result.userId,
      );

      if (!chatId) {
        return;
      }

      await this.ordersTelegramService.sendOrderStatusChangedToCustomer({
        chatId,
        nextStatus: result.nextStatus,
        order: result.order,
        previousStatus: result.previousStatus,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send Telegram status notification for order ${result.order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async notifyAdminAboutOrderCreated(order: OrderDTO) {
    try {
      await this.ordersTelegramService.sendOrderCreated(order);
    } catch (error) {
      this.logger.warn(
        `Failed to send Telegram order notification for order ${order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async notifyAdminAboutOrderPaid(order: OrderDTO) {
    try {
      await this.ordersTelegramService.sendOrderPaid(order);
    } catch (error) {
      this.logger.warn(
        `Failed to send Telegram paid notification for order ${order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private queueOrderPaidNotifications(
    order: OrderDTO,
    userId: string | undefined,
    previousStatus: OrderStatus,
  ) {
    setImmediate(() => {
      void this.notifyOrderPaid(order, userId, previousStatus).catch(
        (error) => {
          this.logger.warn(
            `Failed to process queued paid notifications for order ${order.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      );
    });
  }

  private async notifyOrderPaid(
    order: OrderDTO,
    userId: string | undefined,
    previousStatus: OrderStatus,
  ) {
    const cdekShipment = await this.ensureCdekShipmentForPaidOrder(order);
    const notificationOrder = cdekShipment
      ? this.withOrderShipment(order, cdekShipment)
      : order;

    await Promise.all([
      this.notifyAdminAboutOrderPaid(notificationOrder),
      this.sendOrderPaidEmail(notificationOrder),
      this.notifyCustomerAboutStatusChange({
        order: notificationOrder,
        previousStatus,
        nextStatus: "paid",
        userId,
      }),
    ]);
  }

  private async ensureCdekShipmentForPaidOrder(
    order: OrderDTO,
  ): Promise<OrderShipmentDTO | undefined> {
    if (
      order.delivery.provider !== "cdek" ||
      !this.isCdekOrderCreationEnabled()
    ) {
      return;
    }

    try {
      const claim = await this.ordersStorage.claimOrderShipmentCreation(
        order.id,
        "cdek",
      );

      if (!claim.shouldCreate) {
        if (claim.shipment.externalUuid) {
          return this.syncCdekShipmentWithTrackNumber(
            order.id,
            claim.shipment.externalUuid,
          );
        }

        return claim.shipment;
      }

      const shipment = await this.deliveryService.createCdekOrder({
        id: order.id,
        customer: order.customer,
        delivery: order.delivery,
        items: order.items,
        comment: order.comment,
      });

      const savedShipment = await this.ordersStorage.upsertOrderShipment({
        orderId: order.id,
        provider: "cdek",
        ...shipment,
        syncedAt: new Date(),
      });

      if (savedShipment.externalUuid) {
        return this.syncCdekShipmentWithTrackNumber(
          order.id,
          savedShipment.externalUuid,
        );
      }

      return savedShipment;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      let shipment: OrderShipmentDTO | undefined;

      try {
        shipment = await this.ordersStorage.upsertOrderShipment({
          orderId: order.id,
          provider: "cdek",
          errorMessage,
          requestState: "ERROR",
          syncedAt: new Date(),
        });
      } catch (storageError) {
        this.logger.warn(
          `Failed to save CDEK shipment error for order ${order.id}: ${
            storageError instanceof Error
              ? storageError.message
              : String(storageError)
          }`,
        );
      }

      this.logger.warn(
        `Failed to create CDEK shipment for order ${order.id}: ${errorMessage}`,
      );

      return shipment;
    }
  }

  private async syncCdekShipment(
    orderId: string,
    externalUuid: string,
  ): Promise<OrderShipmentDTO> {
    const shipment = await this.deliveryService.getCdekOrder(externalUuid);

    return this.ordersStorage.upsertOrderShipment({
      orderId,
      provider: "cdek",
      ...shipment,
      syncedAt: new Date(),
    });
  }

  private async syncCdekShipmentWithTrackNumber(
    orderId: string,
    externalUuid: string,
  ) {
    let shipment: OrderShipmentDTO | undefined;

    for (
      let attempt = 1;
      attempt <= CDEK_SHIPMENT_TRACK_NUMBER_ATTEMPTS;
      attempt += 1
    ) {
      shipment = await this.syncCdekShipment(orderId, externalUuid);

      if (
        shipment.externalNumber ||
        attempt === CDEK_SHIPMENT_TRACK_NUMBER_ATTEMPTS
      ) {
        return shipment;
      }

      await this.delay(CDEK_SHIPMENT_TRACK_NUMBER_RETRY_DELAY_MS);
    }

    return shipment;
  }

  private withOrderShipment(order: OrderDTO, shipment: OrderShipmentDTO) {
    return {
      ...order,
      shipments: [
        ...order.shipments.filter((item) => item.provider !== shipment.provider),
        shipment,
      ],
    };
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async syncStaleCdekShipments(orders: OrderDTO[]) {
    const candidates = orders.flatMap((order) =>
      order.shipments
        .filter((shipment) => this.shouldSyncCdekShipment(shipment))
        .map((shipment) => ({
          externalUuid: shipment.externalUuid as string,
          orderId: order.id,
        })),
    );

    if (candidates.length === 0) {
      return false;
    }

    let didSync = false;

    await Promise.all(
      candidates.map(async ({ externalUuid, orderId }) => {
        try {
          await this.syncCdekShipment(orderId, externalUuid);
          didSync = true;
        } catch (error) {
          this.logger.warn(
            `Failed to sync CDEK shipment status for order ${orderId}: ${this.getErrorMessage(error)}`,
          );
        }
      }),
    );

    return didSync;
  }

  private shouldSyncCdekShipment(shipment: OrderDTO["shipments"][number]) {
    if (shipment.provider !== "cdek" || !shipment.externalUuid) {
      return false;
    }

    const statusCode = shipment.statusCode?.toUpperCase();

    if (statusCode && finalCdekShipmentStatusCodes.has(statusCode)) {
      return false;
    }

    if (!shipment.syncedAt) {
      return true;
    }

    const syncedAt = Date.parse(shipment.syncedAt);

    return (
      !Number.isFinite(syncedAt) ||
      Date.now() - syncedAt >= CDEK_SHIPMENT_STATUS_SYNC_INTERVAL_MS
    );
  }

  private isCdekOrderCreationEnabled() {
    return process.env.CDEK_ORDER_CREATION_ENABLED === "true";
  }

  private queueOrderCreatedNotifications(order: OrderDTO, userId: string) {
    setImmediate(() => {
      void this.notifyOrderCreated(order, userId).catch((error) => {
        this.logger.warn(
          `Failed to process queued notifications for order ${order.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    });
  }

  private async notifyOrderCreated(order: OrderDTO, userId: string) {
    await Promise.all([
      this.notifyAdminAboutOrderCreated(order),
      this.notifyCustomerAboutOrderCreated(order, userId),
    ]);
  }

  private async notifyCustomerAboutOrderCreated(
    order: OrderDTO,
    userId: string,
  ) {
    await Promise.all([
      this.sendOrderCreatedEmail(order),
      this.sendOrderCreatedTelegram(order, userId),
    ]);
  }

  private async sendOrderCreatedEmail(order: OrderDTO) {
    try {
      await this.mailerService.sendMail({
        to: order.customer.email,
        subject: this.getOrderCreatedEmailSubject(order),
        text: this.renderOrderCreatedTextEmail(order),
        html: this.renderOrderCreatedHtmlEmail(order),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send customer order email for order ${order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async sendOrderPaidEmail(order: OrderDTO) {
    try {
      await this.mailerService.sendMail({
        to: order.customer.email,
        subject: `Заказ ${order.id} оплачен - Artmate`,
        text: this.renderOrderPaidTextEmail(order),
        html: this.renderOrderPaidHtmlEmail(order),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send customer paid email for order ${order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async sendOrderCreatedTelegram(order: OrderDTO, userId: string) {
    try {
      const chatId = await this.ordersStorage.getUserTelegramChatId(userId);

      if (!chatId) {
        return;
      }

      await this.ordersTelegramService.sendOrderCreatedToCustomer({
        chatId,
        order,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send customer Telegram order notification for order ${order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private renderOrderCreatedTextEmail(order: OrderDTO) {
    return [
      "ARTMATE",
      "",
      this.getOrderCreatedTextTitle(order),
      "",
      ...this.getOrderCreatedTextIntro(order),
      "",
      "Товары:",
      ...this.renderOrderItemsTextEmail(order),
      "",
      "Стоимость заказа:",
      `Товары: ${this.formatMoney(order.subtotal)}`,
      `Доставка: ${this.formatMoney(order.deliveryPrice)}`,
      `Итого: ${this.formatMoney(order.total)}`,
      "",
      `Телефон: ${order.customer.phone}`,
      "",
      renderSupportEmailFooterText(),
    ].join("\n");
  }

  private renderOrderCreatedHtmlEmail(order: OrderDTO) {
    const escapedOrderId = escapeEmailHtml(order.id);
    const escapedName = escapeEmailHtml(order.customer.name);

    return renderBrandedEmail({
      title: this.getOrderCreatedHtmlTitle(order),
      previewText: this.getOrderCreatedPreviewText(order),
      contentHtml: `
        ${this.renderOrderCreatedIntroHtmlEmail(
          order,
          escapedName,
          escapedOrderId,
        )}
        ${this.renderOrderItemsHtmlEmail(order)}
        ${renderEmailDetails([
          { label: "Товары", value: this.formatMoney(order.subtotal) },
          { label: "Доставка", value: this.formatMoney(order.deliveryPrice) },
          { label: "Итого", value: this.formatMoney(order.total) },
          { label: "Телефон", value: order.customer.phone },
        ])}
      `,
      footerHtml: renderSupportEmailFooter(),
    });
  }

  private renderOrderPaidTextEmail(order: OrderDTO) {
    return [
      "ARTMATE",
      "",
      `Заказ ${order.id} оплачен.`,
      "",
      `${order.customer.name}, спасибо за оплату. Скоро передадим заказ в доставку.`,
      ...this.renderCdekTrackingTextEmail(order),
      "",
      "Товары:",
      ...this.renderOrderItemsTextEmail(order),
      "",
      "Стоимость заказа:",
      `Товары: ${this.formatMoney(order.subtotal)}`,
      `Доставка: ${this.formatMoney(order.deliveryPrice)}`,
      `Итого: ${this.formatMoney(order.total)}`,
      "",
      renderSupportEmailFooterText(),
    ].join("\n");
  }

  private renderOrderPaidHtmlEmail(order: OrderDTO) {
    const escapedOrderId = escapeEmailHtml(order.id);
    const escapedName = escapeEmailHtml(order.customer.name);

    return renderBrandedEmail({
      title: "Заказ оплачен",
      previewText: `Оплата заказа ${order.id} получена.`,
      contentHtml: `
        ${renderEmailParagraph(
          `${escapedName}, спасибо за оплату заказа ${escapedOrderId}. Скоро передадим заказ в доставку.`,
        )}
        ${this.renderOrderItemsHtmlEmail(order)}
        ${renderEmailDetails(this.getOrderPaidDetails(order))}
      `,
      footerHtml: renderSupportEmailFooter(),
    });
  }

  private renderCdekTrackingTextEmail(order: OrderDTO) {
    const trackNumber = this.getCdekTrackNumber(order);

    return trackNumber ? [`Трек-номер СДЭК: ${trackNumber}`] : [];
  }

  private getOrderPaidDetails(order: OrderDTO) {
    const details = [
      { label: "Товары", value: this.formatMoney(order.subtotal) },
      { label: "Доставка", value: this.formatMoney(order.deliveryPrice) },
    ];
    const cdekTrackNumber = this.getCdekTrackNumber(order);

    if (cdekTrackNumber) {
      details.push({ label: "Трек-номер СДЭК", value: cdekTrackNumber });
    }

    details.push({ label: "Итого", value: this.formatMoney(order.total) });

    return details;
  }

  private getOrderCreatedEmailSubject(order: OrderDTO) {
    if (this.isOzonAcquiringOrder(order)) {
      return `Заказ ${order.id} ожидает оплаты - Artmate`;
    }

    return `Заказ ${order.id} принят - Artmate`;
  }

  private getOrderCreatedTextTitle(order: OrderDTO) {
    if (this.isOzonAcquiringOrder(order)) {
      return `Заказ ${order.id} ожидает оплаты.`;
    }

    return `Заказ ${order.id} принят.`;
  }

  private getOrderCreatedHtmlTitle(order: OrderDTO) {
    return this.isOzonAcquiringOrder(order)
      ? "Заказ ожидает оплаты"
      : "Заказ принят";
  }

  private getOrderCreatedPreviewText(order: OrderDTO) {
    if (this.isOzonAcquiringOrder(order)) {
      return `Заказ ${order.id} оформлен, ожидается оплата.`;
    }

    return `Заказ ${order.id} принят Artmate.`;
  }

  private getOrderCreatedTextIntro(order: OrderDTO) {
    if (this.isOzonAcquiringOrder(order)) {
      return [
        `${order.customer.name}, заказ оформлен, ожидается оплата.`,
        `Ссылка на оплату: ${this.createCustomerOrderPaymentUrl(order)}`,
        "Если оплата уже прошла, по этой ссылке откроется страница заказа.",
      ];
    }

    return [
      `${order.customer.name}, спасибо за заказ. Мы получили заявку и скоро передадим заказ в доставку.`,
    ];
  }

  private renderOrderCreatedIntroHtmlEmail(
    order: OrderDTO,
    escapedName: string,
    escapedOrderId: string,
  ) {
    if (this.isOzonAcquiringOrder(order)) {
      return `
        ${renderEmailParagraph(
          `${escapedName}, заказ ${escapedOrderId} оформлен, ожидается оплата.`,
        )}
        ${renderEmailButton({
          href: this.createCustomerOrderPaymentUrl(order),
          label: this.getCustomerOrderPaymentButtonLabel(order),
        })}
        ${renderEmailParagraph(
          "Если оплата уже прошла, по этой ссылке откроется страница заказа.",
        )}
      `;
    }

    return renderEmailParagraph(
      `${escapedName}, спасибо за заказ ${escapedOrderId}. Мы получили заявку и скоро передадим заказ в доставку.`,
    );
  }

  private getCustomerOrderPaymentButtonLabel(order: OrderDTO) {
    return order.payment.status === "paid" ? "Открыть заказ" : "Оплатить заказ";
  }

  private createCustomerOrderPaymentUrl(order: OrderDTO) {
    return this.createSiteUrl("/checkout/payment", order.id);
  }

  private isOzonAcquiringOrder(order: OrderDTO) {
    return order.payment.method === "ozon_acquiring";
  }

  private getCdekTrackNumber(order: OrderDTO) {
    if (order.delivery.provider !== "cdek") {
      return undefined;
    }

    return order.shipments.find((shipment) => shipment.provider === "cdek")
      ?.externalNumber;
  }

  private renderOrderItemsTextEmail(order: OrderDTO) {
    if (order.items.length === 0) {
      return ["Товары не указаны."];
    }

    return order.items.map(
      (item) =>
        `- ${item.title}: ${item.quantity} x ${this.formatMoney(
          item.price,
        )} = ${this.formatMoney(item.lineTotal)}`,
    );
  }

  private renderOrderItemsHtmlEmail(order: OrderDTO) {
    if (order.items.length === 0) {
      return renderEmailParagraph("Товары не указаны.");
    }

    const rowsHtml = order.items
      .map(
        (item) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e7e5e4;color:#1c1917;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;">
              ${escapeEmailHtml(item.title)}
            </td>
            <td align="right" style="padding:10px 0;border-bottom:1px solid #e7e5e4;color:#78716c;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;white-space:nowrap;">
              ${item.quantity} x ${escapeEmailHtml(this.formatMoney(item.price))}
            </td>
            <td align="right" style="padding:10px 0 10px 14px;border-bottom:1px solid #e7e5e4;color:#1c1917;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;white-space:nowrap;">
              ${escapeEmailHtml(this.formatMoney(item.lineTotal))}
            </td>
          </tr>
        `,
      )
      .join("");

    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid #e7e5e4;border-radius:16px;background:#fafaf9;">
        <tr>
          <td style="padding:16px 18px 4px;color:#78716c;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;">
            Товары
          </td>
        </tr>
        <tr>
          <td style="padding:0 18px 8px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              ${rowsHtml}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  private formatMoney(value: number) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  }
}
