import { randomUUID } from "node:crypto";

import { Injectable, NotFoundException } from "@nestjs/common";

import type { CartItemDTO } from "../cart/dto";
import {
  OrderDeliveryProvider as PrismaOrderDeliveryProvider,
  OrderPaymentMethod as PrismaOrderPaymentMethod,
  OrderPaymentStatus as PrismaOrderPaymentStatus,
  OrderStatus as PrismaOrderStatus,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  OrderCustomerDTO,
  OrderDTO,
  OrderDeliveryDTO,
  OrderPaymentDTO,
} from "./dto";

const CHECKOUT_SUCCESS_PATH = "/checkout/success";

const orderInclude = {
  items: {
    orderBy: {
      createdAt: "asc",
    },
  },
} as const;

type CreateStoredOrderInput = {
  userId?: string;
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

  async getOrder(orderId: string): Promise<OrderDTO> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
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

  private async getExistingUserId(userId?: string) {
    if (!userId) {
      return undefined;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    return user?.id;
  }

  async markOrderAsPaid(orderId: string): Promise<OrderDTO> {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!existingOrder) {
      throw new NotFoundException("Order not found");
    }

    if (existingOrder.status === PrismaOrderStatus.PAID) {
      return this.mapOrder(existingOrder);
    }

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: PrismaOrderStatus.PAID,
        paymentStatus: PrismaOrderPaymentStatus.PAID,
        paidAt: new Date(),
      },
      include: orderInclude,
    });

    return this.mapOrder(order);
  }

  private mapOrder(order: StoredOrder): OrderDTO {
    return {
      id: order.id,
      cartId: order.cartId,
      status: this.mapOrderStatus(order.status),
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

  private createOrderId() {
    return `AM-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private mapOrderStatus(status: PrismaOrderStatus): OrderDTO["status"] {
    return status === PrismaOrderStatus.PAID ? "paid" : "pending_payment";
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
}
