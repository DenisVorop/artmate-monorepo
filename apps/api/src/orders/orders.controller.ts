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
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";

import {
  CalculateCheckoutRequestDTO,
  CheckoutCalculationDTO,
  CreateOrderRequestDTO,
  OrderDTO,
  OrderStateDTO,
  PickupPointDTO,
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
    private readonly authService: AuthService,
    private readonly ordersService: OrdersService,
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
  ) {
    const user = await this.getOptionalUser(cookieHeader);

    return this.ordersService.createOrder(
      this.getCartId(cookieHeader),
      request,
      user,
    );
  }

  @ValidateResponse(OrderStateDTO)
  @Get(":orderId/status")
  @ApiOperation({ summary: "Get order and mock payment status" })
  @ApiOkResponse({ type: OrderStateDTO })
  getOrderState(@Param("orderId") orderId: string) {
    return this.ordersService.getOrderState(orderId);
  }

  @ValidateResponse(OrderDTO)
  @Get(":orderId")
  @ApiOperation({ summary: "Get order by ID" })
  @ApiOkResponse({ type: OrderDTO })
  getOrder(@Param("orderId") orderId: string) {
    return this.ordersService.getOrder(orderId);
  }

  @ValidateResponse(OrderDTO)
  @Post(":orderId/confirm-payment")
  @ApiOperation({
    summary: "Confirm mock payment",
    description:
      "Marks the order as paid and clears the cart. This is a mock payment transition without real acquiring.",
  })
  @ApiOkResponse({ type: OrderDTO })
  confirmPayment(@Param("orderId") orderId: string) {
    return this.ordersService.confirmPayment(orderId);
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

  private async getOptionalUser(cookieHeader?: string) {
    const session = await this.authService.getSession(undefined, cookieHeader);

    return session.user ?? undefined;
  }
}
