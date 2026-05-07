import { BadRequestException, Injectable } from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import { CartService } from "../cart/cart.service";
import { CartStorage } from "../cart/cart.storage";
import { OzonLogisticsService } from "../ozon/ozon-logistics.service";

import { ORDER_COMMENT_MAX_LENGTH } from "./orders.constants";
import type {
  CalculateCheckoutRequestDTO,
  CheckoutCalculationDTO,
  CreateOrderRequestDTO,
  OrderDTO,
  OrderStateDTO,
  PickupPointDTO,
} from "./dto";
import { OrdersTelegramService } from "./orders-telegram.service";
import { OrdersStorage } from "./orders.storage";

const MAX_COMMENT_LENGTH = ORDER_COMMENT_MAX_LENGTH;

@Injectable()
export class OrdersService {
  constructor(
    private readonly cartStorage: CartStorage,
    private readonly cartService: CartService,
    private readonly ozonLogisticsService: OzonLogisticsService,
    private readonly ordersStorage: OrdersStorage,
    private readonly ordersTelegramService: OrdersTelegramService,
  ) {}

  getPickupPoints(): Promise<PickupPointDTO[]> {
    return this.ozonLogisticsService.getPickupPoints();
  }

  getOrder(orderId: string): Promise<OrderDTO> {
    return this.ordersStorage.getOrder(this.parseOrderId(orderId));
  }

  async getOrderState(orderId: string): Promise<OrderStateDTO> {
    const order = await this.getOrder(orderId);

    return {
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment.status,
    };
  }

  getMyOrders(user: AuthUser): Promise<OrderDTO[]> {
    return this.ordersStorage.getOrdersByUserId(user.id);
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

    const pickupPoint = this.parsePickupPoint(request.delivery);
    const deliveryPrice = pickupPoint.deliveryPrice;

    return {
      cartId: cartDTO.id,
      itemsCount: cartDTO.itemsCount,
      subtotal: cartDTO.subtotal,
      deliveryPrice,
      total: cartDTO.subtotal + deliveryPrice,
      currency: "RUB",
      delivery: {
        provider: "ozon",
        pickupPoint,
      },
    };
  }

  async createOrder(
    cartId: string | undefined,
    request: CreateOrderRequestDTO,
    user?: AuthUser,
  ): Promise<OrderDTO> {
    const cart = await this.cartStorage.ensureCart(cartId);
    const cartDTO = this.cartStorage.getDTO(cart);

    if (cartDTO.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    const customer = this.parseCustomer(request.customer);
    const pickupPoint = this.getFormOrderDelivery();
    const paymentMethod = request.payment?.method ?? "bank_card_mock";
    const comment = this.parseComment(request.comment);

    if (paymentMethod !== "bank_card_mock") {
      throw new BadRequestException("payment.method must be bank_card_mock");
    }

    if (request.acceptedLegal !== true) {
      throw new BadRequestException("Legal terms must be accepted");
    }

    const order = await this.ordersStorage.createOrder({
      userId: user?.id,
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
    await this.ordersTelegramService.sendOrderCreated(order);
    await this.cartService.clearCart(order.cartId);

    return order;
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

    const pickupPointAddress = this.parseRequiredString(
      delivery.pickupPointAddress,
      "delivery.pickupPointAddress",
    );

    return {
      id: "manual-ozon-pickup",
      title: "Заявка из формы",
      address: pickupPointAddress,
      workHours: "Уточняется",
      deliveryPrice: 0,
    };
  }

  private getFormOrderDelivery(): PickupPointDTO {
    return {
      id: "telegram-order",
      title: "Заявка из формы",
      address: "Детали согласуются после подтверждения заказа",
      workHours: "Менеджер свяжется с клиентом",
      deliveryPrice: 0,
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
