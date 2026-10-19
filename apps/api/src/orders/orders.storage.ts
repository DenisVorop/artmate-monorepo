import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { OrderActivationService } from "../auth/order-activation.service";
import { AnalyticsOutboxService } from "../analytics/analytics-outbox.service";
import { parseYandexAttribution } from "../analytics/yandex-attribution";
import { AffiliateFinancialAccountingService } from "../affiliate/financial-accounting.service";
import type { CartItemDTO } from "../cart/dto";
import type { DeliveryCartItem } from "../delivery/providers/delivery-provider.interface";
import {
  OrderDeliveryProvider as PrismaOrderDeliveryProvider,
  OrderCrmStatus as PrismaOrderCrmStatus,
  OrderPaymentMethod as PrismaOrderPaymentMethod,
  OrderPaymentStatus as PrismaOrderPaymentStatus,
  OrderStatus as PrismaOrderStatus,
  Prisma,
  type Order,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  parseShippingPackageSnapshot,
  type ShippingPackageSnapshot,
} from "../products/shipping-package-profile";
import type { OzonAcquiringVerifiedNotification } from "../ozon/ozon-acquiring.service";
import { calculatePromoPricing } from "../promocodes/pricing";
import {
  PromocodesService,
  kopecksToRubles,
  rublesToKopecks,
} from "../promocodes/promocodes.service";

import type {
  AdminOrderCommentDTO,
  AdminOrderHistoryEventDTO,
  AdminOrderDTO,
  CreateOrderCustomerRequestDTO,
  OrderDTO,
  OrderDeliveryDTO,
  OrderPaymentDTO,
  OrderShipmentDTO,
} from "./dto";
import type {
  CreateOrderPaymentMethod,
  DeliveryProvider,
  OrderStatus,
  PaymentMethod,
} from "./orders.constants";
import { ORDER_PAYMENT_INITIALIZATION_WAIT_TIMEOUT_MS } from "./orders.constants";
import type { OrderReceiptItemPricing } from "./payment-receipt";
import {
  createOrderPricingSnapshot,
  assertOrderPricingMatches,
} from "./pricing/pricing-snapshot";
import { readOrderPricing } from "./pricing/read-order-pricing";
import { readPurchaseRateSnapshot } from "./pricing/purchase-rate";
import { OrdersLoyaltyService } from "./orders-loyalty.service";
import { publishTrackingRequest } from "./delivery-status/publish-tracking-request";
import type { OrderPricingSnapshot } from "./pricing/pricing-snapshot";

const CHECKOUT_SUCCESS_PATH = "/checkout/success";
const CHECKOUT_FAILURE_PATH = "/checkout/failure";
const CHECKOUT_PATH = "/checkout";
const PAYMENT_INITIALIZING_PATH = "/checkout/payment-initializing";

const orderInclude = {
  items: {
    orderBy: {
      createdAt: "asc",
    },
  },
  shipments: {
    orderBy: {
      createdAt: "asc",
    },
  },
} as const;

