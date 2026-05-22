import { BadRequestException, Injectable, Logger } from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import { CartService } from "../cart/cart.service";
import { CartStorage } from "../cart/cart.storage";
import { DeliveryService } from "../delivery/delivery.service";
import type { DeliverySelection } from "../delivery/providers/delivery-provider.interface";
import {
  escapeEmailHtml,
  renderBrandedEmail,
  renderEmailDetails,
  renderEmailParagraph,
  renderSupportEmailFooter,
  renderSupportEmailFooterText,
} from "../mailer/branded-email";
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
    private readonly deliveryService: DeliveryService,
    private readonly mailerService: MailerService,
    private readonly ozonLogisticsService: OzonLogisticsService,
    private readonly ordersStorage: OrdersStorage,
    private readonly ordersTelegramService: OrdersTelegramService,
  ) {}

  getPickupPoints(): Promise<PickupPointDTO[]> {
    return this.ozonLogisticsService.getPickupPoints();
  }

  getOrder(orderId: string, user: AuthUser): Promise<OrderDTO> {
    return this.ordersStorage.getOrder(this.parseOrderId(orderId), user.id);
  }

  async getOrderState(orderId: string, user: AuthUser): Promise<OrderStateDTO> {
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

    const delivery = await this.deliveryService.calculatePickupPointDelivery(
      this.parseDeliverySelection(request.delivery),
      cartDTO.items,
    );
    const deliveryPrice = delivery.deliveryPrice;

    return {
      cartId: cartDTO.id,
      itemsCount: cartDTO.itemsCount,
      subtotal: cartDTO.subtotal,
      deliveryPrice,
      total: cartDTO.subtotal + deliveryPrice,
      currency: "RUB",
      delivery: {
        provider: delivery.provider,
        pickupPoint: delivery.pickupPoint,
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
    const delivery = await this.deliveryService.calculatePickupPointDelivery(
      this.parseDeliverySelection(request.delivery),
      cartDTO.items,
    );
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
        provider: delivery.provider,
        pickupPoint: delivery.pickupPoint,
      },
      items: cartDTO.items,
      itemsCount: cartDTO.itemsCount,
      subtotal: cartDTO.subtotal,
      comment,
    });
    await this.cartService.clearCart(order.cartId);
    this.queueOrderCreatedNotifications(order, user.id);

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

  private parseDeliverySelection(value: unknown): DeliverySelection {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("delivery is required");
    }

    const delivery = value as Record<string, unknown>;
    const provider = delivery.provider;

    if (provider !== "ozon" && provider !== "cdek") {
      throw new BadRequestException("delivery.provider must be ozon or cdek");
    }

    return {
      cityCode: this.parseOptionalPositiveInteger(
        delivery.cityCode,
        "delivery.cityCode",
      ),
      pickupPointAddress: this.parseOptionalString(delivery.pickupPointAddress),
      pickupPointId: this.parseOptionalString(delivery.pickupPointId),
      provider,
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

  private queueOrderCreatedNotifications(order: OrderDTO, userId: string) {
    setImmediate(() => {
      void this.notifyOrderCreated(order, userId).catch((error) => {
        this.logger.warn(
          `Failed to process queued notifications for order ${order.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    });
  }

  private async notifyOrderCreated(order: OrderDTO, userId: string) {
    await Promise.all([
      this.notifyAdminAboutOrderCreated(order),
      this.notifyCustomerAboutOrderCreated(order, userId),
    ]);
  }

  private async notifyCustomerAboutOrderCreated(
    order: OrderDTO,
    userId: string,
  ) {
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
      "Товары:",
      ...this.renderOrderItemsTextEmail(order),
      "",
      "Стоимость заказа:",
      `Товары: ${this.formatMoney(order.subtotal)}`,
      `Доставка: ${this.formatMoney(order.deliveryPrice)}`,
      `Итого: ${this.formatMoney(order.total)}`,
      "",
      `Телефон: ${order.customer.phone}`,
      "",
      renderSupportEmailFooterText(),
    ].join("\n");
  }

  private renderOrderCreatedHtmlEmail(order: OrderDTO) {
    const escapedOrderId = escapeEmailHtml(order.id);
    const escapedName = escapeEmailHtml(order.customer.name);

    return renderBrandedEmail({
      title: "Заказ принят",
      previewText: `Заказ ${order.id} принят Artmate.`,
      contentHtml: `
        ${renderEmailParagraph(
          `${escapedName}, спасибо за заказ ${escapedOrderId}. Мы получили заявку и скоро свяжемся с вами для подтверждения деталей.`,
        )}
        ${this.renderOrderItemsHtmlEmail(order)}
        ${renderEmailDetails([
          { label: "Товары", value: this.formatMoney(order.subtotal) },
          { label: "Доставка", value: this.formatMoney(order.deliveryPrice) },
          { label: "Итого", value: this.formatMoney(order.total) },
          { label: "Телефон", value: order.customer.phone },
        ])}
      `,
      footerHtml: renderSupportEmailFooter(),
    });
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
