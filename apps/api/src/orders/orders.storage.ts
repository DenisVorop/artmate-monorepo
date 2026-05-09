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
} from "./dto";
import type { OrderStatus } from "./orders.constants";

const CHECKOUT_SUCCESS_PATH = "/checkout/success";

const orderInclude = {
  items: {
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
  subtotal: number;
  comment?: string;
};

type StoredOrder = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

type StoredAdminOrder = Prisma.OrderGetPayload<{
  include: typeof adminOrderInclude;
}>;

@Injectable()
export class OrdersStorage {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(input: CreateStoredOrderInput): Promise<OrderDTO> {
    const deliveryPrice = input.delivery.pickupPoint.deliveryPrice;
    const total = input.subtotal + deliveryPrice;
    const userId = await this.getExistingUserId(input.userId);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = this.createOrderId();

      try {
        const order = await this.prisma.order.create({
          data: {
            id,
            userId,
            cartId: input.cartId,
            status: PrismaOrderStatus.PENDING_PAYMENT,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerEmail: input.customer.email,
            deliveryProvider: PrismaOrderDeliveryProvider.OZON,
            pickupPointId: input.delivery.pickupPoint.id,
            pickupPointTitle: input.delivery.pickupPoint.title,
            pickupPointAddress: input.delivery.pickupPoint.address,
            pickupPointWorkHours: input.delivery.pickupPoint.workHours,
            deliveryPrice,
            paymentMethod: PrismaOrderPaymentMethod.BANK_CARD_MOCK,
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
                  toStatus: "new",
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

  async updateAdminOrderStatus(
    orderId: string,
    status: OrderStatus,
    authorId: string,
  ): Promise<AdminOrderDTO> {
    const existingAuthorId = await this.getExistingUserId(authorId);
    const nextStatus = this.mapPrismaOrderStatus(status);

    return this.prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { crmStatus: true, paidAt: true },
      });

      if (!existingOrder) {
        throw new NotFoundException("Order not found");
      }

      if (existingOrder.crmStatus !== nextStatus) {
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
              fromStatus: this.mapOrderCrmStatus(existingOrder.crmStatus),
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

      return this.mapAdminOrder(order);
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

  private async getAdminOrder(orderId: string): Promise<AdminOrderDTO> {
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
    }
  }

  private mapPaymentStatus(
    status: PrismaOrderPaymentStatus,
  ): OrderPaymentDTO["status"] {
    return status === PrismaOrderPaymentStatus.PAID ? "paid" : "pending";
  }

  private mapDeliveryProvider(
    provider: PrismaOrderDeliveryProvider,
  ): OrderDeliveryDTO["provider"] {
    switch (provider) {
      case PrismaOrderDeliveryProvider.OZON:
        return "ozon";
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private toNumber(value: unknown) {
    return Number(value);
  }

  private isPaidWorkflowStatus(status: OrderStatus) {
    return (
      status === "paid" ||
      status === "delivering" ||
      status === "completed"
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

  private toPrismaJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
