import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CheckoutThrottleService } from "./checkout-throttle.service";
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { DeliveryProxyThrottleService } from "../delivery/delivery-proxy-throttle.service";
import { UsersService } from "../users/users.service";

import {
  AdminOrderDTO,
  CalculateCheckoutRequestDTO,
  CheckoutCalculationDTO,
  CreateOrderAdminCommentRequestDTO,
  CreateOrderRequestDTO,
  CreateOrderResponseDTO,
  OrderDTO,
  OrderStateDTO,
  PaymentRecoveryResponseDTO,
  UpdateOrderStatusRequestDTO,
} from "./dto";
import { OrdersService } from "./orders.service";

const CART_COOKIE_NAME = "cart_id";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Orders")
@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly deliveryProxyThrottleService: DeliveryProxyThrottleService,
    private readonly authService: AuthService,
    private readonly checkoutThrottleService: CheckoutThrottleService,
  ) {}

  @UseGuards(AuthGuard)
  @ValidateResponse(OrderDTO, { isArray: true })
  @ApiOperation({ summary: "Get current user's orders" })
  @ApiOkResponse({ type: [OrderDTO] })
  @Get("my")
  getMyOrders(@Req() request: AuthenticatedRequest) {
    return this.ordersService.getMyOrders(request.user);
  }

  @UseGuards(AuthGuard)
  @ValidateResponse(AdminOrderDTO, { isArray: true })
  @ApiOperation({ summary: "List all orders for admin CRM board" })
  @ApiOkResponse({ type: [AdminOrderDTO] })
  @Get("admin")
  getAdminOrders(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.ordersService.getAdminOrders();
  }

  @UseGuards(AuthGuard)
  @ValidateResponse(AdminOrderDTO)
  @ApiOperation({ summary: "Get order details for admin CRM" })
  @ApiOkResponse({ type: AdminOrderDTO })
  @Get("admin/:orderId")
  getAdminOrder(
    @Param("orderId") orderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.ordersService.getAdminOrder(orderId);
  }

  @UseGuards(AuthGuard)
  @ValidateResponse(AdminOrderDTO)
  @ApiOperation({ summary: "Update order status from admin panel" })
  @ApiOkResponse({ type: AdminOrderDTO })
  @Patch("admin/:orderId/status")
  updateAdminOrderStatus(
    @Param("orderId") orderId: string,
    @Body() request: UpdateOrderStatusRequestDTO,
    @Req() authRequest: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(authRequest.user, "admin");

    return this.ordersService.updateAdminOrderStatus(
      orderId,
      request.status,
      authRequest.user,
    );
  }

  @UseGuards(AuthGuard)
  @ValidateResponse(AdminOrderDTO)
  @ApiOperation({ summary: "Add internal order comment from admin panel" })
  @ApiOkResponse({ type: AdminOrderDTO })
  @Post("admin/:orderId/comments")
  createAdminOrderComment(
    @Param("orderId") orderId: string,
    @Body() request: CreateOrderAdminCommentRequestDTO,
    @Req() authRequest: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(authRequest.user, "admin");

    return this.ordersService.createAdminOrderComment(
      orderId,
      request.body,
      authRequest.user,
    );
  }

  @ValidateResponse(CheckoutCalculationDTO)
  @Post("checkout/calculate")
  @ApiOperation({
    summary: "Calculate checkout totals for selected delivery",
    description:
      "Uses the current cart cookie and selected delivery provider to calculate order total on the backend.",
  })
  @ApiBody({
    type: CalculateCheckoutRequestDTO,
    examples: {
      cdekPickup: {
        summary: "CDEK pickup point",
        value: {
          delivery: {
            cityCode: 44,
            pickupPointId: "MOS4",
            provider: "cdek",
          },
        },
      },
    },
  })
  @ApiOkResponse({ type: CheckoutCalculationDTO })
  async calculateCheckout(
    @Body() request: CalculateCheckoutRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
    @Headers("authorization") authorization: string | undefined,
  ) {
    if (request.delivery.provider === "ozon") {
      this.deliveryProxyThrottleService.assertAllowed({
        cookieHeader,
        forwardedFor,
        realIp,
        requestIp,
      });
    }

    const token = this.authService.getTokenFromRequest(
      authorization,
      cookieHeader,
    );
    const user = token
      ? await this.authService.verifyAccessToken(token)
      : undefined;

    return this.ordersService.calculateCheckout(
      this.getCartId(cookieHeader),
      request,
      user,
    );
  }

  @ValidateResponse(CreateOrderResponseDTO)
  @Post()
  @ApiOperation({
    summary: "Create order from the current cart",
    description:
      "Creates an order from the current cart, clears the cart, and queues order notifications.",
  })
  @ApiOkResponse({ type: CreateOrderResponseDTO })
  async createOrder(
    @Body() request: CreateOrderRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
    @Headers("authorization") authorization: string | undefined,
  ) {
    const cartId = this.getCartId(cookieHeader);
    await this.checkoutThrottleService.assertAllowed({
      cartId,
      forwardedFor,
      realIp,
      requestIp,
    });

    if (request.delivery?.provider === "ozon") {
      this.deliveryProxyThrottleService.assertAllowed({
        cookieHeader,
        forwardedFor,
        realIp,
        requestIp,
      });
    }

    const token = this.authService.getTokenFromRequest(
      authorization,
      cookieHeader,
    );
    const user = token
      ? await this.authService.verifyAccessToken(token)
      : undefined;

    const order = await this.ordersService.createOrder(cartId, request, user);

    return {
      itemsCount: order.itemsCount,
      orderId: order.id,
      redirectUrl: this.getSafeCreateRedirect(order.payment.redirectUrl),
      revenue: order.subtotal - order.discount,
    } satisfies CreateOrderResponseDTO;
  }

  @ValidateResponse(PaymentRecoveryResponseDTO)
  @Post(":orderId/payment-recovery")
  @ApiOperation({ summary: "Recover a guest payment using the original cart cookie" })
  @ApiOkResponse({ type: PaymentRecoveryResponseDTO })
  recoverPayment(
    @Param("orderId") orderId: string,
    @Headers("cookie") cookieHeader: string | undefined,
  ) {
    return this.ordersService.recoverPayment(
      orderId,
      this.getCartId(cookieHeader),
    );
  }

  @Post("payments/ozon/notifications")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Ozon Acquiring payment notification" })
  handleOzonPaymentNotification(@Body() notification: unknown) {
    return this.ordersService.handleOzonPaymentNotification(notification);
  }

  @Post("payments/tbank/notifications")
  @HttpCode(HttpStatus.OK)
  @Header("content-type", "text/plain; charset=utf-8")
  @ApiOperation({ summary: "Handle T-Bank Acquiring payment notification" })
  handleTBankPaymentNotification(@Body() notification: unknown) {
    return this.ordersService.handleTBankPaymentNotification(notification);
  }

  @Post("delivery/cdek/webhook/:secret")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle CDEK order status webhook" })
  handleCdekOrderStatusWebhook(
    @Param("secret") secret: string,
    @Body() webhook: unknown,
  ) {
    return this.ordersService.handleCdekOrderStatusWebhook(secret, webhook);
  }

  @UseGuards(AuthGuard)
  @ValidateResponse(OrderStateDTO)
  @Get(":orderId/status")
  @ApiOperation({ summary: "Get order and mock payment status" })
  @ApiOkResponse({ type: OrderStateDTO })
  getOrderState(
    @Param("orderId") orderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.getOrderState(orderId, request.user);
  }

  @UseGuards(AuthGuard)
  @ValidateResponse(OrderDTO)
  @Get(":orderId")
  @ApiOperation({ summary: "Get order by ID" })
  @ApiOkResponse({ type: OrderDTO })
  getOrder(
    @Param("orderId") orderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.getOrder(orderId, request.user);
  }

  private getCartId(cookieHeader?: string) {
    if (!cookieHeader) {
      return undefined;
    }

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const cartCookie = cookies.find((cookie) =>
      cookie.startsWith(`${CART_COOKIE_NAME}=`),
    );
    const rawCartId = cartCookie?.slice(CART_COOKIE_NAME.length + 1);

    if (!rawCartId) {
      return undefined;
    }

    try {
      return decodeURIComponent(rawCartId);
    } catch {
      return undefined;
    }
  }

  private getSafeCreateRedirect(value: string) {
    if (value.startsWith("/checkout/payment-initializing")) return null;
    if (value.startsWith("/checkout/success")) return value;
    try {
      return new URL(value).protocol === "https:" ? value : null;
    } catch {
      return null;
    }
  }
}
