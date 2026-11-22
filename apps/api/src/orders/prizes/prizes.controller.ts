import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { DeliveryProxyThrottleService } from "../../delivery/delivery-proxy-throttle.service";
import { ValidateResponse } from "../../common/response-validation.interceptor";
import { OrderDTO } from "../dto/order.dto";
import { AuthGuard } from "../../auth/auth.guard";
import type { AuthUser } from "../../auth/auth.types";
import { OrderPrizesService } from "./prizes.service";
import { CreatePrizeOrderRequestDTO } from "./prize-order.dto";

@Controller("orders/prizes")
@UseGuards(AuthGuard)
export class OrderPrizesController {
  constructor(
    private readonly prizes: OrderPrizesService,
    private readonly throttle: DeliveryProxyThrottleService,
  ) {}
  @Header("Cache-Control", "private, no-store")
  @Get()
  list(@Req() request: { user: AuthUser }) {
    return this.prizes.list(request.user.id);
  }
  @Header("Cache-Control", "private, no-store")
  @Get(":id")
  get(@Param("id") id: string, @Req() request: { user: AuthUser }) {
    return this.prizes.get(request.user.id, id);
  }
  @Post(":id/order")
  @ValidateResponse(OrderDTO)
  redeem(
    @Param("id") id: string,
    @Body() input: CreatePrizeOrderRequestDTO,
    @Req()
    request: {
      user: AuthUser;
      ip?: string;
      headers: {
        cookie?: string;
        "x-forwarded-for"?: string;
        "x-real-ip"?: string;
      };
    },
  ) {
    this.throttle.assertAllowed({
      requestIp: request.ip,
      cookieHeader: request.headers.cookie,
      forwardedFor: request.headers["x-forwarded-for"],
      realIp: request.headers["x-real-ip"],
    });
    return this.prizes.redeem(request.user.id, id, input);
  }
}
