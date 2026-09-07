import crypto from "node:crypto";

import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import { parseYandexAttribution } from "../analytics/yandex-attribution";
import type { CartDTO } from "../cart/dto";
import { CartService } from "../cart/cart.service";
import { DeliveryService } from "../delivery/delivery.service";
import type { DeliverySelection } from "../delivery/providers/delivery-provider.interface";
import {
  escapeEmailHtml,
  renderBrandedEmail,
  renderEmailButton,
  renderEmailDetails,
  renderEmailNotice,
  renderEmailParagraph,
  renderSupportEmailFooter,
  renderSupportEmailFooterText,
} from "../mailer/branded-email";
import { NotificationQueueService } from "../notifications/notification-queue.service";
import { OzonAcquiringService } from "../ozon/ozon-acquiring.service";
import { normalizePromoCodeValue } from "../promocodes/promo-code";
import { calculatePromoPricing } from "../promocodes/pricing";
import {
  PromocodesService,
  rublesToKopecks,
} from "../promocodes/promocodes.service";
import { TBankAcquiringService } from "../tbank/tbank-acquiring.service";

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
} from "./dto";
import { OrdersTelegramService } from "./orders-telegram.service";
import {
  type ApplyCdekOrderStatusWebhookResult,
  OrdersStorage,
} from "./orders.storage";

const MAX_COMMENT_LENGTH = ORDER_COMMENT_MAX_LENGTH;
const MAX_ADMIN_COMMENT_LENGTH = ORDER_ADMIN_COMMENT_MAX_LENGTH;
const CDEK_SHIPMENT_STATUS_SYNC_INTERVAL_MS = 1000 * 60 * 15;
const CDEK_SHIPMENT_TRACK_NUMBER_ATTEMPTS = 3;
const CDEK_SHIPMENT_TRACK_NUMBER_RETRY_DELAY_MS = 1000;
const ozonDeliveryUnavailableMessage =
  "данный товар не можем доставить через озон";
const deliveryCalculationErrorMessage =
  "Не удалось рассчитать доставку. Попробуйте еще раз.";
const paymentInitializationErrorMessage =
  "Не удалось начать оплату. Попробуйте еще раз.";
const finalCdekShipmentStatusCodes = new Set([
  "DELIVERED",
  "INVALID",
  "NOT_DELIVERED",
  "REMOVED",
]);
const cdekReadyForPickupStatusCodes = new Set([
  "ACCEPTED_AT_PICK_UP_POINT",
  "POSTOMAT_POSTED",
]);
const cdekShipmentStatusLabels: Record<string, string> = {
  ACCEPTED: "Принят",
  ACCEPTED_AT_PICK_UP_POINT: "Ожидает в ПВЗ",
  ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE: "В городе получателя",
  ACCEPTED_IN_RECIPIENT_CITY: "В городе получателя",
  CREATED: "Создан",
  DELIVERED: "Получен",
  ENTERED_TO_PICK_UP_POINT: "Ожидает в ПВЗ",
  INVALID: "Некорректный заказ",
  NOT_DELIVERED: "Не вручен",
  POSTOMAT_POSTED: "Ожидает в постамате",
  POSTOMAT_RECEIVED: "Получен из постамата",
  RECEIVED_AT_SHIPMENT_WAREHOUSE: "Принят на склад отправителя",
  REMOVED: "Удален",
  TAKEN_BY_COURIER: "У курьера",
};
const orderStatusLabels: Record<OrderStatus, string> = {
  new: "В обработке",
  in_progress: "В работе",
  waiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  delivering: "Доставляется",
  completed: "Завершен",
  cancelled: "Отменен",
};