const adminOrderInclude = {
  ...orderInclude,
  adminComments: {
    orderBy: {
      createdAt: "asc",
    },
    include: {
      author: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
    },
  },
  history: {
    orderBy: {
      createdAt: "asc",
    },
    include: {
      author: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

type CreateStoredOrderInput = {
  userId?: string;
  cartId: string;
  checkoutAttemptId: string;
  checkoutPayloadFingerprint: string;
  attribution?: { clientId?: string; yclid?: string };
  customer: CreateOrderCustomerRequestDTO;
  delivery: OrderDeliveryDTO;
  items: Array<CartItemDTO & { shippingPackage?: ShippingPackageSnapshot }>;
  itemsCount: number;
  paymentMethod: CreateOrderPaymentMethod;
  promoCode?: string;
  subtotal: number;
  comment?: string;
  loyaltyPointsToSpend?: number;
  loyaltyPricingRevision?: string;
};

type AttachOzonAcquiringPaymentInput = {
  acquiringOrderId?: string;
  isTestMode?: boolean;
  paymentId?: string;
  redirectUrl: string;
};

type MarkOzonAcquiringPaymentFailedInput = {
  errorCode?: string;
  errorMessage: string;
};

type ApplyOzonAcquiringNotificationInput = {
  acquiringOrderId?: string;
  amount?: string;
  authoritativeStatus?: string;
  currencyCode?: string;
  errorCode?: string;
  errorMessage?: string;
  extOrderId?: string;
  extTransactionId?: string;
  paymentMethod?: string;
  raw: Record<string, unknown>;
  verified: OzonAcquiringVerifiedNotification;
};

type AttachTBankAcquiringPaymentInput = {
  acquiringOrderId?: string;
  paymentId?: string;
  redirectUrl: string;
};

type MarkTBankAcquiringPaymentFailedInput = {
  errorCode?: string;
  errorMessage: string;
};

type ApplyTBankAcquiringNotificationInput = {
  amount?: string;
  errorCode?: string;
  errorMessage?: string;
  orderId?: string;
  paymentId?: string;
  raw: Record<string, unknown>;
  rawStatus?: string;
  status?: string;
  success?: boolean;
  terminalKey?: string;
};

type ApplyOzonAcquiringNotificationResult = {
  order: OrderDTO;
  paymentStatusChangedToPaid: boolean;
  previousStatus: OrderStatus;
  userId?: string;
};

type ApplyTBankAcquiringNotificationResult =
  ApplyOzonAcquiringNotificationResult;

type ApplyCdekOrderStatusWebhookInput = {
  cdekNumber: string;
  externalUuid: string;
  orderNumber?: string;
  raw: Record<string, unknown>;
  statusCode: string;
  statusDateTime?: string;
  statusName?: string;
};

export type ApplyCdekOrderStatusWebhookResult = {
  order: OrderDTO;
  previousShipmentStatusCode?: string;
  nextShipmentStatusCode: string;
  shipmentStatusChanged: boolean;
  userId?: string;
};

type UpsertOrderShipmentInput = {
  errorMessage?: string;
  externalNumber?: string;
  externalUuid?: string;
  orderId: string;
  provider: DeliveryProvider;
  requestPayload?: unknown;
  requestState?: string;
  requestUuid?: string;
  responsePayload?: unknown;
  statusCode?: string;
  statusName?: string;
  syncedAt?: Date;
};

type ClaimOrderShipmentCreationResult = {
  shipment: OrderShipmentDTO;
  shouldCreate: boolean;
};

type StoredOrder = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

type StoredAdminOrder = Prisma.OrderGetPayload<{
  include: typeof adminOrderInclude;
}>;

type StoredOrderShipment = Prisma.OrderShipmentGetPayload<object>;

export type UpdateAdminOrderStatusResult = {
  order: AdminOrderDTO;
  changed: boolean;
  previousStatus: OrderStatus;
  nextStatus: OrderStatus;
  userId?: string;
};

@Injectable()
export class OrdersStorage {
  private readonly logger = new Logger(OrdersStorage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promocodesService: PromocodesService,
    private readonly orderActivationService: OrderActivationService,
    private readonly analyticsOutboxService: AnalyticsOutboxService,
    private readonly affiliateFinancialAccountingService: AffiliateFinancialAccountingService,
    private readonly ordersLoyaltyService: OrdersLoyaltyService,
  ) {}

  async createOrder(input: CreateStoredOrderInput): Promise<OrderDTO> {
    const loyaltyPoints =
      input.loyaltyPointsToSpend === undefined ? 0 : input.loyaltyPointsToSpend;
    if (
      !Number.isSafeInteger(loyaltyPoints) ||
      loyaltyPoints < 0 ||
      (loyaltyPoints > 0 && !input.userId)
    ) {
      throw new BadRequestException("Invalid loyalty spending request");
    }
    // Validate and copy every snapshot before any database or account operation.
    const shippingPackages =
      input.delivery.provider === "cdek"
        ? input.items.map((item) =>
            parseShippingPackageSnapshot(item.shippingPackage),
          )
        : undefined;
    const attribution = parseYandexAttribution(input.attribution);
    const deliveryPrice = input.delivery.pickupPoint.deliveryPrice;
    const deliveryKopecks = rublesToKopecks(deliveryPrice);
    const pricingItems = input.items.map((item) => ({
      id: item.id,
      unitPriceKopecks: rublesToKopecks(item.price),
      quantity: item.quantity,
    }));
    const basePricing = calculatePromoPricing(pricingItems, {
      type: "fixed",
      amountKopecks: 0,
    });
    const baseSnapshot = createOrderPricingSnapshot(
      basePricing,
      deliveryKopecks,
    );
    assertOrderPricingMatches(baseSnapshot, {
      subtotalKopecks: rublesToKopecks(input.subtotal),
      discountKopecks: 0,
      deliveryKopecks,
      totalKopecks: baseSnapshot.totalKopecks,
      items: input.items.map((item) => ({
        id: item.id,
        unitPriceKopecks: rublesToKopecks(item.price),
        quantity: item.quantity,
        lineTotalKopecks: rublesToKopecks(item.lineTotal),
      })),
    });
    const userId = input.userId
      ? await this.getExistingUserId(input.userId)
      : undefined;
    const affiliateOwnerUserId = input.promoCode
      ? await this.promocodesService.getAffiliateOwnerUserId(input.promoCode)
      : undefined;
    const guestUserId =
      affiliateOwnerUserId && !userId
        ? await this.getExistingUserIdByEmail(input.customer.email)
        : undefined;
    const checkoutUserLockIds =
      affiliateOwnerUserId || loyaltyPoints > 0
        ? [...new Set([affiliateOwnerUserId, userId, guestUserId])]
            .filter((id): id is string => id !== undefined)
            .sort()
        : [];
    const deliveryProvider = this.toPrismaDeliveryProvider(
      input.delivery.provider,
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = this.createOrderId();

      try {
        const order = await this.prisma.$transaction(async (tx) => {
          if (checkoutUserLockIds.length > 0) {
            // Lock buyer and affiliate owner in one stable order before order FKs.
            await tx.$queryRaw(
              Prisma.sql`SELECT "id" FROM "users" WHERE "id" IN (${Prisma.join(checkoutUserLockIds)}) ORDER BY "id" FOR UPDATE`,
            );
          }
          await tx.order.create({
            data: {
              id,
              userId,
              checkoutActorUserId: userId,
              cartId: input.cartId,
              checkoutAttemptId: input.checkoutAttemptId,
              checkoutPayloadFingerprint: input.checkoutPayloadFingerprint,
              yandexClientId: attribution.clientId,
              yandexYclid: attribution.yclid,
              status: PrismaOrderStatus.PENDING_PAYMENT,
              crmStatus: PrismaOrderCrmStatus.WAITING_PAYMENT,
              customerName: input.customer.name,
              customerPhone: input.customer.phone,
              customerEmail: input.customer.email,
              deliveryProvider,
              pickupPointId: input.delivery.pickupPoint.id,
              pickupPointTitle: input.delivery.pickupPoint.title,
              pickupPointAddress: input.delivery.pickupPoint.address,
              pickupPointWorkHours: input.delivery.pickupPoint.workHours,
              deliveryPrice,
              paymentMethod: this.toPrismaPaymentMethod(input.paymentMethod),
              paymentStatus: PrismaOrderPaymentStatus.PENDING,
              paymentRedirectUrl: `${CHECKOUT_SUCCESS_PATH}?orderId=${encodeURIComponent(id)}`,
              itemsCount: input.itemsCount,
              subtotal: input.subtotal,
              total: kopecksToRubles(baseSnapshot.totalKopecks),
              currency: "RUB",
              comment: input.comment,
              history: {
                create: {
                  authorId: userId,
                  eventType: "status_changed",
                  payload: this.toPrismaJson({
                    fromStatus: null,
                    source: "order_created",
                    toStatus: "waiting_payment",
                  }),
                },
              },
              items: {
                create: input.items.map((item, index) => ({
                  productId: item.id,
                  title: item.title,
                  slug: item.slug,
                  price: item.price,
                  category: item.category ?? null,
                  categorySlug: item.categorySlug ?? null,
                  image: item.image,
                  quantity: item.quantity,
                  lineTotal: item.lineTotal,
                  ...(shippingPackages
                    ? {
                        shippingPackageSnapshot: this.toPrismaJson(
                          shippingPackages[index],
                        ),
                      }
                    : {}),
                })),
              },
            },
          });
          // Lock the account before a promo, matching the historical paid-guest
          // attachment path. Provisioning and its outbox still roll back if the
          // promo reservation fails later in this transaction.
          if (!userId) {
            if (!this.orderActivationService) {
              throw new Error("OrderActivationService is not configured");
            }
            await this.orderActivationService.attachGuestOrderInTransaction(
              tx,
              {
                id,
                userId: null,
                customerEmail: input.customer.email,
                customerName: input.customer.name,
                customerPhone: input.customer.phone,
              },
            );
          }
          let finalPricing = basePricing;
          if (input.promoCode) {
            const reservation =
              await this.promocodesService.reserveInTransaction(tx, {
                code: input.promoCode,
                orderId: id,
                userId,
                items: pricingItems,
              });
            finalPricing = reservation.pricingSnapshot;
          }
          let pricingSnapshot = createOrderPricingSnapshot(
            finalPricing,
            deliveryKopecks,
          );
          if (loyaltyPoints > 0) {
            pricingSnapshot =
              await this.ordersLoyaltyService.reserveInTransaction(tx, {
                orderId: id,
                userId,
                snapshot: pricingSnapshot,
                points: loyaltyPoints,
                pricingRevision: input.loyaltyPricingRevision,
              });
          }
          this.assertReceiptPricing(pricingSnapshot, input.paymentMethod);
          const attachedOrder = await tx.order.findUnique({
            where: { id },
            select: { userId: true },
          });
          if (!attachedOrder) throw new NotFoundException("Order not found");
          const purchaseRate = await readPurchaseRateSnapshot(tx, {
            orderId: id,
            userId: attachedOrder.userId,
          });
          await tx.order.update({
            where: { id },
            data: {
              discount: kopecksToRubles(pricingSnapshot.discountKopecks),
              total: kopecksToRubles(pricingSnapshot.totalKopecks),
              pricingSnapshot: this.toPrismaJson(pricingSnapshot),
              ...purchaseRate,
            },
          });
          const createdOrder = await tx.order.findUnique({
            where: { id },
            include: orderInclude,
          });
          if (!createdOrder) throw new NotFoundException("Order not found");
          if (!this.analyticsOutboxService) {
            throw new Error("AnalyticsOutboxService is not configured");
          }
          await this.analyticsOutboxService.enqueueOrderCreated(tx, {
            id: createdOrder.id,
            createdAt: createdOrder.createdAt,
            subtotal: createdOrder.subtotal,
            discount: createdOrder.discount,
            yandexClientId: createdOrder.yandexClientId,
            yandexYclid: createdOrder.yandexYclid,
          });
          return createdOrder;
        });

        return this.mapOrder(order);
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          const existing = await this.getOrderByCheckoutAttempt(
            input.checkoutAttemptId,
            input.cartId,
            input.userId,
            input.checkoutPayloadFingerprint,
          );
          if (existing) return existing;
          if (attempt < 2) continue;
        }

        throw error;
      }
    }

    throw new Error("Order id generation failed");
  }

  getPaymentReconciliationSource(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentMethod: true,
        paymentStatus: true,
        total: true,
        tbankAcquiringPaymentId: true,
        ozonAcquiringOrderId: true,
        paymentRecovery: { select: { orderId: true } },
      },
    });
  }

  // Only authoritative adapter results enter here. This is deliberately not a
  // synthetic webhook: signature validation and status lookup are distinct paths.
  applyPaymentReconciliation(input: {
    orderId: string;
    method: "TBANK_ACQUIRING" | "OZON_ACQUIRING";
    providerOrderId: string;
    paymentId?: string;
    amountKopecks: number;
    state: "paid" | "closed_unpaid" | "pending";
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, input.orderId);
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: orderInclude,
      });
      if (!order) throw new NotFoundException("Order not found");
      const job = await tx.orderPaymentRecovery.findUnique({
        where: { orderId: order.id },
      });
      if (
        !job ||
        order.paymentMethod !== input.method ||
        rublesToKopecks(order.total) !== input.amountKopecks
      ) {
        throw new ConflictException("Payment reconciliation source mismatch");
      }
      const isTBank = input.method === "TBANK_ACQUIRING";
      if (isTBank) {
        if (input.providerOrderId !== order.id || !input.paymentId)
          throw new ConflictException(
            "Payment reconciliation identity mismatch",
          );
        this.assertImmutableProviderId(
          "T-Bank order id",
          order.tbankAcquiringOrderId,
          input.providerOrderId,
        );
        this.assertImmutableProviderId(
          "T-Bank payment id",
          order.tbankAcquiringPaymentId,
          input.paymentId,
        );
      } else {
        if (!input.providerOrderId)
          throw new ConflictException(
            "Payment reconciliation identity mismatch",
          );
        this.assertImmutableProviderId(
          "Ozon order id",
          order.ozonAcquiringOrderId,
          input.providerOrderId,
        );
      }
      const previousStatus = this.mapOrderCrmStatus(order.crmStatus);
      const paymentStatusChangedToPaid =
        input.state === "paid" &&
        order.paymentStatus !== PrismaOrderPaymentStatus.PAID;
      if (paymentStatusChangedToPaid) {
        await this.markVerifiedProviderPaidInTransaction(tx, order, {
          provider: isTBank ? "tbank_acquiring" : "ozon_acquiring",
          source: "payment_reconciliation",
        });
      }
      if (input.state === "closed_unpaid") {
        await this.publishClosedUnpaidInTransaction(tx, order, {
          provider: isTBank ? "tbank_acquiring" : "ozon_acquiring",
          source: "payment_reconciliation",
          rawStatus: "CLOSED_UNPAID",
        });
      }
      // Pending responses never downgrade PAID or CLOSED_UNPAID. Provider IDs
      // can only be discovered once and remain stable across retries.
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          ...(isTBank
            ? {
                tbankAcquiringOrderId: input.providerOrderId,
                tbankAcquiringPaymentId: input.paymentId,
              }
            : { ozonAcquiringOrderId: input.providerOrderId }),
          ...(input.state === "paid"
            ? { paymentErrorCode: null, paymentErrorMessage: null }
            : {}),
        },
        include: orderInclude,
      });
      return {
        order: this.mapOrder(updatedOrder),
        paymentStatus: updatedOrder.paymentStatus,
        paymentStatusChangedToPaid,
        previousStatus,
        userId: updatedOrder.userId ?? undefined,
      };
    });
  }

  // The caller holds the order lock and has verified the provider identity,
  // amount and final unpaid state. Loyalty consumes the persisted event only.
  private async publishClosedUnpaidInTransaction(
    tx: Prisma.TransactionClient,
    order: Order,
    evidence: {
      provider: "tbank_acquiring" | "ozon_acquiring";
      source: string;
      rawStatus: string;
    },
  ) {
    if (
      order.paidAt ||
      order.paymentStatus === PrismaOrderPaymentStatus.PAID ||
      order.paymentStatus === PrismaOrderPaymentStatus.CLOSED_UNPAID
    )
      return;

    await this.promocodesService.releaseInTransaction(tx, order.id, evidence);
    const occurredAt = order.paymentClosedUnpaidAt ?? new Date();
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PrismaOrderPaymentStatus.CLOSED_UNPAID,
        paymentRedirectUrl: CHECKOUT_FAILURE_PATH,
        terminalPaymentFailedAt: order.terminalPaymentFailedAt ?? occurredAt,
        paymentClosedUnpaidAt: occurredAt,
      },
    });
    await tx.orderPaymentEvent.upsert({
      where: { orderId_kind: { orderId: order.id, kind: "CLOSED_UNPAID" } },
      create: { orderId: order.id, kind: "CLOSED_UNPAID", occurredAt },
      update: {},
    });
  }

  // Called only after a fresh authoritative check of all acquiring attempts.
  confirmTBankClosedUnpaid(input: {
    orderId: string;
    paymentId: string;
    amountKopecks: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, input.orderId);
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: orderInclude,
      });
      if (!order) throw new NotFoundException("Order not found");
      if (order.paymentStatus === PrismaOrderPaymentStatus.PAID || order.paidAt)
        return;
      if (
        order.paymentMethod !== PrismaOrderPaymentMethod.TBANK_ACQUIRING ||
        order.tbankAcquiringPaymentId !== input.paymentId ||
        !order.terminalPaymentFailedAt ||
        rublesToKopecks(order.total) !== input.amountKopecks
      ) {
        throw new ConflictException(
          "Payment closure evidence does not match order",
        );
      }
      const occurredAt = order.paymentClosedUnpaidAt ?? new Date();
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PrismaOrderPaymentStatus.CLOSED_UNPAID,
          paymentClosedUnpaidAt: occurredAt,
        },
      });
      await tx.orderPaymentEvent.upsert({
        where: { orderId_kind: { orderId: order.id, kind: "CLOSED_UNPAID" } },
        create: { orderId: order.id, kind: "CLOSED_UNPAID", occurredAt },
        update: {},
      });
    });
  }

  async getOrderByCheckoutAttempt(
    checkoutAttemptId: string,
    cartId: string,
    checkoutActorUserId: string | undefined,
    checkoutPayloadFingerprint: string,
  ): Promise<OrderDTO | undefined> {
    const order = await this.prisma.order.findUnique({
      where: { checkoutAttemptId },
      include: orderInclude,
    });
    if (!order) return undefined;

    if (
      order.cartId !== cartId ||
      (order.checkoutActorUserId ?? undefined) !== checkoutActorUserId ||
      order.checkoutPayloadFingerprint !== checkoutPayloadFingerprint
    ) {
      throw new ConflictException(
        "checkoutAttemptId is already used by another checkout",
      );
    }

    return this.mapOrder(order);
  }

  async claimPaymentInitialization(orderId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) throw new NotFoundException("Order not found");

      if (
        order.terminalPaymentFailedAt ||
        order.paymentStatus === PrismaOrderPaymentStatus.PAID ||
        order.paymentStatus === PrismaOrderPaymentStatus.CLOSED_UNPAID
      )
        return false;

      // A failed/timed-out request may still have created a payment. The local
      // marker never expires into permission to create another attempt. This
      // invariant applies to every order, independently of loyalty or provider.
      if (
        order.paymentStatus !== PrismaOrderPaymentStatus.PENDING ||
        !order.paymentRedirectUrl.startsWith(CHECKOUT_SUCCESS_PATH)
      )
        return false;

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentErrorCode: null,
          paymentErrorMessage: null,
          paymentRedirectUrl: `${PAYMENT_INITIALIZING_PATH}?startedAt=${Date.now()}`,
          paymentStatus: PrismaOrderPaymentStatus.PENDING,
        },
      });
      // Durable before the external request: a crash or timeout cannot orphan
      // the original payment, nor grant permission for another Init.
      const [schedule] = await tx.$queryRaw<Array<{ nextAttemptAt: Date }>>`
        SELECT clock_timestamp() + INTERVAL '60 seconds' AS "nextAttemptAt"
      `;
      if (!schedule)
        throw new Error("Database recovery schedule is unavailable");
      await tx.orderPaymentRecovery.create({
        data: { orderId, nextAttemptAt: schedule.nextAttemptAt },
      });
      return true;
    });
  }

  async waitForPaymentInitialization(orderId: string): Promise<OrderDTO> {
    const deadline = Date.now() + ORDER_PAYMENT_INITIALIZATION_WAIT_TIMEOUT_MS;

    do {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) throw new NotFoundException("Order not found");
      if (
        order.paymentStatus !== PrismaOrderPaymentStatus.PENDING ||
        !this.getPaymentInitializationStartedAt(order.paymentRedirectUrl)
      ) {
        return this.mapOrder(order);
      }
      await this.delay(50);
    } while (Date.now() < deadline);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order not found");

    return this.mapOrder(order);
  }

  async consumeOrderCartSnapshot(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) throw new NotFoundException("Order not found");
      if (!order.checkoutAttemptId) return;
      if (
        order.cartConsumedAt ||
        order.cartRestoredAt ||
        order.terminalPaymentFailedAt ||
        order.paymentStatus === PrismaOrderPaymentStatus.CLOSED_UNPAID ||
        !this.isSecurePaymentRedirect(order.paymentRedirectUrl)
      ) {
        return;
      }

      await this.consumeOrderItemsInTransaction(
        tx,
        order,
        "payment_initialization",
      );
    });
  }

  async recoverGuestPayment(
    orderId: string,
    cartId: string | undefined,
  ): Promise<{ redirectUrl: string | null }> {
    if (!cartId) throw new NotFoundException("Order not found");

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order || order.cartId !== cartId) {
        throw new NotFoundException("Order not found");
      }

      if (order.checkoutActorUserId) {
        throw new NotFoundException("Order not found");
      }
      if (order.paymentStatus === PrismaOrderPaymentStatus.PAID) {
        return { redirectUrl: CHECKOUT_SUCCESS_PATH };
      }

      if (
        order.terminalPaymentFailedAt ||
        order.paymentStatus === PrismaOrderPaymentStatus.CLOSED_UNPAID
      ) {
        if (!order.cartRestoredAt) {
          const restoredQuantities = order.cartConsumedAt
            ? await this.restoreOrderItemsInTransaction(tx, order)
            : {};
          const restoredAt = new Date();
          await tx.order.update({
            where: { id: order.id },
            data: {
              cartRestoredAt: restoredAt,
              cartRestoredQuantities: this.toPrismaJson(restoredQuantities),
            },
          });
          await tx.orderHistory.create({
            data: {
              orderId: order.id,
              eventType: "cart_restored",
              payload: this.toPrismaJson({
                source: "guest_payment_recovery",
              }),
            },
          });
        }
        return { redirectUrl: CHECKOUT_PATH };
      }

      return {
        redirectUrl: this.isSecurePaymentRedirect(order.paymentRedirectUrl)
          ? order.paymentRedirectUrl
          : null,
      };
    });
  }

  async getOrder(orderId: string, userId: string): Promise<OrderDTO> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.mapOrder(order);
  }

  async getCdekShipmentItems(orderId: string): Promise<DeliveryCartItem[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        deliveryProvider: true,
        items: { orderBy: [{ createdAt: "asc" }, { productId: "asc" }] },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.deliveryProvider !== PrismaOrderDeliveryProvider.CDEK) {
      throw new BadRequestException({
        code: "ORDER_DELIVERY_PROVIDER_INVALID",
        message: "Заказ не использует доставку СДЭК.",
      });
    }

    return order.items.map((item) => ({
      id: item.productId,
      slug: item.slug,
      title: item.title,
      price: this.toNumber(item.price),
      quantity: item.quantity,
      lineTotal: this.toNumber(item.lineTotal),
      shippingPackage: parseShippingPackageSnapshot(
        item.shippingPackageSnapshot,
      ),
    }));
  }

  async getOrderReceiptPricing(
    orderId: string,
  ): Promise<OrderReceiptItemPricing[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    const snapshot = readOrderPricing(order);
    return snapshot.items.map((item) => {
      return {
        id: item.id,
        priceGroups: item.priceGroups.map((group) => {
          const { quantity, totalKopecks, unitPriceKopecks } = group;
          if (unitPriceKopecks <= 0) {
            throw new Error("Order receipt price must be positive");
          }
          return { quantity, totalKopecks, unitPriceKopecks };
        }),
      };
    });
  }

  async getOrdersByUserId(
    userId: string,
    pagination: { limit: number; offset: number } = { limit: 20, offset: 0 },
  ): Promise<OrderDTO[]> {
    if (!userId.trim()) {
      return [];
    }

    const orders = await this.prisma.order.findMany({
      where: {
        userId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pagination.limit,
      skip: pagination.offset,
      include: orderInclude,
    });

    return orders.map((order) => this.mapOrder(order));
  }

  async getAdminOrders(): Promise<AdminOrderDTO[]> {
    const orders = await this.prisma.order.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: adminOrderInclude,
    });

    return orders.map((order) => this.mapAdminOrder(order));
  }

  async getOrderShipment(
    orderId: string,
    provider: DeliveryProvider,
  ): Promise<OrderShipmentDTO | undefined> {
    const shipment = await this.prisma.orderShipment.findUnique({
      where: {
        orderId_provider: {
          orderId,
          provider: this.toPrismaDeliveryProvider(provider),
        },
      },
    });

    return shipment ? this.mapOrderShipment(shipment) : undefined;
  }

  async claimOrderShipmentCreation(
    orderId: string,
    provider: DeliveryProvider,
  ): Promise<ClaimOrderShipmentCreationResult> {
    const prismaProvider = this.toPrismaDeliveryProvider(provider);

    try {
      const shipment = await this.prisma.orderShipment.create({
        data: {
          orderId,
          provider: prismaProvider,
          requestState: "CREATING",
          syncedAt: new Date(),
        },
      });

      return {
        shipment: this.mapOrderShipment(shipment),
        shouldCreate: true,
      };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existingShipment = await this.prisma.orderShipment.findUnique({
        where: {
          orderId_provider: {
            orderId,
            provider: prismaProvider,
          },
        },
      });

      if (!existingShipment) {
        throw error;
      }

      if (
        existingShipment.externalUuid ||
        this.isFreshShipmentCreation(existingShipment)
      ) {
        return {
          shipment: this.mapOrderShipment(existingShipment),
          shouldCreate: false,
        };
      }

      const shipment = await this.prisma.orderShipment.update({
        where: {
          id: existingShipment.id,
        },
        data: {
          errorMessage: null,
          requestState: "CREATING",
          syncedAt: new Date(),
        },
      });

      return {
        shipment: this.mapOrderShipment(shipment),
        shouldCreate: true,
      };
    }
  }

  async upsertOrderShipment(
    input: UpsertOrderShipmentInput,
  ): Promise<OrderShipmentDTO> {
    const provider = this.toPrismaDeliveryProvider(input.provider);
    const data = {
      errorMessage: input.errorMessage ?? null,
      externalNumber: input.externalNumber,
      externalUuid: input.externalUuid,
      requestPayload:
        input.requestPayload === undefined
          ? undefined
          : this.toPrismaJson(input.requestPayload),
      requestState: input.requestState,
      requestUuid: input.requestUuid,
      responsePayload:
        input.responsePayload === undefined
          ? undefined
          : this.toPrismaJson(input.responsePayload),
      statusCode: input.statusCode,
      statusName: input.statusName,
      syncedAt: input.syncedAt,
    };
    const shipment = await this.prisma.orderShipment.upsert({
      where: {
        orderId_provider: {
          orderId: input.orderId,
          provider,
        },
      },
      create: {
        ...data,
        orderId: input.orderId,
        provider,
      },
      update: data,
    });

    return this.mapOrderShipment(shipment);
  }

  async updateAdminOrderStatus(
    orderId: string,
    status: OrderStatus,
    authorId: string,
  ): Promise<UpdateAdminOrderStatusResult> {
    const existingAuthorId = await this.getExistingUserId(authorId);
    const nextStatus = this.mapPrismaOrderStatus(status);

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          deliveryProvider: true,
          ozonPostingNumbers: true,
          ozonFbsPostingNumbers: true,
          crmStatus: true,
          paymentStatus: true,
          completedAt: true,
          userId: true,
        },
      });

      if (!existingOrder) {
        throw new NotFoundException("Order not found");
      }

      if (
        this.isPaidWorkflowStatus(status) &&
        existingOrder.paymentStatus !== PrismaOrderPaymentStatus.PAID
      ) {
        throw new ConflictException(
          "Payment must be confirmed by the payment provider before moving the order to the paid workflow",
        );
      }

      const previousStatus = this.mapOrderCrmStatus(existingOrder.crmStatus);
      const changed = existingOrder.crmStatus !== nextStatus;

      if (changed) {
        const completedAt =
          nextStatus === PrismaOrderCrmStatus.COMPLETED &&
          !existingOrder.completedAt
            ? new Date()
            : existingOrder.completedAt;
        if (
          existingOrder.crmStatus === PrismaOrderCrmStatus.COMPLETED &&
          nextStatus !== PrismaOrderCrmStatus.COMPLETED
        ) {
          await this.affiliateFinancialAccountingService.recordEligibilityLossInTransaction(
            tx,
            orderId,
          );
        }
        await tx.order.update({
          where: { id: orderId },
          data: {
            crmStatus: nextStatus,
            ...(completedAt && !existingOrder.completedAt
              ? { completedAt }
              : {}),
          },
        });
        if (nextStatus === PrismaOrderCrmStatus.COMPLETED && completedAt) {
          await this.affiliateFinancialAccountingService.recordCompletionInTransaction(
            tx,
            orderId,
            completedAt,
          );
        }
        await tx.orderHistory.create({
          data: {
            orderId,
            authorId: existingAuthorId,
            eventType: "status_changed",
            payload: this.toPrismaJson({
              fromStatus: previousStatus,
              toStatus: status,
            }),
          },
        });
        await publishTrackingRequest(tx, {
          ...existingOrder,
          crmStatus: nextStatus,
        });
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: adminOrderInclude,
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      return {
        order: this.mapAdminOrder(order),
        changed,
        previousStatus,
        nextStatus: status,
        userId: existingOrder.userId ?? undefined,
      };
    });
  }

  async getUserTelegramChatId(userId: string): Promise<string | undefined> {
    const account = await this.prisma.telegramAccount.findUnique({
      where: { userId },
      select: { telegramChatId: true },
    });

    return account?.telegramChatId;
  }

  async attachOzonAcquiringPayment(
    orderId: string,
    input: AttachOzonAcquiringPaymentInput,
  ): Promise<OrderDTO> {
    this.assertSecurePaymentRedirect(input.redirectUrl);
    const order = await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!existing) throw new NotFoundException("Order not found");
      this.assertNotificationPaymentMethod(
        existing.paymentMethod,
        PrismaOrderPaymentMethod.OZON_ACQUIRING,
      );
      this.assertImmutableProviderId(
        "Ozon order id",
        existing.ozonAcquiringOrderId,
        input.acquiringOrderId,
      );
      this.assertImmutableProviderId(
        "Ozon payment id",
        existing.ozonAcquiringPaymentId,
        input.paymentId,
      );
      return tx.order.update({
        where: { id: orderId },
        data: {
          ozonAcquiringOrderId:
            existing.ozonAcquiringOrderId ?? input.acquiringOrderId,
          ozonAcquiringPaymentId:
            existing.ozonAcquiringPaymentId ?? input.paymentId,
          paymentRedirectUrl:
            existing.paymentStatus === PrismaOrderPaymentStatus.PAID ||
            existing.paymentStatus === PrismaOrderPaymentStatus.CLOSED_UNPAID ||
            existing.terminalPaymentFailedAt
              ? existing.paymentRedirectUrl
              : input.redirectUrl,
          history: {
            create: {
              eventType: "payment_created",
              payload: this.toPrismaJson({
                acquiringOrderId: input.acquiringOrderId,
                isTestMode: input.isTestMode,
                paymentId: input.paymentId,
                provider: "ozon_acquiring",
              }),
            },
          },
        },
        include: orderInclude,
      });
    });

    return this.mapOrder(order);
  }

  async markOzonAcquiringPaymentFailed(
    orderId: string,
    input: MarkOzonAcquiringPaymentFailedInput,
  ): Promise<OrderDTO> {
    const order = await this.markPaymentFailed(
      orderId,
      PrismaOrderPaymentMethod.OZON_ACQUIRING,
      "ozon_acquiring",
      input,
    );

    return this.mapOrder(order);
  }

  async attachTBankAcquiringPayment(
    orderId: string,
    input: AttachTBankAcquiringPaymentInput,
  ): Promise<OrderDTO> {
    this.assertSecurePaymentRedirect(input.redirectUrl);
    const order = await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!existing) throw new NotFoundException("Order not found");
      this.assertNotificationPaymentMethod(
        existing.paymentMethod,
        PrismaOrderPaymentMethod.TBANK_ACQUIRING,
      );
      this.assertImmutableProviderId(
        "T-Bank order id",
        existing.tbankAcquiringOrderId,
        input.acquiringOrderId,
      );
      this.assertImmutableProviderId(
        "T-Bank payment id",
        existing.tbankAcquiringPaymentId,
        input.paymentId,
      );
      return tx.order.update({
        where: { id: orderId },
        data: {
          paymentRedirectUrl:
            existing.paymentStatus === PrismaOrderPaymentStatus.PAID ||
            existing.paymentStatus === PrismaOrderPaymentStatus.CLOSED_UNPAID ||
            existing.terminalPaymentFailedAt
              ? existing.paymentRedirectUrl
              : input.redirectUrl,
          tbankAcquiringOrderId:
            existing.tbankAcquiringOrderId ?? input.acquiringOrderId,
          tbankAcquiringPaymentId:
            existing.tbankAcquiringPaymentId ?? input.paymentId,
          history: {
            create: {
              eventType: "payment_created",
              payload: this.toPrismaJson({
                acquiringOrderId: input.acquiringOrderId,
                paymentId: input.paymentId,
                provider: "tbank_acquiring",
              }),
            },
          },
        },
        include: orderInclude,
      });
    });

    return this.mapOrder(order);
  }

  async markTBankAcquiringPaymentFailed(
    orderId: string,
    input: MarkTBankAcquiringPaymentFailedInput,
  ): Promise<OrderDTO> {
    const order = await this.markPaymentFailed(
      orderId,
      PrismaOrderPaymentMethod.TBANK_ACQUIRING,
      "tbank_acquiring",
      input,
    );

    return this.mapOrder(order);
  }

  async applyOzonAcquiringNotification(
    input: ApplyOzonAcquiringNotificationInput,
  ): Promise<ApplyOzonAcquiringNotificationResult | undefined> {
    const orderId = input.verified.merchantOrderId;
    if (!orderId) {
      throw new BadRequestException("Ozon merchant order id is required");
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) return undefined;
      this.assertNotificationPaymentMethod(
        order.paymentMethod,
        PrismaOrderPaymentMethod.OZON_ACQUIRING,
      );
      const previousStatus = this.mapOrderCrmStatus(order.crmStatus);
      const isPaid = input.authoritativeStatus === "STATUS_PAID";
      const isClosedUnpaid =
        input.authoritativeStatus === "STATUS_CANCELED" ||
        input.authoritativeStatus === "STATUS_EXPIRED";
      const isRetryable = new Set([
        "STATUS_UNSPECIFIED",
        "STATUS_NEW",
        "STATUS_PAYMENT_PENDING",
        "STATUS_AUTHORIZED",
      ]).has(input.authoritativeStatus ?? "");
      this.assertImmutableProviderId(
        "Ozon order id",
        order.ozonAcquiringOrderId,
        input.acquiringOrderId,
      );
      if (input.amount !== undefined) {
        this.assertPaidAmount(order.total, input.amount, "Ozon");
      }
      if (input.currencyCode !== undefined && input.currencyCode !== "643") {
        throw new BadRequestException(
          "Ozon payment currency does not match order",
        );
      }
      if (isPaid || isRetryable || isClosedUnpaid) {
        if (!input.acquiringOrderId) {
          throw new BadRequestException(
            "Ozon notification identifiers are required",
          );
        }
        if (input.amount === undefined) {
          throw new BadRequestException("Ozon notification amount is required");
        }
        if (input.currencyCode !== "643") {
          throw new BadRequestException(
            "Ozon payment currency does not match order",
          );
        }
      }
      const paymentStatusChangedToPaid =
        isPaid && order.paymentStatus !== PrismaOrderPaymentStatus.PAID;
      if (paymentStatusChangedToPaid) {
        await this.markVerifiedProviderPaidInTransaction(tx, order, {
          provider: "ozon_acquiring",
          source: "ozon_acquiring_notification",
        });
      }
      if (isClosedUnpaid) {
        await this.publishClosedUnpaidInTransaction(tx, order, {
          provider: "ozon_acquiring",
          source: "ozon_acquiring_notification",
          rawStatus: input.authoritativeStatus!,
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          lastPaymentNotification: this.toPrismaJson(input.raw),
          ozonAcquiringOrderId:
            order.ozonAcquiringOrderId ?? input.acquiringOrderId,
          ...(isPaid
            ? { paymentErrorCode: null, paymentErrorMessage: null }
            : {}),
        },
      });

      if (
        !isPaid &&
        !isClosedUnpaid &&
        !order.paidAt &&
        order.paymentStatus !== PrismaOrderPaymentStatus.PAID &&
        order.paymentStatus !== PrismaOrderPaymentStatus.CLOSED_UNPAID
      ) {
        const [schedule] = await tx.$queryRaw<Array<{ nextAttemptAt: Date }>>`
          SELECT clock_timestamp() + INTERVAL '60 seconds' AS "nextAttemptAt"
        `;
        if (!schedule)
          throw new Error("Database recovery schedule is unavailable");
        await tx.orderPaymentRecovery.upsert({
          where: { orderId: order.id },
          create: { orderId: order.id, nextAttemptAt: schedule.nextAttemptAt },
          update: {},
        });
      }

      const updatedOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: orderInclude,
      });
      if (!updatedOrder) throw new NotFoundException("Order not found");
      return {
        order: this.mapOrder(updatedOrder),
        paymentStatusChangedToPaid,
        previousStatus,
        userId: updatedOrder.userId ?? undefined,
      };
    });
  }

  async applyTBankAcquiringNotification(
    input: ApplyTBankAcquiringNotificationInput,
  ): Promise<ApplyTBankAcquiringNotificationResult | undefined> {
    if (!input.orderId) return undefined;
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, input.orderId!);
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: orderInclude,
      });
      if (!order) return undefined;
      this.assertNotificationPaymentMethod(
        order.paymentMethod,
        PrismaOrderPaymentMethod.TBANK_ACQUIRING,
      );
      this.assertImmutableProviderId(
        "T-Bank order id",
        order.tbankAcquiringOrderId,
        input.orderId,
      );
      this.assertImmutableProviderId(
        "T-Bank payment id",
        order.tbankAcquiringPaymentId,
        input.paymentId,
      );
      const previousStatus = this.mapOrderCrmStatus(order.crmStatus);
      const isPaid = input.status === "paid" && input.success === true;
      if (input.amount !== undefined) {
        this.assertPaidAmount(order.total, input.amount, "T-Bank");
      }
      if (isPaid) {
        if (!input.paymentId) {
          throw new BadRequestException(
            "T-Bank paid notification payment id is required",
          );
        }
        if (input.amount === undefined) {
          throw new BadRequestException("T-Bank paid amount is required");
        }
      }
      const paymentStatusChangedToPaid =
        isPaid && order.paymentStatus !== PrismaOrderPaymentStatus.PAID;
      if (paymentStatusChangedToPaid) {
        await this.markVerifiedProviderPaidInTransaction(tx, order, {
          provider: "tbank_acquiring",
          source: "tbank_acquiring_notification",
        });
      }
      const terminalUnpaidStatuses = new Set([
        "CANCELED",
        "DEADLINE_EXPIRED",
        "REJECTED",
      ]);
      const shouldRelease =
        order.paymentStatus !== PrismaOrderPaymentStatus.PAID &&
        terminalUnpaidStatuses.has(input.rawStatus ?? "");
      if (shouldRelease) {
        if (!input.paymentId) {
          throw new BadRequestException(
            "T-Bank terminal notification payment id is required",
          );
        }
        this.assertPaidAmount(order.total, input.amount, "T-Bank");
        await this.promocodesService.releaseInTransaction(tx, order.id, {
          provider: "tbank_acquiring",
          rawStatus: input.rawStatus,
          source: "verified_terminal",
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          lastPaymentNotification: this.toPrismaJson(input.raw),
          tbankAcquiringOrderId: order.tbankAcquiringOrderId ?? input.orderId,
          tbankAcquiringPaymentId:
            order.tbankAcquiringPaymentId ?? input.paymentId,
          ...(isPaid
            ? { paymentErrorCode: null, paymentErrorMessage: null }
            : input.status === "failed"
              ? {
                  paymentErrorCode: input.errorCode,
                  paymentErrorMessage: input.errorMessage,
                  ...(shouldRelease
                    ? {
                        paymentRedirectUrl: CHECKOUT_FAILURE_PATH,
                        paymentStatus:
                          order.paymentStatus ===
                          PrismaOrderPaymentStatus.CLOSED_UNPAID
                            ? PrismaOrderPaymentStatus.CLOSED_UNPAID
                            : PrismaOrderPaymentStatus.FAILED,
                        terminalPaymentFailedAt:
                          order.terminalPaymentFailedAt ?? new Date(),
                      }
                    : {}),
                }
              : {}),
        },
      });
      const updatedOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: orderInclude,
      });
      if (!updatedOrder) throw new NotFoundException("Order not found");
      return {
        order: this.mapOrder(updatedOrder),
        paymentStatusChangedToPaid,
        previousStatus,
        userId: updatedOrder.userId ?? undefined,
      };
    });
  }

  async applyCdekOrderStatusWebhook(
    input: ApplyCdekOrderStatusWebhookInput,
  ): Promise<ApplyCdekOrderStatusWebhookResult | undefined> {
    const existingShipment = await this.prisma.orderShipment.findFirst({
      where: {
        provider: PrismaOrderDeliveryProvider.CDEK,
        OR: [
          { externalUuid: input.externalUuid },
          { externalNumber: input.cdekNumber },
          ...(input.orderNumber ? [{ orderId: input.orderNumber }] : []),
        ],
      },
    });
    const orderId = existingShipment?.orderId ?? input.orderNumber;

    if (!orderId) {
      return undefined;
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (
        !existingOrder ||
        existingOrder.deliveryProvider !== PrismaOrderDeliveryProvider.CDEK
      ) {
        return undefined;
      }
      const lockedShipment = await tx.orderShipment.findUnique({
        where: {
          orderId_provider: {
            orderId,
            provider: PrismaOrderDeliveryProvider.CDEK,
          },
        },
      });
      const previousShipmentStatusCode =
        lockedShipment?.statusCode ?? undefined;
      const shipmentStatusChanged =
        previousShipmentStatusCode !== input.statusCode;
      const nextOrderStatus = this.getOrderStatusForCdekShipmentStatus(
        existingOrder.crmStatus,
        input.statusCode,
      );
      const orderStatusChanged =
        nextOrderStatus !== undefined &&
        nextOrderStatus !== existingOrder.crmStatus;

      await tx.orderShipment.upsert({
        where: {
          orderId_provider: {
            orderId: existingOrder.id,
            provider: PrismaOrderDeliveryProvider.CDEK,
          },
        },
        create: {
          orderId: existingOrder.id,
          provider: PrismaOrderDeliveryProvider.CDEK,
          externalNumber: input.cdekNumber,
          externalUuid: input.externalUuid,
          responsePayload: this.toPrismaJson(input.raw),
          statusCode: input.statusCode,
          statusName: input.statusName,
          syncedAt: new Date(),
        },
        update: {
          externalNumber: input.cdekNumber,
          externalUuid: input.externalUuid,
          responsePayload: this.toPrismaJson(input.raw),
          statusCode: input.statusCode,
          statusName: input.statusName,
          syncedAt: new Date(),
        },
      });

      if (shipmentStatusChanged) {
        await tx.orderHistory.create({
          data: {
            orderId: existingOrder.id,
            eventType: "shipment_status_changed",
            payload: this.toPrismaJson({
              cdekNumber: input.cdekNumber,
              externalUuid: input.externalUuid,
              fromStatusCode: previousShipmentStatusCode ?? null,
              provider: "cdek",
              source: "cdek_webhook",
              statusDateTime: input.statusDateTime ?? null,
              toStatusCode: input.statusCode,
              toStatusName: input.statusName,
            }),
          },
        });
      }

      if (orderStatusChanged) {
        const completedAt =
          nextOrderStatus === PrismaOrderCrmStatus.COMPLETED
            ? (existingOrder.completedAt ?? new Date())
            : existingOrder.completedAt;
        if (
          existingOrder.crmStatus === PrismaOrderCrmStatus.COMPLETED &&
          nextOrderStatus !== PrismaOrderCrmStatus.COMPLETED
        ) {
          await this.affiliateFinancialAccountingService.recordEligibilityLossInTransaction(
            tx,
            existingOrder.id,
          );
        }
        await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            crmStatus: nextOrderStatus,
            ...(completedAt && !existingOrder.completedAt
              ? { completedAt }
              : {}),
          },
        });
        if (nextOrderStatus === PrismaOrderCrmStatus.COMPLETED && completedAt) {
          await this.affiliateFinancialAccountingService.recordCompletionInTransaction(
            tx,
            existingOrder.id,
            completedAt,
          );
        }
        await tx.orderHistory.create({
          data: {
            orderId: existingOrder.id,
            eventType: "status_changed",
            payload: this.toPrismaJson({
              fromStatus: this.mapOrderCrmStatus(existingOrder.crmStatus),
              source: "cdek_webhook",
              toStatus: this.mapOrderCrmStatus(nextOrderStatus),
            }),
          },
        });
      }

      const updatedOrder = await tx.order.findUnique({
        where: { id: existingOrder.id },
        include: orderInclude,
      });

      if (!updatedOrder) {
        throw new NotFoundException("Order not found");
      }

      return {
        order: this.mapOrder(updatedOrder),
        previousShipmentStatusCode,
        nextShipmentStatusCode: input.statusCode,
        shipmentStatusChanged,
        userId: existingOrder.userId ?? undefined,
      };
    });
  }

  async createAdminOrderComment(
    orderId: string,
    body: string,
    authorId: string,
  ): Promise<AdminOrderDTO> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const existingAuthorId = await this.getExistingUserId(authorId);

    const comment = await this.prisma.orderAdminComment.create({
      data: {
        orderId,
        authorId: existingAuthorId,
        body,
      },
    });
    await this.prisma.orderHistory.create({
      data: {
        orderId,
        authorId: existingAuthorId,
        eventType: "comment_created",
        payload: this.toPrismaJson({
          commentId: comment.id,
        }),
      },
    });

    return this.getAdminOrder(orderId);
  }

  async updateAdminOrderOzonPostings(
    orderId: string,
    postingNumbers: string[],
    authorId: string,
    fbsPostingNumbers: string[],
  ): Promise<AdminOrderDTO> {
    const existingAuthorId = await this.getExistingUserId(authorId);

    return this.prisma.$transaction(async (tx) => {
      // Serializes the rare list edits so one external shipment cannot be linked
      // to two Artmate orders by concurrent administrators.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(927281301)`;
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: adminOrderInclude,
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (order.deliveryProvider !== PrismaOrderDeliveryProvider.OZON) {
        throw new BadRequestException("Order delivery provider must be Ozon");
      }

      if (postingNumbers.length > 0) {
        const conflictingOrder = await tx.order.findFirst({
          where: {
            id: { not: orderId },
            ozonPostingNumbers: { hasSome: postingNumbers },
          },
          select: { id: true },
        });
        if (conflictingOrder) {
          throw new ConflictException(
            "Ozon posting is already linked to another order",
          );
        }
      }

      if (fbsPostingNumbers.some((number) => !postingNumbers.includes(number))) {
        throw new BadRequestException(
          "FBS postings must be included in postingNumbers",
        );
      }
      const nextFbsNumbers = [...fbsPostingNumbers].sort();
      const previousFbsNumbers = [...order.ozonFbsPostingNumbers].sort();
      const nextNumbers = [...postingNumbers].sort();
      const previousNumbers = [...order.ozonPostingNumbers].sort();
      if (
        JSON.stringify(previousNumbers) === JSON.stringify(nextNumbers) &&
        JSON.stringify(previousFbsNumbers) === JSON.stringify(nextFbsNumbers)
      ) {
        return this.mapAdminOrder(order);
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          ozonPostingNumbers: nextNumbers,
          ozonFbsPostingNumbers: nextFbsNumbers,
        },
      });
      await publishTrackingRequest(tx, {
        ...order,
        ozonPostingNumbers: nextNumbers,
        ozonFbsPostingNumbers: nextFbsNumbers,
      });
      await tx.orderHistory.create({
        data: {
          orderId,
          authorId: existingAuthorId,
          eventType: "ozon_postings_updated",
          payload: {
            previousPostingNumbers: previousNumbers,
            previousFbsPostingNumbers: previousFbsNumbers,
            fbsPostingNumbers: nextFbsNumbers,
            postingNumbers: nextNumbers,
          },
        },
      });
      const updatedOrder = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: adminOrderInclude,
      });
      return this.mapAdminOrder(updatedOrder);
    });
  }

  async getAdminOrder(orderId: string): Promise<AdminOrderDTO> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: adminOrderInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.mapAdminOrder(order);
  }

  async applyDeliveryCompletion(
    eventId: string,
    enqueueNotifications: (
      tx: Prisma.TransactionClient,
      result: UpdateAdminOrderStatusResult,
    ) => Promise<void>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.deliveryCompletionEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) return false;
      await this.lockOrder(tx, event.orderId);
      if (
        await tx.orderDeliveryCompletionReceipt.findUnique({
          where: { eventId },
        })
      )
        return false;
      const order = await tx.order.findUnique({
        where: { id: event.orderId },
        include: adminOrderInclude,
      });
      const request = await tx.deliveryTrackingRequest.findUnique({
        where: { orderId: event.orderId },
      });
      const expectedNumbers = order?.ozonPostingNumbers ?? [];
      const isCurrent = Boolean(
        order &&
        request?.enabled &&
        request.revision === event.id &&
        order.deliveryProvider === "OZON" &&
        order.crmStatus === "DELIVERING" &&
        order.paymentStatus === "PAID" &&
        expectedNumbers.length > 0 &&
        expectedNumbers.length === event.externalNumbers.length &&
        new Set(event.externalNumbers).size === event.externalNumbers.length &&
        expectedNumbers.every((number) =>
          event.externalNumbers.includes(number),
        ),
      );
      if (order && isCurrent) {
        const completedAt = order.completedAt ?? event.observedAt;
        const updated = await tx.order.update({
          where: { id: order.id },
          data: { crmStatus: "COMPLETED", completedAt },
          include: adminOrderInclude,
        });
        await this.affiliateFinancialAccountingService.recordCompletionInTransaction(
          tx,
          order.id,
          completedAt,
        );
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            eventType: "status_changed",
            payload: {
              fromStatus: "delivering",
              toStatus: "completed",
              source: "delivery_tracking",
              deliveryEventId: event.id,
            },
          },
        });
        await publishTrackingRequest(tx, updated);
        await enqueueNotifications(tx, {
          order: this.mapAdminOrder(updated),
          changed: true,
          previousStatus: "delivering",
          nextStatus: "completed",
          userId: order.userId ?? undefined,
        });
      }
      await tx.orderDeliveryCompletionReceipt.create({
        data: { eventId, completed: isCurrent },
      });
      return isCurrent;
    });
  }

  private async getExistingUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user.id;
  }

  private async getExistingUserIdByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    return user?.id;
  }

  private mapOrder(order: StoredOrder): OrderDTO {
    return {
      id: order.id,
      cartId: order.cartId,
      status: this.mapOrderCrmStatus(order.crmStatus),
      customer: {
        name: order.customerName,
        ...(order.customerPhone ? { phone: order.customerPhone } : {}),
        email: order.customerEmail,
      },
      delivery: {
        provider: this.mapDeliveryProvider(order.deliveryProvider),
        pickupPoint: {
          id: order.pickupPointId,
          title: order.pickupPointTitle,
          address: order.pickupPointAddress,
          workHours: order.pickupPointWorkHours,
          deliveryPrice: this.toNumber(order.deliveryPrice),
        },
      },
      payment: {
        method: this.mapPaymentMethod(order.paymentMethod),
        status: this.mapPaymentStatus(order.paymentStatus),
        redirectUrl: order.paymentRedirectUrl,
      },
      items: order.items.map((item) => ({
        id: item.productId,
        title: item.title,
        slug: item.slug,
        price: this.toNumber(item.price),
        category: item.category ?? undefined,
        categorySlug: item.categorySlug ?? undefined,
        image: item.image,
        quantity: item.quantity,
        lineTotal: this.toNumber(item.lineTotal),
      })),
      shipments: order.shipments.map((shipment) =>
        this.mapOrderShipment(shipment, { includeErrorMessage: false }),
      ),
      itemsCount: order.itemsCount,
      subtotal: this.toNumber(order.subtotal),
      discount: this.toNumber(order.discount),
      deliveryPrice: this.toNumber(order.deliveryPrice),
      promoCode: order.promoCode,
      total: this.toNumber(order.total),
      currency: "RUB",
      comment: order.comment ?? undefined,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString(),
    };
  }

  private mapAdminOrder(order: StoredAdminOrder): AdminOrderDTO {
    return {
      ...this.mapOrder(order),
      ozonPostingNumbers: order.ozonPostingNumbers,
      ozonFbsPostingNumbers: order.ozonFbsPostingNumbers,
      adminComments: order.adminComments.map((comment) =>
        this.mapAdminOrderComment(comment),
      ),
      history: order.history.map((event) =>
        this.mapAdminOrderHistoryEvent(event),
      ),
      shipments: order.shipments.map((shipment) =>
        this.mapOrderShipment(shipment, { includeErrorMessage: true }),
      ),
    };
  }

  private mapOrderShipment(
    shipment: StoredOrderShipment,
    options: { includeErrorMessage?: boolean } = {},
  ): OrderShipmentDTO {
    return {
      provider: this.mapDeliveryProvider(shipment.provider),
      externalUuid: shipment.externalUuid ?? undefined,
      externalNumber: shipment.externalNumber ?? undefined,
      requestUuid: shipment.requestUuid ?? undefined,
      requestState: shipment.requestState ?? undefined,
      statusCode: shipment.statusCode ?? undefined,
      statusName: shipment.statusName ?? undefined,
      ...((options.includeErrorMessage ?? true)
        ? { errorMessage: shipment.errorMessage ?? undefined }
        : {}),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      syncedAt: shipment.syncedAt?.toISOString(),
    };
  }

  private mapAdminOrderComment(
    comment: StoredAdminOrder["adminComments"][number],
  ): AdminOrderCommentDTO {
    return {
      id: comment.id,
      orderId: comment.orderId,
      authorId: comment.authorId ?? undefined,
      authorName: this.getCommentAuthorName(comment.author),
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  private createOrderId() {
    return `AM-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private mapOrderCrmStatus(status: PrismaOrderCrmStatus): OrderStatus {
    switch (status) {
      case PrismaOrderCrmStatus.NEW:
        return "new";
      case PrismaOrderCrmStatus.IN_PROGRESS:
        return "in_progress";
      case PrismaOrderCrmStatus.WAITING_PAYMENT:
        return "waiting_payment";
      case PrismaOrderCrmStatus.PAID:
        return "paid";
      case PrismaOrderCrmStatus.DELIVERING:
        return "delivering";
      case PrismaOrderCrmStatus.COMPLETED:
        return "completed";
      case PrismaOrderCrmStatus.CANCELLED:
        return "cancelled";
    }
  }

  private mapPrismaOrderStatus(status: OrderStatus): PrismaOrderCrmStatus {
    switch (status) {
      case "new":
        return PrismaOrderCrmStatus.NEW;
      case "in_progress":
        return PrismaOrderCrmStatus.IN_PROGRESS;
      case "waiting_payment":
        return PrismaOrderCrmStatus.WAITING_PAYMENT;
      case "paid":
        return PrismaOrderCrmStatus.PAID;
      case "delivering":
        return PrismaOrderCrmStatus.DELIVERING;
      case "completed":
        return PrismaOrderCrmStatus.COMPLETED;
      case "cancelled":
        return PrismaOrderCrmStatus.CANCELLED;
    }
  }

  private mapPaymentMethod(
    method: PrismaOrderPaymentMethod,
  ): OrderPaymentDTO["method"] {
    switch (method) {
      case PrismaOrderPaymentMethod.BANK_CARD_MOCK:
        return "bank_card_mock";
      case PrismaOrderPaymentMethod.OZON_ACQUIRING:
        return "ozon_acquiring";
      case PrismaOrderPaymentMethod.TBANK_ACQUIRING:
        return "tbank_acquiring";
    }
  }

  private mapPaymentStatus(
    status: PrismaOrderPaymentStatus,
  ): OrderPaymentDTO["status"] {
    switch (status) {
      case PrismaOrderPaymentStatus.FAILED:
      case PrismaOrderPaymentStatus.CLOSED_UNPAID:
        return "failed";
      case PrismaOrderPaymentStatus.PAID:
        return "paid";
      case PrismaOrderPaymentStatus.PENDING:
        return "pending";
    }
  }

  private mapDeliveryProvider(
    provider: PrismaOrderDeliveryProvider,
  ): OrderDeliveryDTO["provider"] {
    switch (provider) {
      case PrismaOrderDeliveryProvider.CDEK:
        return "cdek";
      case PrismaOrderDeliveryProvider.OZON:
        return "ozon";
    }
  }

  private toPrismaDeliveryProvider(
    provider: OrderDeliveryDTO["provider"],
  ): PrismaOrderDeliveryProvider {
    switch (provider) {
      case "cdek":
        return PrismaOrderDeliveryProvider.CDEK;
      case "ozon":
        return PrismaOrderDeliveryProvider.OZON;
    }
  }

  private toPrismaPaymentMethod(
    method: CreateOrderPaymentMethod,
  ): PrismaOrderPaymentMethod {
    switch (method) {
      case "ozon_acquiring":
        return PrismaOrderPaymentMethod.OZON_ACQUIRING;
      case "tbank_acquiring":
        return PrismaOrderPaymentMethod.TBANK_ACQUIRING;
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private getPaymentInitializationStartedAt(redirectUrl: string) {
    if (!redirectUrl.startsWith(PAYMENT_INITIALIZING_PATH)) return undefined;
    const startedAt = Number(
      new URL(redirectUrl, "http://localhost").searchParams.get("startedAt"),
    );
    return Number.isFinite(startedAt) ? startedAt : 0;
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private isFreshShipmentCreation(shipment: StoredOrderShipment) {
    const freshWindowMs = 10 * 60 * 1000;

    return (
      shipment.requestState === "CREATING" &&
      shipment.updatedAt.getTime() > Date.now() - freshWindowMs
    );
  }

  private toNumber(value: unknown) {
    return Number(value);
  }

  private lockOrder(tx: Prisma.TransactionClient, orderId: string) {
    return tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`,
    );
  }

  private lockCart(tx: Prisma.TransactionClient, cartId: string) {
    return tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "carts" WHERE "id" = ${cartId} FOR UPDATE`,
    );
  }

  private assertNotificationPaymentMethod(
    actual: PrismaOrderPaymentMethod,
    expected: PrismaOrderPaymentMethod,
  ) {
    if (actual !== expected) {
      throw new BadRequestException(
        "Payment notification provider does not match order",
      );
    }
  }

  private assertImmutableProviderId(
    field: string,
    stored: string | null,
    supplied: string | undefined,
  ) {
    if (stored && supplied && stored !== supplied) {
      throw new BadRequestException(`${field} does not match order`);
    }
  }

  private assertPaidAmount(
    orderTotal: { toString(): string },
    suppliedAmount: string | undefined,
    provider: string,
  ) {
    if (!suppliedAmount || !/^\d+$/.test(suppliedAmount)) {
      throw new BadRequestException(`${provider} paid amount is required`);
    }
    const expectedAmount = rublesToKopecks(orderTotal);
    if (
      !Number.isSafeInteger(Number(suppliedAmount)) ||
      Number(suppliedAmount) !== expectedAmount
    ) {
      throw new BadRequestException(
        `${provider} payment amount does not match order`,
      );
    }
  }

  private async markVerifiedProviderPaidInTransaction(
    tx: Prisma.TransactionClient,
    order: StoredOrder,
    input: { provider: string; source: string },
  ) {
    if (order.checkoutAttemptId !== null) {
      if (order.cartRestoredAt && order.cartConsumedAt) {
        await this.reconcileRestoredOrderItemsInTransaction(tx, order);
      } else if (!order.cartConsumedAt) {
        await this.consumeOrderItemsInTransaction(
          tx,
          order,
          "verified_paid_transition",
        );
      }
    }
    if (!order.userId) {
      // New guest orders are attached during creation. This fallback is only
      // for historical production orders that are still unlinked at paid time.
      if (!this.orderActivationService) {
        throw new Error("OrderActivationService is not configured");
      }
      await this.orderActivationService.attachGuestOrderInTransaction(
        tx,
        order,
      );
    }

    if (!this.analyticsOutboxService) {
      throw new Error("AnalyticsOutboxService is not configured");
    }
    const paidAt = order.paidAt ?? new Date();
    await this.markPaidInTransaction(tx, order, { ...input, paidAt });
    await this.analyticsOutboxService.enqueueOrderPaid(tx, {
      ...order,
      paidAt,
    });
    return true;
  }

  private async markPaidInTransaction(
    tx: Prisma.TransactionClient,
    order: StoredOrder,
    input: {
      provider: string;
      source: string;
      authorId?: string;
      paidAt?: Date;
    },
  ) {
    if (order.paymentStatus === PrismaOrderPaymentStatus.PAID) return false;
    const promoResult = await this.promocodesService.consumeInTransaction(
      tx,
      order.id,
      {
        provider: input.provider,
        source: input.source,
      },
    );
    if (promoResult.usedAfterRelease) {
      this.logger.warn(
        `Paid order ${order.id} consumed a previously released promocode reservation`,
      );
    }
    const financialOrder = await tx.order.findUnique({
      where: { id: order.id },
      select: {
        checkoutActorUserId: true,
        completedAt: true,
        id: true,
        items: {
          select: { price: true, productId: true, quantity: true },
        },
        promoCode: true,
        promoPricingSnapshot: true,
        promoTermsSnapshot: true,
        subtotal: true,
        userId: true,
      },
    });
    if (!financialOrder) throw new NotFoundException("Order not found");
    await this.affiliateFinancialAccountingService.recordPaidOrderInTransaction(
      tx,
      {
        ...financialOrder,
        items: financialOrder.items.map((item) => ({
          id: item.productId,
          quantity: item.quantity,
          unitPriceKopecks: rublesToKopecks(item.price),
        })),
        subtotalKopecks: rublesToKopecks(financialOrder.subtotal),
      },
    );
    const nextCrmStatus = this.getPaidTransitionCrmStatus(order.crmStatus);
    const paidAt = order.paidAt ?? input.paidAt ?? new Date();
    await tx.order.update({
      where: { id: order.id },
      data: {
        crmStatus: nextCrmStatus,
        paidAt,
        paymentErrorCode: null,
        paymentErrorMessage: null,
        paymentStatus: PrismaOrderPaymentStatus.PAID,
        status: PrismaOrderStatus.PAID,
      },
    });
    await tx.orderPaymentEvent.upsert({
      where: { orderId_kind: { orderId: order.id, kind: "PAID" } },
      create: { orderId: order.id, kind: "PAID", occurredAt: paidAt },
      update: {},
    });
    if (order.crmStatus !== nextCrmStatus) {
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          authorId: input.authorId,
          eventType: "status_changed",
          payload: this.toPrismaJson({
            fromStatus: this.mapOrderCrmStatus(order.crmStatus),
            source: input.source,
            toStatus: this.mapOrderCrmStatus(nextCrmStatus),
          }),
        },
      });
    }
    return true;
  }

  private async markPaymentFailed(
    orderId: string,
    expectedMethod: PrismaOrderPaymentMethod,
    provider: string,
    input: { errorCode?: string; errorMessage: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!existing) throw new NotFoundException("Order not found");
      this.assertNotificationPaymentMethod(
        existing.paymentMethod,
        expectedMethod,
      );
      if (
        existing.paymentStatus === PrismaOrderPaymentStatus.PAID ||
        existing.paymentStatus === PrismaOrderPaymentStatus.CLOSED_UNPAID
      ) {
        return existing;
      }
      return tx.order.update({
        where: { id: orderId },
        data: {
          paymentErrorCode: input.errorCode,
          paymentErrorMessage: input.errorMessage,
          paymentStatus: PrismaOrderPaymentStatus.FAILED,
          history: {
            create: {
              eventType: "payment_failed",
              payload: this.toPrismaJson({
                errorCode: input.errorCode,
                errorMessage: input.errorMessage,
                provider,
              }),
            },
          },
        },
        include: orderInclude,
      });
    });
  }

  private isSecurePaymentRedirect(value: string) {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  private assertSecurePaymentRedirect(value: string) {
    if (!this.isSecurePaymentRedirect(value)) {
      throw new BadRequestException("Payment redirect URL must use HTTPS");
    }
  }

  private async restoreOrderItemsInTransaction(
    tx: Prisma.TransactionClient,
    order: StoredOrder,
  ) {
    const consumedQuantities = this.getQuantityLedger(
      order.cartConsumedQuantities,
    );
    const restoredQuantities: Record<string, number> = {};
    await tx.cart.upsert({
      where: { id: order.cartId },
      create: { id: order.cartId },
      update: {},
    });
    await this.lockCart(tx, order.cartId);
    for (const item of order.items) {
      const consumedQuantity = consumedQuantities[item.productId] ?? 0;
      if (consumedQuantity === 0) continue;
      const where = {
        cartId_productId: {
          cartId: order.cartId,
          productId: item.productId,
        },
      };
      const existing = await tx.cartItem.findUnique({ where });
      const existingQuantity = existing?.quantity ?? 0;
      const quantity = Math.min(existingQuantity + consumedQuantity, 99);
      restoredQuantities[item.productId] = quantity - existingQuantity;
      await tx.cartItem.upsert({
        where,
        create: {
          cartId: order.cartId,
          productId: item.productId,
          title: item.title,
          slug: item.slug,
          price: item.price,
          category: item.category,
          categorySlug: item.categorySlug,
          image: item.image,
          quantity,
        },
        update: {
          title: item.title,
          slug: item.slug,
          price: item.price,
          category: item.category,
          categorySlug: item.categorySlug,
          image: item.image,
          quantity,
        },
      });
    }
    await tx.cart.update({
      where: { id: order.cartId },
      data: { updatedAt: new Date() },
    });
    return restoredQuantities;
  }

  private async consumeOrderItemsInTransaction(
    tx: Prisma.TransactionClient,
    order: StoredOrder,
    source: string,
  ) {
    const consumedQuantities: Record<string, number> = {};
    await this.lockCart(tx, order.cartId);
    for (const item of order.items) {
      const where = {
        cartId_productId: {
          cartId: order.cartId,
          productId: item.productId,
        },
      };
      const existing = await tx.cartItem.findUnique({ where });
      if (!existing) continue;
      const consumedQuantity = Math.min(existing.quantity, item.quantity);
      if (consumedQuantity === 0) continue;
      consumedQuantities[item.productId] = consumedQuantity;
      const quantity = existing.quantity - consumedQuantity;
      if (quantity === 0) {
        await tx.cartItem.deleteMany({
          where: { cartId: order.cartId, productId: item.productId },
        });
      } else {
        await tx.cartItem.update({ where, data: { quantity } });
      }
    }
    await tx.cart.update({
      where: { id: order.cartId },
      data: { updatedAt: new Date() },
    });
    const consumedAt = new Date();
    await tx.order.update({
      where: { id: order.id },
      data: {
        cartConsumedAt: consumedAt,
        cartConsumedQuantities: this.toPrismaJson(consumedQuantities),
      },
    });
    await tx.orderHistory.create({
      data: {
        orderId: order.id,
        eventType: "cart_consumed",
        payload: this.toPrismaJson({ source }),
      },
    });
  }

  private async reconcileRestoredOrderItemsInTransaction(
    tx: Prisma.TransactionClient,
    order: StoredOrder,
  ) {
    const restoredQuantities = this.getQuantityLedger(
      order.cartRestoredQuantities,
    );
    await this.lockCart(tx, order.cartId);
    for (const item of order.items) {
      const where = {
        cartId_productId: {
          cartId: order.cartId,
          productId: item.productId,
        },
      };
      const existing = await tx.cartItem.findUnique({ where });
      if (!existing) continue;
      const quantityToRemove = Math.min(
        restoredQuantities[item.productId] ?? 0,
        existing.quantity,
      );
      const quantity = existing.quantity - quantityToRemove;
      if (quantityToRemove === 0) continue;
      if (quantity === 0) {
        await tx.cartItem.deleteMany({
          where: { cartId: order.cartId, productId: item.productId },
        });
      } else {
        await tx.cartItem.update({ where, data: { quantity } });
      }
    }
    await tx.cart.update({
      where: { id: order.cartId },
      data: { updatedAt: new Date() },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { cartConsumedAt: order.cartConsumedAt ?? new Date() },
    });
    await tx.orderHistory.create({
      data: {
        orderId: order.id,
        eventType: "cart_restoration_reconciled",
        payload: this.toPrismaJson({ source: "verified_paid_transition" }),
      },
    });
  }

  private getQuantityLedger(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" &&
          Number.isSafeInteger(entry[1]) &&
          entry[1] > 0,
      ),
    );
  }

  private assertReceiptPricing(
    pricing: OrderPricingSnapshot,
    paymentMethod: PaymentMethod,
  ) {
    const deliveryKopecks = pricing.deliveryKopecks;
    if (
      pricing.items.some((item) =>
        item.priceGroups.some((group) => group.unitPriceKopecks <= 0),
      ) ||
      pricing.totalKopecks <= 0
    ) {
      throw new BadRequestException(
        "Оформление товара с нулевой ценой пока недоступно",
      );
    }
    const rowCount =
      pricing.items.reduce(
        (count, item) => count + item.priceGroups.length,
        0,
      ) + (deliveryKopecks > 0 ? 1 : 0);
    if (paymentMethod === "tbank_acquiring" && rowCount > 100) {
      throw new BadRequestException(
        "Чек T-Bank не может содержать больше 100 позиций",
      );
    }
  }

  private isPaidWorkflowStatus(status: OrderStatus) {
    return (
      status === "paid" || status === "delivering" || status === "completed"
    );
  }

  private getPaidTransitionCrmStatus(currentStatus: PrismaOrderCrmStatus) {
    return currentStatus === PrismaOrderCrmStatus.DELIVERING ||
      currentStatus === PrismaOrderCrmStatus.COMPLETED ||
      currentStatus === PrismaOrderCrmStatus.CANCELLED
      ? currentStatus
      : PrismaOrderCrmStatus.PAID;
  }

  private getOrderStatusForCdekShipmentStatus(
    currentStatus: PrismaOrderCrmStatus,
    shipmentStatusCode: string,
  ) {
    if (
      currentStatus === PrismaOrderCrmStatus.CANCELLED ||
      currentStatus === PrismaOrderCrmStatus.COMPLETED
    ) {
      return undefined;
    }

    const normalizedStatusCode = shipmentStatusCode.toUpperCase();

    if (
      normalizedStatusCode === "DELIVERED" ||
      normalizedStatusCode === "POSTOMAT_RECEIVED"
    ) {
      return PrismaOrderCrmStatus.COMPLETED;
    }

    if (
      normalizedStatusCode === "INVALID" ||
      normalizedStatusCode === "NOT_DELIVERED" ||
      normalizedStatusCode === "REMOVED"
    ) {
      return PrismaOrderCrmStatus.CANCELLED;
    }

    if (
      currentStatus === PrismaOrderCrmStatus.PAID ||
      currentStatus === PrismaOrderCrmStatus.IN_PROGRESS ||
      currentStatus === PrismaOrderCrmStatus.NEW
    ) {
      return PrismaOrderCrmStatus.DELIVERING;
    }

    return undefined;
  }

  private getCommentAuthorName(
    author: StoredAdminOrder["adminComments"][number]["author"],
  ) {
    return author?.name ?? author?.email ?? undefined;
  }

  private mapAdminOrderHistoryEvent(
    event: StoredAdminOrder["history"][number],
  ): AdminOrderHistoryEventDTO {
    return {
      id: event.id,
      orderId: event.orderId,
      authorId: event.authorId ?? undefined,
      authorName: this.getCommentAuthorName(event.author),
      eventType: event.eventType,
      payload: this.mapJsonObject(event.payload),
      createdAt: event.createdAt.toISOString(),
    };
  }

  private mapJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return { value };
  }

  private toPrismaJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
