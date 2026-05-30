import { randomUUID } from "node:crypto";

import { Injectable, NotFoundException } from "@nestjs/common";

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
};

type ApplyOzonAcquiringNotificationResult = {
  order: OrderDTO;
  paymentStatusChangedToPaid: boolean;
  previousStatus: OrderStatus;
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
  constructor(private readonly prisma: PrismaService) {}

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
        const order = await this.prisma.order.create({
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
          include: orderInclude,
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
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { crmStatus: true, paidAt: true, userId: true },
      });

      if (!existingOrder) {
        throw new NotFoundException("Order not found");
      }

      const previousStatus = this.mapOrderCrmStatus(existingOrder.crmStatus);
      const changed = existingOrder.crmStatus !== nextStatus;

      if (changed) {
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
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ozonAcquiringOrderId: input.acquiringOrderId,
        ozonAcquiringPaymentId: input.paymentId,
        paymentErrorCode: null,
        paymentErrorMessage: null,
        paymentMethod: PrismaOrderPaymentMethod.OZON_ACQUIRING,
        paymentRedirectUrl: input.redirectUrl,
        paymentStatus: PrismaOrderPaymentStatus.PENDING,
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

    return this.mapOrder(order);
  }

  async markOzonAcquiringPaymentFailed(
    orderId: string,
    input: MarkOzonAcquiringPaymentFailedInput,
  ): Promise<OrderDTO> {
    const order = await this.prisma.order.update({
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
              provider: "ozon_acquiring",
            }),
          },
        },
      },
      include: orderInclude,
    });

    return this.mapOrder(order);
  }

  async applyOzonAcquiringNotification(
    input: ApplyOzonAcquiringNotificationInput,
  ): Promise<ApplyOzonAcquiringNotificationResult | undefined> {
    if (
      !input.extOrderId &&
      !input.extTransactionId &&
      !input.acquiringOrderId
    ) {
      return undefined;
    }

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          ...(input.extOrderId ? [{ id: input.extOrderId }] : []),
          ...(input.extTransactionId ? [{ id: input.extTransactionId }] : []),
          ...(input.acquiringOrderId
            ? [{ ozonAcquiringOrderId: input.acquiringOrderId }]
            : []),
        ],
      },
      include: orderInclude,
    });

    if (!order) {
      return undefined;
    }

    const previousStatus = this.mapOrderCrmStatus(order.crmStatus);
    const isPaymentCompleted = input.status === "Completed";
    const isPaymentRejected = input.status === "Rejected";
    const shouldMarkPaid =
      isPaymentCompleted &&
      order.paymentStatus !== PrismaOrderPaymentStatus.PAID;
    const shouldMarkFailed =
      isPaymentRejected &&
      order.paymentStatus === PrismaOrderPaymentStatus.PENDING;

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          lastPaymentNotification: this.toPrismaJson(input.raw),
          ozonAcquiringOrderId:
            input.acquiringOrderId ?? order.ozonAcquiringOrderId,
          ozonAcquiringTransactionId:
            input.transactionId ?? order.ozonAcquiringTransactionId,
          ozonAcquiringTransactionUid:
            input.transactionUid ?? order.ozonAcquiringTransactionUid,
          paymentErrorCode: isPaymentRejected
            ? input.errorCode
            : order.paymentErrorCode,
          paymentErrorMessage: isPaymentRejected
            ? input.errorMessage
            : order.paymentErrorMessage,
          ...(shouldMarkPaid
            ? {
                crmStatus: PrismaOrderCrmStatus.PAID,
                paidAt: order.paidAt ?? new Date(),
                paymentErrorCode: null,
                paymentErrorMessage: null,
                paymentStatus: PrismaOrderPaymentStatus.PAID,
                status: PrismaOrderStatus.PAID,
              }
            : {}),
          ...(shouldMarkFailed
            ? {
                paymentStatus: PrismaOrderPaymentStatus.FAILED,
              }
            : {}),
        },
        include: orderInclude,
      });

      if (shouldMarkPaid && order.crmStatus !== PrismaOrderCrmStatus.PAID) {
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            eventType: "status_changed",
            payload: this.toPrismaJson({
              fromStatus: this.mapOrderCrmStatus(order.crmStatus),
              source: "ozon_acquiring_notification",
              toStatus: "paid",
            }),
          },
        });
      }

      if (shouldMarkFailed) {
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            eventType: "payment_failed",
            payload: this.toPrismaJson({
              errorCode: input.errorCode,
              errorMessage: input.errorMessage,
              provider: "ozon_acquiring",
              status: input.status,
            }),
          },
        });
      }

      return nextOrder;
    });

    return {
      order: this.mapOrder(updatedOrder),
      paymentStatusChangedToPaid: shouldMarkPaid,
      previousStatus,
      userId: order.userId ?? undefined,
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
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: orderInclude,
    });

    if (!existingOrder) {
      throw new NotFoundException("Order not found");
    }

    if (existingOrder.status === PrismaOrderStatus.PAID) {
      return this.mapOrder(existingOrder);
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          crmStatus: PrismaOrderCrmStatus.PAID,
          status: PrismaOrderStatus.PAID,
          paymentStatus: PrismaOrderPaymentStatus.PAID,
          paidAt: existingOrder.paidAt ?? new Date(),
        },
        include: orderInclude,
      });

      if (existingOrder.crmStatus !== PrismaOrderCrmStatus.PAID) {
        await tx.orderHistory.create({
          data: {
            orderId,
            authorId: userId,
            eventType: "status_changed",
            payload: this.toPrismaJson({
              fromStatus: this.mapOrderCrmStatus(existingOrder.crmStatus),
              source: "payment_confirmed",
              toStatus: "paid",
            }),
          },
        });
      }

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
      deliveryPrice: this.toNumber(order.deliveryPrice),
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
      ...(options.includeErrorMessage ?? true
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

  private isPaidWorkflowStatus(status: OrderStatus) {
    return (
      status === "paid" || status === "delivering" || status === "completed"
    );
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
