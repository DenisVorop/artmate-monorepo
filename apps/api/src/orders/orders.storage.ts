import { randomUUID } from "node:crypto";

import { Injectable, NotFoundException } from "@nestjs/common";

import type { CartItemDTO } from "../cart/dto";

import type {
  OrderCustomerDTO,
  OrderDTO,
  OrderDeliveryDTO,
  OrderPaymentDTO,
  PickupPointDTO,
} from "./dto";

const CHECKOUT_SUCCESS_PATH = "/checkout/success";

const OZON_PICKUP_POINTS: PickupPointDTO[] = [
  {
    id: "ozon-tverskaya-12",
    title: "Ozon ПВЗ, Тверская",
    address: "Москва, ул. Тверская, 12с1",
    workHours: "Ежедневно 09:00-22:00",
    deliveryPrice: 350,
  },
  {
    id: "ozon-pyatnitskaya-8",
    title: "Ozon ПВЗ, Пятницкая",
    address: "Москва, ул. Пятницкая, 8",
    workHours: "Ежедневно 10:00-21:00",
    deliveryPrice: 350,
  },
  {
    id: "ozon-leningradskiy-31",
    title: "Ozon ПВЗ, Ленинградский проспект",
    address: "Москва, Ленинградский проспект, 31А",
    workHours: "Пн-Сб 09:00-21:00, Вс 10:00-20:00",
    deliveryPrice: 390,
  },
];

type CreateStoredOrderInput = {
  cartId: string;
  customer: OrderCustomerDTO;
  delivery: OrderDeliveryDTO;
  items: CartItemDTO[];
  itemsCount: number;
  subtotal: number;
  comment?: string;
};

@Injectable()
export class OrdersStorage {
  private readonly orders = new Map<string, OrderDTO>();

  getPickupPoints(): PickupPointDTO[] {
    return OZON_PICKUP_POINTS.map((point) => ({ ...point }));
  }

  getPickupPoint(pickupPointId: string): PickupPointDTO | undefined {
    const point = OZON_PICKUP_POINTS.find((item) => item.id === pickupPointId);

    return point ? { ...point } : undefined;
  }

  createOrder(input: CreateStoredOrderInput): OrderDTO {
    const id = this.createOrderId();
    const deliveryPrice = input.delivery.pickupPoint.deliveryPrice;
    const payment: OrderPaymentDTO = {
      method: "bank_card_mock",
      status: "pending",
      redirectUrl: `${CHECKOUT_SUCCESS_PATH}?orderId=${encodeURIComponent(id)}`,
    };
    const order: OrderDTO = {
      id,
      cartId: input.cartId,
      status: "pending_payment",
      customer: input.customer,
      delivery: input.delivery,
      payment,
      items: input.items.map((item) => ({ ...item })),
      itemsCount: input.itemsCount,
      subtotal: input.subtotal,
      deliveryPrice,
      total: input.subtotal + deliveryPrice,
      currency: "RUB",
      comment: input.comment,
      createdAt: new Date().toISOString(),
    };

    this.orders.set(order.id, order);

    return this.cloneOrder(order);
  }

  getOrder(orderId: string): OrderDTO {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.cloneOrder(order);
  }

  markOrderAsPaid(orderId: string): OrderDTO {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.status !== "paid") {
      order.status = "paid";
      order.payment.status = "paid";
      order.paidAt = new Date().toISOString();
    }

    return this.cloneOrder(order);
  }

  private cloneOrder(order: OrderDTO): OrderDTO {
    return {
      ...order,
      customer: { ...order.customer },
      delivery: {
        provider: order.delivery.provider,
        pickupPoint: { ...order.delivery.pickupPoint },
      },
      payment: { ...order.payment },
      items: order.items.map((item) => ({ ...item })),
    };
  }

  private createOrderId() {
    return `AM-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
