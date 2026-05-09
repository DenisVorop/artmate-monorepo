import { BadRequestException, Injectable, Logger } from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import { CartService } from "../cart/cart.service";
import { CartStorage } from "../cart/cart.storage";
import { MailerService } from "../mailer/mailer.service";
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
  OrderStateDTO,
  PickupPointDTO,
} from "./dto";
import { OrdersTelegramService } from "./orders-telegram.service";
import { OrdersStorage } from "./orders.storage";

const MAX_COMMENT_LENGTH = ORDER_COMMENT_MAX_LENGTH;
const MAX_ADMIN_COMMENT_LENGTH = ORDER_ADMIN_COMMENT_MAX_LENGTH;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly cartStorage: CartStorage,
    private readonly cartService: CartService,
    private readonly mailerService: MailerService,
    private readonly ozonLogisticsService: OzonLogisticsService,
    private readonly ordersStorage: OrdersStorage,
    private readonly ordersTelegramService: OrdersTelegramService,
  ) {}

  getPickupPoints(): Promise<PickupPointDTO[]> {
    return this.ozonLogisticsService.getPickupPoints();
  }

  getOrder(orderId: string, user: AuthUser): Promise<OrderDTO> {
    return this.ordersStorage.getOrder(
      this.parseOrderId(orderId),
      user.id,
    );
  }

  async getOrderState(
    orderId: string,
    user: AuthUser,
  ): Promise<OrderStateDTO> {
    const order = await this.getOrder(orderId, user);

    return {
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment.status,
    };
  }

  getMyOrders(user: AuthUser): Promise<OrderDTO[]> {
    return this.ordersStorage.getOrdersByUserId(user.id);
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
    user: AuthUser,
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
      userId: user.id,
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
    await Promise.all([
      this.notifyAdminAboutOrderCreated(order),
      this.notifyCustomerAboutOrderCreated(order, user.id),
    ]);
    await this.cartService.clearCart(order.cartId);

    return order;
  }

  async confirmPayment(orderId: string, user: AuthUser): Promise<OrderDTO> {
    const order = await this.ordersStorage.markOrderAsPaid(
      this.parseOrderId(orderId),
      user.id,
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
    order: AdminOrderDTO;
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

  private async notifyCustomerAboutOrderCreated(order: OrderDTO, userId: string) {
    await Promise.all([
      this.sendOrderCreatedEmail(order),
      this.sendOrderCreatedTelegram(order, userId),
    ]);
  }

  private async sendOrderCreatedEmail(order: OrderDTO) {
    try {
      await this.mailerService.sendMail({
        to: order.customer.email,
        subject: `Заказ ${order.id} принят - Artmate`,
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
      `Заказ ${order.id} принят.`,
      "",
      `${order.customer.name}, спасибо за заказ. Мы получили заявку и скоро свяжемся с вами для подтверждения деталей.`,
      "",
      `Итого: ${this.formatMoney(order.total)}`,
      `Телефон: ${order.customer.phone}`,
      "",
      "Если вы не оформляли этот заказ, ответьте на это письмо или свяжитесь с поддержкой Artmate.",
    ].join("\n");
  }

  private renderOrderCreatedHtmlEmail(order: OrderDTO) {
    const escapedOrderId = this.escapeHtml(order.id);
    const escapedName = this.escapeHtml(order.customer.name);
    const escapedPhone = this.escapeHtml(order.customer.phone);
    const total = this.escapeHtml(this.formatMoney(order.total));

    return `
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Заказ ${escapedOrderId} принят</title>
        </head>
        <body style="margin:0;padding:0;background:#f4f1ec;color:#2f2923;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ec;margin:0;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e6ded3;border-radius:18px;overflow:hidden;">
                  <tr>
                    <td style="padding:28px 32px 22px;background:#2f2923;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#d9b46d;">ARTMATE</div>
                      <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;font-weight:700;color:#fffaf0;">Заказ принят</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px 32px 12px;font-family:Arial,Helvetica,sans-serif;">
                      <p style="margin:0;color:#5f554b;font-size:16px;line-height:24px;">${escapedName}, спасибо за заказ ${escapedOrderId}. Мы получили заявку и скоро свяжемся с вами для подтверждения деталей.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 32px 20px;font-family:Arial,Helvetica,sans-serif;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;background:#faf7f1;">
                        <tr>
                          <td style="padding:16px 18px;color:#6b6055;font-size:14px;line-height:22px;">
                            <strong style="color:#2f2923;">Итого:</strong> ${total}<br />
                            <strong style="color:#2f2923;">Телефон:</strong> ${escapedPhone}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 32px;background:#fbfaf8;border-top:1px solid #eee7dc;font-family:Arial,Helvetica,sans-serif;color:#8b8177;font-size:12px;line-height:18px;">
                      Если вы не оформляли этот заказ, ответьте на это письмо или свяжитесь с поддержкой Artmate.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private formatMoney(value: number) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}
