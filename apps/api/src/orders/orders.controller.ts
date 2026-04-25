import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";

import { ValidateResponse } from "../common/response-validation.interceptor";

import {
  CreateOrderRequestDTO,
  OrderDTO,
  PickupPointDTO,
} from "./dto";
import { OrdersService } from "./orders.service";

const CART_COOKIE_NAME = "cart_id";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ValidateResponse(PickupPointDTO, { isArray: true })
  @Get("pickup-points")
  getPickupPoints() {
    return this.ordersService.getPickupPoints();
  }

  @ValidateResponse(OrderDTO)
  @Post()
  createOrder(
    @Body() request: CreateOrderRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
  ) {
    return this.ordersService.createOrder(
      this.getCartId(cookieHeader),
      request,
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
}
