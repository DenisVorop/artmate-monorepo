import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import type { CartItemDTO } from "../cart/dto";
import {
  OrderDeliveryProvider as PrismaOrderDeliveryProvider,
  OrderCrmStatus as PrismaOrderCrmStatus,
  OrderPaymentMethod as PrismaOrderPaymentMethod,
  OrderPaymentStatus as PrismaOrderPaymentStatus,
  OrderStatus as PrismaOrderStatus,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { OzonAcquiringVerifiedNotification } from "../ozon/ozon-acquiring.service";
import { calculatePromoPricing } from "../promocodes/pricing";
import {
  PromocodesService,
  rublesToKopecks,
} from "../promocodes/promocodes.service";

import type {
  AdminOrderCommentDTO,
  AdminOrderHistoryEventDTO,
  AdminOrderDTO,
  OrderCustomerDTO,
  OrderDTO,
  OrderDeliveryDTO,
  OrderPaymentDTO,
  OrderShipmentDTO,
} from "./dto";
import type {
  DeliveryProvider,
  OrderStatus,
  PaymentMethod,
} from "./orders.constants";
import type { OrderReceiptItemPricing } from "./payment-receipt";

const CHECKOUT_SUCCESS_PATH = "/checkout/success";

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
  userId: string;
  cartId: string;
  customer: OrderCustomerDTO;
  delivery: OrderDeliveryDTO;
  items: CartItemDTO[];
  itemsCount: number;
  paymentMethod: PaymentMethod;
  promoCode?: string;
  subtotal: number;
  comment?: string;
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
  currencyCode?: string;
  errorCode?: string;
  errorMessage?: string;
  extOrderId?: string;
  extTransactionId?: string;
  paymentMethod?: string;
  raw: Record<string, unknown>;
  status?: string;
  transactionId?: string;
  transactionUid?: string;
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
  ) {}

  async createOrder(input: CreateStoredOrderInput): Promise<OrderDTO> {
    const deliveryPrice = input.delivery.pickupPoint.deliveryPrice;
    const total = input.subtotal + deliveryPrice;
    const userId = await this.getExistingUserId(input.userId);
    const deliveryProvider = this.toPrismaDeliveryProvider(
      input.delivery.provider,
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = this.createOrderId();

      try {
        const order = await this.prisma.$transaction(async (tx) => {
          await tx.order.create({
            data: {
              id,
              userId,
              cartId: input.cartId,
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
              total,
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
                create: input.items.map((item) => ({
                  productId: item.id,
                  title: item.title,
                  slug: item.slug,
                  price: item.price,
                  category: item.category ?? null,
                  categorySlug: item.categorySlug ?? null,
                  image: item.image,
                  quantity: item.quantity,
                  lineTotal: item.lineTotal,
                })),
              },
            },
          });
          if (input.promoCode) {
            const reservation =
              await this.promocodesService.reserveInTransaction(tx, {
                code: input.promoCode,
                deliveryPriceKopecks: rublesToKopecks({
                  toString: () => String(deliveryPrice),
                }),
                orderId: id,
                userId,
                items: input.items.map((item) => ({
                  id: item.id,
                  unitPriceKopecks: rublesToKopecks({
                    toString: () => String(item.price),
                  }),
                  quantity: item.quantity,
                })),
              });
            this.assertReceiptPricing(
              reservation.pricingSnapshot,
              deliveryPrice,
              input.paymentMethod,
            );
          }
          const createdOrder = await tx.order.findUnique({
            where: { id },
            include: orderInclude,
          });
          if (!createdOrder) throw new NotFoundException("Order not found");
          return createdOrder;
        });

        return this.mapOrder(order);
      } catch (error) {
        if (this.isUniqueConstraintError(error) && attempt < 2) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Order id generation failed");
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

  async getOrderReceiptPricing(
    orderId: string,
  ): Promise<OrderReceiptItemPricing[] | undefined> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { promoPricingSnapshot: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (!order.promoPricingSnapshot) return undefined;
    const snapshot = order.promoPricingSnapshot;
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      Array.isArray(snapshot) ||
      !Array.isArray(snapshot.items)
    ) {
      throw new Error("Invalid order promo pricing snapshot");
    }
    return snapshot.items.map((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        typeof item.id !== "string" ||
        !Array.isArray(item.priceGroups)
      ) {
        throw new Error("Invalid order promo item pricing snapshot");
      }
      return {
        id: item.id,
        priceGroups: item.priceGroups.map((group) => {
          if (!group || typeof group !== "object" || Array.isArray(group)) {
            throw new Error("Invalid order promo price group snapshot");
          }
          const quantity = group.quantity;
          const totalKopecks = group.totalKopecks;
          const unitPriceKopecks = group.unitPriceKopecks;
          if (
            typeof quantity !== "number" ||
            !Number.isSafeInteger(quantity) ||
            quantity <= 0 ||
            typeof totalKopecks !== "number" ||
            !Number.isSafeInteger(totalKopecks) ||
            totalKopecks <= 0 ||
            typeof unitPriceKopecks !== "number" ||
            !Number.isSafeInteger(unitPriceKopecks) ||
            unitPriceKopecks <= 0 ||
            unitPriceKopecks * quantity !== totalKopecks
          ) {
            throw new Error("Invalid order promo price group values");
          }
          return { quantity, totalKopecks, unitPriceKopecks };
        }),
      };
    });
  }

  async getOrdersByUserId(userId: string): Promise<OrderDTO[]> {
    if (!userId.trim()) {
      return [];
    }

    const orders = await this.prisma.order.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
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
          crmStatus: true,
          paidAt: true,
          paymentMethod: true,
          userId: true,
        },
      });

      if (!existingOrder) {
        throw new NotFoundException("Order not found");
      }

      const previousStatus = this.mapOrderCrmStatus(existingOrder.crmStatus);
      const changed = existingOrder.crmStatus !== nextStatus;

      if (changed) {
        if (this.isPaidWorkflowStatus(status)) {
          await this.promocodesService.consumeInTransaction(tx, orderId, {
            provider: this.mapPaymentMethod(existingOrder.paymentMethod),
            source: "admin_crm",
          });
        }
        await tx.order.update({
          where: { id: orderId },
          data: {
            crmStatus: nextStatus,
            ...(this.isPaidWorkflowStatus(status)
              ? {
                  paidAt: existingOrder.paidAt ?? new Date(),
                  paymentStatus: PrismaOrderPaymentStatus.PAID,
                  status: PrismaOrderStatus.PAID,
                }
              : {}),
          },
        });
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
          paymentRedirectUrl: input.redirectUrl,
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
          paymentRedirectUrl: input.redirectUrl,
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
      const isPaid = input.status === "Completed";
      const isAlreadyPaid =
        order.paymentStatus === PrismaOrderPaymentStatus.PAID;
      if (input.verified.profile === "canonical") {
        this.assertImmutableProviderId(
          "Ozon order id",
          order.ozonAcquiringOrderId,
          input.verified.acquiringOrderId,
        );
        if (isAlreadyPaid && input.verified.transactionIdentity) {
          const { kind, value } = input.verified.transactionIdentity;
          const storedKind = order.ozonAcquiringTransactionId
            ? "transactionId"
            : order.ozonAcquiringTransactionUid
              ? "transactionUid"
              : undefined;
          if (storedKind && storedKind !== kind) {
            throw new BadRequestException(
              "Ozon transaction identity does not match order",
            );
          }
          this.assertImmutableProviderId(
            kind === "transactionId"
              ? "Ozon transaction id"
              : "Ozon transaction uid",
            kind === "transactionId"
              ? order.ozonAcquiringTransactionId
              : order.ozonAcquiringTransactionUid,
            value,
          );
        }
      } else {
        this.assertImmutableProviderId(
          "Ozon order id",
          order.ozonAcquiringOrderId,
          input.acquiringOrderId,
        );
        this.assertImmutableProviderId(
          "Ozon transaction id",
          order.ozonAcquiringTransactionId,
          input.transactionId,
        );
        this.assertImmutableProviderId(
          "Ozon transaction uid",
          order.ozonAcquiringTransactionUid,
          input.transactionUid,
        );
      }
      if (input.amount !== undefined) {
        this.assertPaidAmount(order.total, input.amount, "Ozon");
      }
      if (input.currencyCode !== undefined && input.currencyCode !== "643") {
        throw new BadRequestException(
          "Ozon payment currency does not match order",
        );
      }
      if (isPaid) {
        if (
          input.verified.profile === "canonical" &&
          (!input.verified.acquiringOrderId ||
            !input.verified.transactionIdentity)
        ) {
          throw new BadRequestException(
            "Ozon paid notification identifiers are required",
          );
        }
        if (input.amount === undefined) {
          throw new BadRequestException("Ozon paid amount is required");
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
        await this.markPaidInTransaction(tx, order, {
          provider: "ozon_acquiring",
          source: "ozon_acquiring_notification",
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          lastPaymentNotification: this.toPrismaJson(input.raw),
          ...(input.verified.profile === "canonical"
            ? {
                ozonAcquiringOrderId:
                  order.ozonAcquiringOrderId ?? input.verified.acquiringOrderId,
              }
            : {}),
          ...(paymentStatusChangedToPaid &&
          input.verified.profile === "canonical"
            ? input.verified.transactionIdentity?.kind === "transactionId"
              ? {
                  ozonAcquiringTransactionId:
                    order.ozonAcquiringTransactionId ??
                    input.verified.transactionIdentity.value,
                }
              : input.verified.transactionIdentity?.kind === "transactionUid"
                ? {
                    ozonAcquiringTransactionUid:
                      order.ozonAcquiringTransactionUid ??
                      input.verified.transactionIdentity.value,
                  }
                : {}
            : {}),
          ...(isPaid
            ? { paymentErrorCode: null, paymentErrorMessage: null }
            : input.status === "Rejected"
              ? {
                  paymentErrorCode: input.errorCode,
                  paymentErrorMessage: input.errorMessage,
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
        userId: order.userId ?? undefined,
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
        await this.markPaidInTransaction(tx, order, {
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
                    ? { paymentStatus: PrismaOrderPaymentStatus.FAILED }
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
        userId: order.userId ?? undefined,
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

    const existingOrder = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        deliveryProvider: PrismaOrderDeliveryProvider.CDEK,
      },
      select: {
        crmStatus: true,
        id: true,
        userId: true,
      },
    });

    if (!existingOrder) {
      return undefined;
    }

    const previousShipmentStatusCode =
      existingShipment?.statusCode ?? undefined;
    const shipmentStatusChanged =
      previousShipmentStatusCode !== input.statusCode;
    const nextOrderStatus = this.getOrderStatusForCdekShipmentStatus(
      existingOrder.crmStatus,
      input.statusCode,
    );
    const orderStatusChanged =
      nextOrderStatus !== undefined &&
      nextOrderStatus !== existingOrder.crmStatus;

    const order = await this.prisma.$transaction(async (tx) => {
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
        await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            crmStatus: nextOrderStatus,
            ...(nextOrderStatus === PrismaOrderCrmStatus.COMPLETED
              ? {
                  status: PrismaOrderStatus.PAID,
                }
              : {}),
          },
        });
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

      return updatedOrder;
    });

    return {
      order: this.mapOrder(order),
      previousShipmentStatusCode,
      nextShipmentStatusCode: input.statusCode,
      shipmentStatusChanged,
      userId: existingOrder.userId ?? undefined,
    };
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

  async markOrderAsPaid(orderId: string, userId: string): Promise<OrderDTO> {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const existingOrder = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: orderInclude,
      });
      if (!existingOrder) throw new NotFoundException("Order not found");
      if (
        existingOrder.paymentMethod !== PrismaOrderPaymentMethod.BANK_CARD_MOCK
      ) {
        throw new BadRequestException(
          "Only mock card payments can be confirmed by the order owner",
        );
      }
      await this.markPaidInTransaction(tx, existingOrder, {
        authorId: userId,
        provider: "bank_card_mock",
        source: "payment_confirmed",
      });
      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!updatedOrder) throw new NotFoundException("Order not found");
      return updatedOrder;
    });

    return this.mapOrder(order);
  }

  private mapOrder(order: StoredOrder): OrderDTO {
    return {
      id: order.id,
      cartId: order.cartId,
      status: this.mapOrderCrmStatus(order.crmStatus),
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
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
    method: PaymentMethod,
  ): PrismaOrderPaymentMethod {
    switch (method) {
      case "bank_card_mock":
        return PrismaOrderPaymentMethod.BANK_CARD_MOCK;
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

  private async markPaidInTransaction(
    tx: Prisma.TransactionClient,
    order: StoredOrder,
    input: { provider: string; source: string; authorId?: string },
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
    await tx.order.update({
      where: { id: order.id },
      data: {
        crmStatus: PrismaOrderCrmStatus.PAID,
        paidAt: order.paidAt ?? new Date(),
        paymentErrorCode: null,
        paymentErrorMessage: null,
        paymentStatus: PrismaOrderPaymentStatus.PAID,
        status: PrismaOrderStatus.PAID,
      },
    });
    if (order.crmStatus !== PrismaOrderCrmStatus.PAID) {
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          authorId: input.authorId,
          eventType: "status_changed",
          payload: this.toPrismaJson({
            fromStatus: this.mapOrderCrmStatus(order.crmStatus),
            source: input.source,
            toStatus: "paid",
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
      if (existing.paymentStatus === PrismaOrderPaymentStatus.PAID) {
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

  private assertReceiptPricing(
    pricing: ReturnType<typeof calculatePromoPricing>,
    deliveryPrice: number,
    paymentMethod: PaymentMethod,
  ) {
    const deliveryKopecks = rublesToKopecks({
      toString: () => String(deliveryPrice),
    });
    if (
      pricing.items.some((item) =>
        item.priceGroups.some((group) => group.unitPriceKopecks <= 0),
      ) ||
      pricing.totalKopecks + deliveryKopecks <= 0
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
