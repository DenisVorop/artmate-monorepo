import { BadRequestException, Injectable } from "@nestjs/common";

import { CartService } from "../cart/cart.service";
import { CartStorage } from "../cart/cart.storage";

import { ORDER_COMMENT_MAX_LENGTH } from "./orders.constants";
import type { CreateOrderRequestDTO, OrderDTO, PickupPointDTO } from "./dto";
import { OrdersStorage } from "./orders.storage";

const MAX_COMMENT_LENGTH = ORDER_COMMENT_MAX_LENGTH;

@Injectable()
export class OrdersService {
  constructor(
    private readonly cartStorage: CartStorage,
    private readonly cartService: CartService,
    private readonly ordersStorage: OrdersStorage,
  ) {}

  getPickupPoints(): PickupPointDTO[] {
    return this.ordersStorage.getPickupPoints();
  }

  getOrder(orderId: string): Promise<OrderDTO> {
    return this.ordersStorage.getOrder(this.parseOrderId(orderId));
  }

  async createOrder(
    cartId: string | undefined,
    request: CreateOrderRequestDTO,
  ): Promise<OrderDTO> {
    const cart = await this.cartStorage.ensureCart(cartId);
    const cartDTO = this.cartStorage.getDTO(cart);

    if (cartDTO.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    const customer = this.parseCustomer(request.customer);
    const pickupPoint = this.parsePickupPoint(request.delivery);
    const paymentMethod = request.payment?.method;
    const comment = this.parseComment(request.comment);

    if (paymentMethod !== "bank_card_mock") {
      throw new BadRequestException("payment.method must be bank_card_mock");
    }

    if (request.acceptedLegal !== true) {
      throw new BadRequestException("Legal terms must be accepted");
    }

    return this.ordersStorage.createOrder({
      cartId: cartDTO.id,
      customer,
      delivery: {
        provider: "ozon",
        pickupPoint,
      },
      items: cartDTO.items,
      itemsCount: cartDTO.itemsCount,
      subtotal: cartDTO.subtotal,
      comment,
    });
  }

  async confirmPayment(orderId: string): Promise<OrderDTO> {
    const order = await this.ordersStorage.markOrderAsPaid(
      this.parseOrderId(orderId),
    );
    await this.cartService.clearCart(order.cartId);

    return order;
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

  private parsePickupPoint(value: unknown): PickupPointDTO {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("delivery is required");
    }

    const delivery = value as Record<string, unknown>;

    if (delivery.provider !== "ozon") {
      throw new BadRequestException("delivery.provider must be ozon");
    }

    const pickupPointId = this.parseRequiredString(
      delivery.pickupPointId,
      "delivery.pickupPointId",
    );
    const pickupPoint = this.ordersStorage.getPickupPoint(pickupPointId);

    if (!pickupPoint) {
      throw new BadRequestException("Unknown pickup point");
    }

    return pickupPoint;
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
}