type CdekOrderStatusWebhookEvent = {
  cdekNumber: string;
  deleted: boolean;
  externalUuid: string;
  orderNumber?: string;
  raw: Record<string, unknown>;
  statusCode: string;
  statusDateTime?: string;
  statusName: string;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly cartService: CartService,
    private readonly deliveryService: DeliveryService,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly ozonAcquiringService: OzonAcquiringService,
    private readonly tbankAcquiringService: TBankAcquiringService,
    private readonly ordersStorage: OrdersStorage,
    private readonly ordersTelegramService: OrdersTelegramService,
    private readonly promocodesService: PromocodesService,
  ) {}

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
    const parsedOrderId = this.parseOrderId(orderId);
    const parsedStatus = this.parseStatus(status);
    const result = await this.ordersStorage.updateAdminOrderStatus(
      parsedOrderId,
      parsedStatus,
      author.id,
    );
    let order = result.order;

    if (result.changed && parsedStatus === "cancelled") {
      order = await this.deleteCdekShipmentForCancelledOrder(order);
    }

    if (result.changed) {
      await this.notifyCustomerAboutStatusChange({ ...result, order });
    }

    return order;
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
    user?: AuthUser,
  ): Promise<CheckoutCalculationDTO> {
    const cartDTO = await this.cartService.getCart(cartId);

    if (cartDTO.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    await this.cartService.assertItemsInStock(cartDTO.items);

    const deliverySelection = this.parseDeliverySelection(request.delivery);

    this.assertOzonDeliveryAvailable(deliverySelection, cartDTO);

    const delivery = await this.calculateCheckoutDelivery(
      deliverySelection,
      cartDTO.items,
    );
    const deliveryPrice = delivery.deliveryPrice;
    const promo = await this.calculatePromo(
      cartDTO,
      request.promoCode,
      user?.id,
    );

    return {
      cartId: cartDTO.id,
      itemsCount: cartDTO.itemsCount,
      subtotal: cartDTO.subtotal,
      discount: promo.pricing.discountKopecks / 100,
      deliveryPrice,
      promoCode: promo.code,
      total: promo.pricing.totalKopecks / 100 + deliveryPrice,
      currency: "RUB",
      delivery: {
        provider: delivery.provider,
        pickupPoint: delivery.pickupPoint,
      },
      estimatedDeliveryDateRange: delivery.estimatedDeliveryDateRange,
    };
  }

  async createOrder(
    cartId: string | undefined,
    request: CreateOrderRequestDTO,
    user?: AuthUser,
  ): Promise<OrderDTO> {
    const checkoutAttemptId = this.parseRequiredString(
      request.checkoutAttemptId,
      "checkoutAttemptId",
    );
    if (checkoutAttemptId.length > 128) {
      throw new BadRequestException(
        "checkoutAttemptId must be 128 characters or less",
      );
    }
    if (!cartId) throw new BadRequestException("Cart is required");

    const paymentMethod = request.payment?.method ?? "ozon_acquiring";
    if (
      paymentMethod !== "ozon_acquiring" &&
      paymentMethod !== "tbank_acquiring"
    ) {
      throw new BadRequestException(
        "payment.method must be ozon_acquiring or tbank_acquiring",
      );
    }
    if (request.acceptedLegal !== true) {
      throw new BadRequestException("Legal terms must be accepted");
    }
    if (request.acceptedPersonalDataConsent !== true) {
      throw new BadRequestException("Personal data consent must be accepted");
    }

    const customer = this.parseCustomer(request.customer);
    const deliverySelection = this.parseDeliverySelection(request.delivery);
    const comment = this.parseComment(request.comment);
    const promoCode = request.promoCode
      ? normalizePromoCodeValue(request.promoCode)
      : undefined;
    const attribution = parseYandexAttribution(request.attribution);
    const checkoutPayloadFingerprint = this.createCheckoutPayloadFingerprint({
      acceptedLegal: true,
      acceptedPersonalDataConsent: true,
      comment: comment ?? null,
      customer: {
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      },
      delivery: {
        cityCode: deliverySelection.cityCode ?? null,
        pickupPointAddress: deliverySelection.pickupPointAddress ?? null,
        pickupPointId: deliverySelection.pickupPointId ?? null,
        provider: deliverySelection.provider,
      },
      paymentMethod,
      promoCode: promoCode ?? null,
    });

    const existingOrder = await this.ordersStorage.getOrderByCheckoutAttempt?.(
      checkoutAttemptId,
      cartId,
      user?.id,
      checkoutPayloadFingerprint,
    );
    if (existingOrder) {
      return this.initializePaymentForOrder(existingOrder, user?.id);
    }

    const cartDTO = await this.cartService.getCart(cartId);

    if (cartDTO.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    await this.cartService.assertItemsInStock(cartDTO.items);

    this.assertOzonDeliveryAvailable(deliverySelection, cartDTO);

    const delivery = await this.calculateCheckoutDelivery(
      deliverySelection,
      cartDTO.items,
    );
    const promo = await this.calculatePromo(
      cartDTO,
      promoCode,
      user?.id,
    );
    this.assertSupportedPaymentReceipt(
      promo.pricing,
      delivery.deliveryPrice,
      paymentMethod,
    );

    const order = await this.ordersStorage.createOrder({
      userId: user?.id,
      cartId: cartDTO.id,
      checkoutAttemptId,
      checkoutPayloadFingerprint,
      attribution,
      customer,
      delivery: {
        provider: delivery.provider,
        pickupPoint: delivery.pickupPoint,
      },
      items: cartDTO.items,
      itemsCount: cartDTO.itemsCount,
      paymentMethod,
      subtotal: cartDTO.subtotal,
      promoCode: promo.code ?? undefined,
      comment,
    });

    return this.initializePaymentForOrder(order, user?.id);
  }

  private createCheckoutPayloadFingerprint(payload: object) {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  private async calculateCheckoutDelivery(
    selection: DeliverySelection,
    items: CartDTO["items"],
  ) {
    try {
      return await this.deliveryService.calculatePickupPointDelivery(
        selection,
        items,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const diagnostic =
        error instanceof HttpException
          ? error.getResponse()
          : error instanceof Error
            ? { message: error.message, name: error.name }
            : error;
      this.logger.warn(
        `${selection.provider.toUpperCase()} checkout delivery failed: ${this.stringifyProviderDiagnostic(
          diagnostic,
        )}`,
      );
      throw new ServiceUnavailableException(deliveryCalculationErrorMessage);
    }
  }

  private stringifyProviderDiagnostic(value: unknown) {
    const sanitize = (item: unknown): unknown => {
      if (Array.isArray(item)) {
        return item.map(sanitize);
      }
      if (!item || typeof item !== "object") {
        return item;
      }
      return Object.fromEntries(
        Object.entries(item).map(([key, propertyValue]) => [
          key,
          /authorization|secret|token|access.?key|request.?sign/iu.test(key)
            ? "[redacted]"
            : sanitize(propertyValue),
        ]),
      );
    };

    try {
      return JSON.stringify(sanitize(value)).slice(0, 2_000);
    } catch {
      return "[unserializable]";
    }
  }

  private async initializePaymentForOrder(
    order: OrderDTO,
    userId: string | undefined,
  ) {
    const shouldInitialize =
      (await this.ordersStorage.claimPaymentInitialization?.(order.id)) ?? true;
    if (!shouldInitialize) {
      const initializedOrder =
        await this.ordersStorage.waitForPaymentInitialization(order.id);
      await this.consumeOrderCartSnapshot(initializedOrder.id);
      return initializedOrder;
    }

    return order.payment.method === "ozon_acquiring"
      ? this.createOzonPaymentForOrder(order, userId)
      : this.createTBankPaymentForOrder(order, userId);
  }

  private async calculatePromo(
    cart: CartDTO,
    promoCode: string | undefined,
    userId: string | undefined,
  ) {
    const items = cart.items.map((item) => ({
      id: item.id,
      unitPriceKopecks: rublesToKopecks({ toString: () => String(item.price) }),
      quantity: item.quantity,
    }));
    if (!promoCode) {
      return {
        code: null,
        pricing: calculatePromoPricing(items, {
          type: "fixed",
          amountKopecks: 0,
        }),
      };
    }
    return this.promocodesService.calculate({
      code: promoCode,
      items,
      userId,
    });
  }

  private assertSupportedPaymentReceipt(
    pricing: ReturnType<typeof calculatePromoPricing>,
    deliveryPrice: number,
    paymentMethod: "ozon_acquiring" | "tbank_acquiring",
  ) {
    const deliveryKopecks = rublesToKopecks({
      toString: () => String(deliveryPrice),
    });
    if (
      pricing.items.some((item) =>
        item.priceGroups.some((group) => group.unitPriceKopecks <= 0),
      )
    ) {
      throw new BadRequestException(
        "Оформление товара с нулевой ценой пока недоступно",
      );
    }
    if (pricing.totalKopecks + deliveryKopecks <= 0) {
      throw new BadRequestException("Сумма заказа должна быть больше нуля");
    }
    const receiptRows =
      pricing.items.reduce(
        (count, item) => count + item.priceGroups.length,
        0,
      ) + (deliveryKopecks > 0 ? 1 : 0);
    if (paymentMethod === "tbank_acquiring" && receiptRows > 100) {
      throw new BadRequestException(
        "Чек T-Bank не может содержать больше 100 позиций",
      );
    }
  }

  async handleOzonPaymentNotification(body: unknown) {
    const notification = this.parseOzonNotificationBody(body);

    const verified =
      this.ozonAcquiringService.assertValidNotification(notification);
    const authoritative =
      await this.ozonAcquiringService.getOrderStatus(verified);
    const authoritativeVerified = Object.freeze({
      ...verified,
      merchantOrderId: authoritative.merchantOrderId,
      acquiringOrderId: authoritative.acquiringOrderId,
    });

    const parsedNotification = this.ozonAcquiringService.parseNotification(
      notification,
      authoritativeVerified,
    );
    const result = await this.ordersStorage.applyOzonAcquiringNotification({
      ...parsedNotification,
      acquiringOrderId: authoritative.acquiringOrderId,
      amount: authoritative.amount,
      authoritativeStatus: authoritative.status,
      currencyCode: authoritative.currencyCode,
      extOrderId: authoritative.merchantOrderId,
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
      await this.runPaymentSideEffect(
        `queue paid notifications for Ozon order ${result.order.id}`,
        () =>
          this.queueOrderPaidNotifications(
            result.order,
            result.userId,
            result.previousStatus,
          ),
      );
    }

    return { ok: true };
  }

  recoverPayment(orderId: string, cartId: string | undefined) {
    return this.ordersStorage.recoverGuestPayment(
      this.parseOrderId(orderId),
      cartId,
    );
  }

  async handleTBankPaymentNotification(body: unknown) {
    const notification = this.parseTBankNotificationBody(body);

    this.tbankAcquiringService.assertValidNotification(notification);

    const parsedNotification =
      this.tbankAcquiringService.parseNotification(notification);
    const result = await this.ordersStorage.applyTBankAcquiringNotification({
      ...parsedNotification,
      raw: notification,
    });

    if (!result) {
      this.logger.warn(
        `T-Bank Acquiring notification ignored: orderId=${
          parsedNotification.orderId ?? "unknown"
        }, paymentId=${parsedNotification.paymentId ?? "unknown"}`,
      );
    }

    if (result?.paymentStatusChangedToPaid) {
      await this.runPaymentSideEffect(
        `queue paid notifications for T-Bank order ${result.order.id}`,
        () =>
          this.queueOrderPaidNotifications(
            result.order,
            result.userId,
            result.previousStatus,
          ),
      );
    }

    return "OK";
  }

  async handleCdekOrderStatusWebhook(secret: string, body: unknown) {
    this.assertCdekWebhookSecret(secret);

    const event = this.parseCdekOrderStatusWebhook(body);

    if (event.deleted) {
      return { ok: true };
    }

    const result = await this.processCdekOrderStatusWebhook(event);

    if (result?.shipmentStatusChanged) {
      await this.queueCdekShipmentStatusNotifications(result);
    }

    return { ok: true };
  }

  private async createOzonPaymentForOrder(
    order: OrderDTO,
    userId: string | undefined,
  ): Promise<OrderDTO> {
    let orderWithPayment: OrderDTO;
    try {
      const receiptPricing = await this.ordersStorage.getOrderReceiptPricing(
        order.id,
      );
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
        receiptPricing,
        successUrl: this.createSiteUrl("/checkout/success", order.id),
      });
      orderWithPayment = await this.ordersStorage.attachOzonAcquiringPayment(
        order.id,
        {
          acquiringOrderId: payment.acquiringOrderId,
          isTestMode: payment.isTestMode,
          paymentId: payment.paymentId,
          redirectUrl: payment.redirectUrl,
        },
      );
    } catch (error) {
      const diagnostic = this.getInternalErrorDiagnostic(error);
      this.logger.warn(
        `Ozon Acquiring payment initialization failed for order ${order.id}: ${diagnostic}`,
      );
      await this.ordersStorage
        .markOzonAcquiringPaymentFailed(order.id, {
          errorMessage: diagnostic,
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

      throw new ServiceUnavailableException(paymentInitializationErrorMessage);
    }
    await this.consumeOrderCartSnapshot(order.id);
    await this.runPaymentSideEffect(
      `queue created notifications after Ozon payment init for order ${order.id}`,
      () => this.queueOrderCreatedNotifications(orderWithPayment, userId),
    );
    return orderWithPayment;
  }

  private async createTBankPaymentForOrder(
    order: OrderDTO,
    userId: string | undefined,
  ): Promise<OrderDTO> {
    let orderWithPayment: OrderDTO;
    try {
      const receiptPricing = await this.ordersStorage.getOrderReceiptPricing(
        order.id,
      );
      const payment = await this.tbankAcquiringService.createCheckoutPayment({
        amount: order.total,
        customer: order.customer,
        deliveryPrice: order.deliveryPrice,
        deliveryProvider: order.delivery.provider,
        failUrl: this.createSiteUrl("/checkout/failure", order.id),
        items: order.items,
        notificationUrl: this.createApiUrl(
          "/orders/payments/tbank/notifications",
        ),
        orderId: order.id,
        receiptPricing,
        successUrl: this.createSiteUrl("/checkout/success", order.id),
      });
      orderWithPayment = await this.ordersStorage.attachTBankAcquiringPayment(
        order.id,
        {
          acquiringOrderId: payment.acquiringOrderId,
          paymentId: payment.paymentId,
          redirectUrl: payment.redirectUrl,
        },
      );
    } catch (error) {
      const diagnostic = this.getInternalErrorDiagnostic(error);
      this.logger.warn(
        `T-Bank Acquiring payment initialization failed for order ${order.id}: ${diagnostic}`,
      );
      await this.ordersStorage
        .markTBankAcquiringPaymentFailed(order.id, {
          errorMessage: diagnostic,
        })
        .catch((storageError) => {
          this.logger.warn(
            `Failed to mark T-Bank Acquiring payment as failed for order ${order.id}: ${
              storageError instanceof Error
                ? storageError.message
                : String(storageError)
            }`,
          );
        });

      throw new ServiceUnavailableException(paymentInitializationErrorMessage);
    }
    await this.consumeOrderCartSnapshot(order.id);
    await this.runPaymentSideEffect(
      `queue created notifications after T-Bank payment init for order ${order.id}`,
      () => this.queueOrderCreatedNotifications(orderWithPayment, userId),
    );
    return orderWithPayment;
  }

  private async runPaymentSideEffect(
    description: string,
    effect: () => Promise<unknown>,
  ) {
    try {
      await effect();
    } catch (error) {
      this.logger.warn(
        `Failed to ${description}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private consumeOrderCartSnapshot(orderId: string) {
    return this.runPaymentSideEffect(
      `consume cart snapshot after payment init for order ${orderId}`,
      () => this.ordersStorage.consumeOrderCartSnapshot(orderId),
    );
  }

  private parseOzonNotificationBody(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException(
        "Ozon Acquiring notification body is invalid",
      );
    }

    return value as Record<string, unknown>;
  }

  private parseTBankNotificationBody(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException(
        "T-Bank Acquiring notification body is invalid",
      );
    }

    return value as Record<string, unknown>;
  }

  private async processCdekOrderStatusWebhook(
    event: CdekOrderStatusWebhookEvent,
  ): Promise<ApplyCdekOrderStatusWebhookResult | undefined> {
    const result = await this.ordersStorage.applyCdekOrderStatusWebhook({
      cdekNumber: event.cdekNumber,
      externalUuid: event.externalUuid,
      orderNumber: event.orderNumber,
      raw: event.raw,
      statusCode: event.statusCode,
      statusDateTime: event.statusDateTime,
      statusName: event.statusName,
    });

    if (!result) {
      this.logger.warn(
        `CDEK webhook ignored: order not found for uuid=${event.externalUuid}, cdekNumber=${event.cdekNumber}, orderNumber=${event.orderNumber ?? "unknown"}`,
      );
      return;
    }

    return result;
  }

  private parseCdekOrderStatusWebhook(
    value: unknown,
  ): CdekOrderStatusWebhookEvent {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("CDEK webhook body is invalid");
    }

    const body = value as Record<string, unknown>;
    const attributes = this.parseObject(body.attributes, "attributes");
    const type = this.parseRequiredString(body.type, "type");

    if (type !== "ORDER_STATUS") {
      throw new BadRequestException("CDEK webhook type must be ORDER_STATUS");
    }

    const statusCode = this.parseRequiredString(
      attributes.code,
      "attributes.code",
    ).toUpperCase();

    return {
      cdekNumber: this.parseRequiredString(
        attributes.cdek_number,
        "attributes.cdek_number",
      ),
      deleted: attributes.deleted === true,
      externalUuid: this.parseRequiredString(body.uuid, "uuid"),
      orderNumber: this.parseOptionalString(attributes.number),
      raw: body,
      statusCode,
      statusDateTime:
        this.parseOptionalString(attributes.status_date_time) ??
        this.parseOptionalString(body.date_time),
      statusName: this.getCdekShipmentStatusLabel(statusCode),
    };
  }

  private parseObject(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException(`${field} must be an object`);
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

  private assertCdekWebhookSecret(secret: string) {
    const expectedSecret = process.env.CDEK_WEBHOOK_SECRET?.trim();

    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException("Invalid CDEK webhook secret");
    }
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

  private getInternalErrorDiagnostic(error: unknown) {
    if (error instanceof HttpException) {
      return this.stringifyProviderDiagnostic({
        cause: error.cause,
        response: error.getResponse(),
        status: error.getStatus(),
      });
    }

    return this.stringifyProviderDiagnostic(
      error instanceof Error
        ? { message: error.message, name: error.name }
        : error,
    );
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

    const name = this.parseRequiredString(customer.name, "customer.name");
    const phone = this.parseRequiredString(customer.phone, "customer.phone");
    const email = this.parseEmail(customer.email);

    if (name.length > 120) {
      throw new BadRequestException("customer.name must be 120 characters or less");
    }
    if (!/^[А-ЯЁа-яё]+(?:[ -][А-ЯЁа-яё]+)*$/.test(name)) {
      throw new BadRequestException("customer.name must contain only Russian letters and single separators");
    }
    if (phone.length > 18 || !/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone)) {
      throw new BadRequestException("customer.phone must match +7 (999) 999-99-99");
    }
    if (email.length > 254) {
      throw new BadRequestException("customer.email must be 254 characters or less");
    }

    return { name, phone, email };
  }

  private parseDeliverySelection(value: unknown): DeliverySelection {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("delivery is required");
    }

    const delivery = value as Record<string, unknown>;
    const provider = delivery.provider;
    const pickupPointId = delivery.pickupPointId;

    if (provider !== "ozon" && provider !== "cdek") {
      throw new BadRequestException("delivery.provider must be ozon or cdek");
    }

    return {
      cityCode: this.parseOptionalPositiveInteger(
        delivery.cityCode,
        "delivery.cityCode",
      ),
      pickupPointAddress: this.parseOptionalString(delivery.pickupPointAddress),
      pickupPointId:
        typeof pickupPointId === "string" && pickupPointId.trim()
          ? pickupPointId
          : undefined,
      provider,
    };
  }

  private assertOzonDeliveryAvailable(
    selection: DeliverySelection,
    cart: CartDTO,
  ) {
    if (selection.provider === "ozon" && !cart.isOzonDeliveryAvailable) {
      throw new BadRequestException(ozonDeliveryUnavailableMessage);
    }
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

  private async notifyCustomerAboutStatusChange(
    result: {
      order: OrderDTO;
      previousStatus: OrderStatus;
      nextStatus: OrderStatus;
      userId?: string;
    },
    options: { sendEmail?: boolean } = {},
  ) {
    await Promise.all([
      options.sendEmail === false
        ? undefined
        : this.sendOrderStatusChangedEmail(result),
      result.userId
        ? this.sendOrderStatusChangedTelegram(result, result.userId)
        : undefined,
    ]);
  }

  private async sendOrderStatusChangedTelegram(
    result: {
      order: OrderDTO;
      previousStatus: OrderStatus;
      nextStatus: OrderStatus;
    },
    userId: string,
  ) {
    try {
      const chatId = await this.ordersStorage.getUserTelegramChatId(userId);

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

  private async notifyAdminAboutCdekShipmentStatusChanged(
    input: ApplyCdekOrderStatusWebhookResult,
  ) {
    try {
      await this.ordersTelegramService.sendCdekShipmentStatusChanged({
        isReadyForPickup: this.isCdekReadyForPickupStatus(
          input.nextShipmentStatusCode,
        ),
        nextStatusCode: input.nextShipmentStatusCode,
        nextStatusName: this.getCdekShipmentStatusLabel(
          input.nextShipmentStatusCode,
        ),
        order: input.order,
        previousStatusCode: input.previousShipmentStatusCode,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send Telegram CDEK shipment notification for order ${input.order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async notifyCdekShipmentStatusChanged(
    input: ApplyCdekOrderStatusWebhookResult,
  ) {
    await Promise.all([
      this.notifyAdminAboutCdekShipmentStatusChanged(input),
      this.sendCdekShipmentStatusChangedEmail(input),
      input.userId
        ? this.sendCdekShipmentStatusChangedTelegram(input, input.userId)
        : undefined,
    ]);
  }

  private async sendCdekShipmentStatusChangedTelegram(
    input: ApplyCdekOrderStatusWebhookResult,
    userId: string,
  ) {
    try {
      const chatId = await this.ordersStorage.getUserTelegramChatId(userId);

      if (!chatId) {
        return;
      }

      await this.ordersTelegramService.sendCdekShipmentStatusChangedToCustomer({
        chatId,
        isReadyForPickup: this.isCdekReadyForPickupStatus(
          input.nextShipmentStatusCode,
        ),
        nextStatusCode: input.nextShipmentStatusCode,
        nextStatusName: this.getCdekShipmentStatusLabel(
          input.nextShipmentStatusCode,
        ),
        order: input.order,
        previousStatusCode: input.previousShipmentStatusCode,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send customer Telegram CDEK shipment notification for order ${input.order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private queueCdekShipmentStatusNotifications(
    input: ApplyCdekOrderStatusWebhookResult,
  ) {
    return this.notifyCdekShipmentStatusChanged(input);
  }

  private queueOrderPaidNotifications(
    order: OrderDTO,
    userId: string | undefined,
    previousStatus: OrderStatus,
  ) {
    return this.notifyOrderPaid(order, userId, previousStatus);
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
      this.notifyCustomerAboutStatusChange(
        {
          order: notificationOrder,
          previousStatus,
          nextStatus: "paid",
          userId,
        },
        { sendEmail: false },
      ),
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
      const customerPhone = order.customer.phone;
      if (!customerPhone) {
        throw new BadRequestException("CDEK shipment requires customer phone");
      }

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
        customer: { ...order.customer, phone: customerPhone },
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

  private async deleteCdekShipmentForCancelledOrder(
    order: AdminOrderDTO,
  ): Promise<AdminOrderDTO> {
    if (order.delivery.provider !== "cdek") {
      return order;
    }

    const shipment = order.shipments.find((item) => item.provider === "cdek");

    if (!shipment || shipment.statusCode?.toUpperCase() === "REMOVED") {
      return order;
    }

    const externalUuid = await this.getCdekShipmentUuidForDelete(
      order.id,
      shipment,
    );

    if (!externalUuid) {
      return this.ordersStorage.getAdminOrder(order.id);
    }

    try {
      const deleteResult =
        await this.deliveryService.deleteCdekOrder(externalUuid);

      await this.ordersStorage.upsertOrderShipment({
        orderId: order.id,
        provider: "cdek",
        ...deleteResult,
        requestState: this.getCdekDeleteRequestState(deleteResult.requestState),
        syncedAt: new Date(),
      });
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);

      await this.ordersStorage.upsertOrderShipment({
        orderId: order.id,
        provider: "cdek",
        errorMessage,
        externalNumber: shipment.externalNumber,
        externalUuid,
        requestState: "DELETE_ERROR",
        syncedAt: new Date(),
      });

      this.logger.warn(
        `Failed to delete CDEK shipment for cancelled order ${order.id}: ${errorMessage}`,
      );
    }

    return this.ordersStorage.getAdminOrder(order.id);
  }

  private async getCdekShipmentUuidForDelete(
    orderId: string,
    shipment: AdminOrderDTO["shipments"][number],
  ) {
    if (shipment.externalUuid) {
      return shipment.externalUuid;
    }

    if (!shipment.externalNumber) {
      return undefined;
    }

    try {
      const syncedShipment = await this.deliveryService.getCdekOrderByNumber(
        shipment.externalNumber,
      );

      await this.ordersStorage.upsertOrderShipment({
        orderId,
        provider: "cdek",
        ...syncedShipment,
        syncedAt: new Date(),
      });

      return syncedShipment.externalUuid;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);

      await this.ordersStorage.upsertOrderShipment({
        orderId,
        provider: "cdek",
        errorMessage,
        externalNumber: shipment.externalNumber,
        requestState: "DELETE_ERROR",
        syncedAt: new Date(),
      });

      this.logger.warn(
        `Failed to resolve CDEK shipment UUID for cancelled order ${orderId}: ${errorMessage}`,
      );

      return undefined;
    }
  }

  private getCdekDeleteRequestState(state: string | undefined) {
    return state ? `DELETE_${state}` : "DELETE_ACCEPTED";
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
        ...order.shipments.filter(
          (item) => item.provider !== shipment.provider,
        ),
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

  private queueOrderCreatedNotifications(
    order: OrderDTO,
    userId: string | undefined,
  ) {
    return this.notifyOrderCreated(order, userId);
  }

  private async notifyOrderCreated(
    order: OrderDTO,
    userId: string | undefined,
  ) {
    await Promise.all([
      this.notifyAdminAboutOrderCreated(order),
      this.notifyCustomerAboutOrderCreated(order, userId),
    ]);
  }

  private async notifyCustomerAboutOrderCreated(
    order: OrderDTO,
    userId: string | undefined,
  ) {
    await Promise.all([
      this.sendOrderCreatedEmail(order),
      userId ? this.sendOrderCreatedTelegram(order, userId) : undefined,
    ]);
  }

  private async sendOrderCreatedEmail(order: OrderDTO) {
    try {
      await this.notificationQueueService.enqueueEmail({
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
      await this.notificationQueueService.enqueueEmail({
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

  private async sendOrderStatusChangedEmail(input: {
    order: OrderDTO;
    previousStatus: OrderStatus;
    nextStatus: OrderStatus;
  }) {
    try {
      await this.notificationQueueService.enqueueEmail({
        to: input.order.customer.email,
        subject: `Статус заказа ${input.order.id} изменен - Artmate`,
        text: this.renderOrderStatusChangedTextEmail(input),
        html: this.renderOrderStatusChangedHtmlEmail(input),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send customer status email for order ${input.order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async sendCdekShipmentStatusChangedEmail(
    input: ApplyCdekOrderStatusWebhookResult,
  ) {
    try {
      await this.notificationQueueService.enqueueEmail({
        to: input.order.customer.email,
        subject: this.getCdekShipmentStatusEmailSubject(input),
        text: this.renderCdekShipmentStatusChangedTextEmail(input),
        html: this.renderCdekShipmentStatusChangedHtmlEmail(input),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send customer CDEK shipment status email for order ${input.order.id}: ${
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
      order.customer.phone ? `Телефон: ${order.customer.phone}` : undefined,
      "",
      renderSupportEmailFooterText(),
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");
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
          ...(order.customer.phone
            ? [{ label: "Телефон", value: order.customer.phone }]
            : []),
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

  private renderOrderStatusChangedTextEmail(input: {
    order: OrderDTO;
    previousStatus: OrderStatus;
    nextStatus: OrderStatus;
  }) {
    return [
      "ARTMATE",
      "",
      `Статус заказа ${input.order.id} изменен.`,
      "",
      `${input.order.customer.name}, мы обновили информацию по вашему заказу.`,
      `Было: ${orderStatusLabels[input.previousStatus]}`,
      `Стало: ${orderStatusLabels[input.nextStatus]}`,
      "",
      ...this.getOrderStatusChangedTextHint(input.nextStatus),
      "",
      renderSupportEmailFooterText(),
    ].join("\n");
  }

  private renderOrderStatusChangedHtmlEmail(input: {
    order: OrderDTO;
    previousStatus: OrderStatus;
    nextStatus: OrderStatus;
  }) {
    const escapedOrderId = escapeEmailHtml(input.order.id);
    const escapedName = escapeEmailHtml(input.order.customer.name);

    return renderBrandedEmail({
      title: "Статус заказа изменен",
      previewText: `Статус заказа ${input.order.id}: ${orderStatusLabels[input.nextStatus]}.`,
      contentHtml: `
        ${renderEmailParagraph(
          `${escapedName}, мы обновили информацию по заказу ${escapedOrderId}.`,
        )}
        ${renderEmailDetails([
          { label: "Было", value: orderStatusLabels[input.previousStatus] },
          { label: "Стало", value: orderStatusLabels[input.nextStatus] },
        ])}
        ${renderEmailNotice(
          escapeEmailHtml(
            this.getOrderStatusChangedTextHint(input.nextStatus).join(" "),
          ),
        )}
      `,
      footerHtml: renderSupportEmailFooter(),
    });
  }

  private renderCdekShipmentStatusChangedTextEmail(
    input: ApplyCdekOrderStatusWebhookResult,
  ) {
    const statusLabel = this.getCdekShipmentStatusLabel(
      input.nextShipmentStatusCode,
    );
    const previousStatusLabel = input.previousShipmentStatusCode
      ? this.getCdekShipmentStatusLabel(input.previousShipmentStatusCode)
      : undefined;
    const trackNumber = this.getCdekTrackNumber(input.order);
    const isReadyForPickup = this.isCdekReadyForPickupStatus(
      input.nextShipmentStatusCode,
    );

    return [
      "ARTMATE",
      "",
      isReadyForPickup
        ? `Заказ ${input.order.id} можно забрать в ПВЗ.`
        : `Статус доставки заказа ${input.order.id} изменен.`,
      "",
      `${input.order.customer.name}, доставка СДЭК обновила статус заказа.`,
      previousStatusLabel ? `Было: ${previousStatusLabel}` : undefined,
      `Стало: ${statusLabel}`,
      trackNumber ? `Трек-номер СДЭК: ${trackNumber}` : undefined,
      "",
      ...this.getCdekShipmentStatusTextHint(input),
      "",
      `ПВЗ: ${input.order.delivery.pickupPoint.address}`,
      `График: ${input.order.delivery.pickupPoint.workHours}`,
      "",
      renderSupportEmailFooterText(),
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");
  }

  private renderCdekShipmentStatusChangedHtmlEmail(
    input: ApplyCdekOrderStatusWebhookResult,
  ) {
    const escapedOrderId = escapeEmailHtml(input.order.id);
    const escapedName = escapeEmailHtml(input.order.customer.name);
    const statusLabel = this.getCdekShipmentStatusLabel(
      input.nextShipmentStatusCode,
    );
    const previousStatusLabel = input.previousShipmentStatusCode
      ? this.getCdekShipmentStatusLabel(input.previousShipmentStatusCode)
      : undefined;
    const trackNumber = this.getCdekTrackNumber(input.order);

    return renderBrandedEmail({
      title: this.isCdekReadyForPickupStatus(input.nextShipmentStatusCode)
        ? "Заказ можно забрать"
        : "Статус доставки изменен",
      previewText: `Статус доставки заказа ${input.order.id}: ${statusLabel}.`,
      contentHtml: `
        ${renderEmailParagraph(
          `${escapedName}, доставка СДЭК обновила статус заказа ${escapedOrderId}.`,
        )}
        ${renderEmailDetails(
          [
            previousStatusLabel
              ? { label: "Было", value: previousStatusLabel }
              : undefined,
            { label: "Стало", value: statusLabel },
            trackNumber
              ? { label: "Трек-номер СДЭК", value: trackNumber }
              : undefined,
            {
              label: "ПВЗ",
              value: input.order.delivery.pickupPoint.address,
            },
            {
              label: "График",
              value: input.order.delivery.pickupPoint.workHours,
            },
          ].filter((row): row is { label: string; value: string } =>
            Boolean(row),
          ),
        )}
        ${renderEmailNotice(
          escapeEmailHtml(this.getCdekShipmentStatusTextHint(input).join(" ")),
        )}
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

  private getOrderStatusChangedTextHint(status: OrderStatus) {
    switch (status) {
      case "new":
      case "in_progress":
        return ["Мы работаем с заказом и сообщим, когда он перейдет дальше."];
      case "waiting_payment":
        return ["Заказ ожидает оплаты. Детали доступны в личном кабинете."];
      case "paid":
        return ["Оплата получена. Скоро передадим заказ в доставку."];
      case "delivering":
        return ["Заказ передан в доставку."];
      case "completed":
        return ["Заказ завершен. Спасибо, что выбрали Artmate."];
      case "cancelled":
        return ["Заказ отменен. Если это ошибка, свяжитесь с нами."];
    }
  }

  private getCdekShipmentStatusTextHint(
    input: ApplyCdekOrderStatusWebhookResult,
  ) {
    if (this.isCdekReadyForPickupStatus(input.nextShipmentStatusCode)) {
      return [
        "Заказ уже можно забрать в выбранном ПВЗ.",
        "Возьмите с собой документ, если его попросят при выдаче.",
      ];
    }

    switch (input.nextShipmentStatusCode.toUpperCase()) {
      case "DELIVERED":
      case "POSTOMAT_RECEIVED":
        return ["Заказ отмечен как полученный."];
      case "NOT_DELIVERED":
        return [
          "СДЭК отметил заказ как неврученный.",
          "Если нужна помощь, напишите нам в поддержку.",
        ];
      case "REMOVED":
        return ["Отправление удалено в СДЭК."];
      case "INVALID":
        return [
          "СДЭК сообщил о проблеме с отправлением.",
          "Мы проверим данные заказа.",
        ];
      default:
        return ["Мы сообщим, когда заказ можно будет забрать."];
    }
  }

  private getCdekShipmentStatusEmailSubject(
    input: ApplyCdekOrderStatusWebhookResult,
  ) {
    if (this.isCdekReadyForPickupStatus(input.nextShipmentStatusCode)) {
      return `Заказ ${input.order.id} можно забрать в ПВЗ - Artmate`;
    }

    return `Статус доставки заказа ${input.order.id} изменен - Artmate`;
  }

  private getOrderCreatedEmailSubject(order: OrderDTO) {
    if (this.isOnlineAcquiringOrder(order)) {
      return `Заказ ${order.id} ожидает оплаты - Artmate`;
    }

    return `Заказ ${order.id} принят - Artmate`;
  }

  private getOrderCreatedTextTitle(order: OrderDTO) {
    if (this.isOnlineAcquiringOrder(order)) {
      return `Заказ ${order.id} ожидает оплаты.`;
    }

    return `Заказ ${order.id} принят.`;
  }

  private getOrderCreatedHtmlTitle(order: OrderDTO) {
    return this.isOnlineAcquiringOrder(order)
      ? "Заказ ожидает оплаты"
      : "Заказ принят";
  }

  private getOrderCreatedPreviewText(order: OrderDTO) {
    if (this.isOnlineAcquiringOrder(order)) {
      return `Заказ ${order.id} оформлен, ожидается оплата.`;
    }

    return `Заказ ${order.id} принят Artmate.`;
  }

  private getOrderCreatedTextIntro(order: OrderDTO) {
    if (this.isOnlineAcquiringOrder(order)) {
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
    if (this.isOnlineAcquiringOrder(order)) {
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
    const normalizedStatusCode = statusCode.trim().toUpperCase();
    const exactLabel = cdekShipmentStatusLabels[normalizedStatusCode];

    if (exactLabel) {
      return exactLabel;
    }

    if (
      normalizedStatusCode.includes("TRANSIT") ||
      normalizedStatusCode.includes("TRANSPORT") ||
      normalizedStatusCode.includes("SHIPMENT") ||
      normalizedStatusCode.includes("SHIPPED") ||
      normalizedStatusCode.includes("SENT")
    ) {
      return "В пути";
    }

    return normalizedStatusCode;
  }

  private isCdekReadyForPickupStatus(statusCode: string) {
    return cdekReadyForPickupStatusCodes.has(statusCode.trim().toUpperCase());
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
