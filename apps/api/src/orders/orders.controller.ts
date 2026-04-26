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
  CreateOrderRequestDTO,
  OrderDTO,
  PickupPointDTO,
} from "./dto";
import { OrdersService } from "./orders.service";

const CART_COOKIE_NAME = "cart_id";

type AuthenticatedRequest = {
  user: AuthUser;
};

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly authService: AuthService,
    private readonly ordersService: OrdersService,
  ) {}

  @ValidateResponse(PickupPointDTO, { isArray: true })
  @Get("pickup-points")
  getPickupPoints() {
    return this.ordersService.getPickupPoints();
  }

  @UseGuards(AuthGuard)
  @ValidateResponse(OrderDTO, { isArray: true })
  @Get("my")
  getMyOrders(@Req() request: AuthenticatedRequest) {
    return this.ordersService.getMyOrders(request.user);
  }

  @ValidateResponse(OrderDTO)
  @Post()
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

  @ValidateResponse(OrderDTO)
  @Get(":orderId")
  getOrder(@Param("orderId") orderId: string) {
    return this.ordersService.getOrder(orderId);
  }

  @ValidateResponse(OrderDTO)
  @Post(":orderId/confirm-payment")
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
