import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  AdminOrderDTO,
  CalculateCheckoutRequestDTO,
  CheckoutCalculationDTO,
  CreateOrderAdminCommentRequestDTO,
  CreateOrderRequestDTO,
  OrderDTO,
  OrderStateDTO,
  PickupPointDTO,
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
  ) {}

  @ValidateResponse(PickupPointDTO, { isArray: true })
  @ApiOperation({
    summary: "Get available Ozon pickup points",
    description:
      "Compatibility endpoint for checkout. In mock mode returns available mock Ozon points. In real mode reads points through Ozon Logistics map and point-info.",
  })
  @ApiOkResponse({ type: [PickupPointDTO] })
  @Get("pickup-points")
  getPickupPoints() {
    return this.ordersService.getPickupPoints();
  }

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

  @UseGuards(AuthGuard)
  @ValidateResponse(CheckoutCalculationDTO)
  @Post("checkout/calculate")
  @ApiOperation({
    summary: "Calculate checkout totals for Ozon pickup address",
    description:
      "Uses the current cart cookie and provided nearest Ozon pickup address to calculate order total on the backend.",
  })
  @ApiBody({
    type: CalculateCheckoutRequestDTO,
    examples: {
      ozonPickup: {
        summary: "Ozon pickup address",
        value: {
          delivery: {
            provider: "ozon",
            pickupPointAddress: "Москва, ул. Примерная, 1",
          },
        },
      },
    },
  })
  @ApiOkResponse({ type: CheckoutCalculationDTO })
  calculateCheckout(
    @Body() request: CalculateCheckoutRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
  ) {
    return this.ordersService.calculateCheckout(
      this.getCartId(cookieHeader),
      request,
    );
  }

  @UseGuards(AuthGuard)
  @ValidateResponse(OrderDTO)
  @Post()
  @ApiOperation({
    summary: "Create order from the current cart and notify Telegram",
    description:
      "Creates an order from the current cart, sends the order details to Telegram, and clears the cart after successful notification.",
  })
  @ApiOkResponse({ type: OrderDTO })
  async createOrder(
    @Body() request: CreateOrderRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
    @Req() authRequest: AuthenticatedRequest,
  ) {
    return this.ordersService.createOrder(
      this.getCartId(cookieHeader),
      request,
      authRequest.user,
    );
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

  @UseGuards(AuthGuard)
  @ValidateResponse(OrderDTO)
  @Post(":orderId/confirm-payment")
  @ApiOperation({
    summary: "Confirm mock payment",
    description:
      "Marks the order as paid and clears the cart. This is a mock payment transition without real acquiring.",
  })
  @ApiOkResponse({ type: OrderDTO })
  confirmPayment(
    @Param("orderId") orderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.confirmPayment(orderId, request.user);
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

    return decodeURIComponent(rawCartId);
  }
}
