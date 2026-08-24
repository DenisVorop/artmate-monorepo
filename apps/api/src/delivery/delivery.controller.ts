import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ValidateResponse } from "../common/response-validation.interceptor";

import {
  DeliveryCityDTO,
  DeliveryPickupPointDTO,
  SearchDeliveryCitiesQueryDTO,
  SearchDeliveryPickupPointsQueryDTO,
  StorefrontOzonDeliveryMapRequestDTO,
  StorefrontOzonDeliveryMapResponseDTO,
  StorefrontOzonDeliveryPointInfoRequestDTO,
} from "./dto";
import { DeliveryProxyThrottleService } from "./delivery-proxy-throttle.service";
import { DeliveryService } from "./delivery.service";

@ApiTags("Delivery")
@Controller("delivery")
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly deliveryProxyThrottleService: DeliveryProxyThrottleService,
  ) {}

  @Post("ozon/map")
  @HttpCode(HttpStatus.OK)
  @ValidateResponse(StorefrontOzonDeliveryMapResponseDTO)
  getOzonDeliveryMap(
    @Body() body: StorefrontOzonDeliveryMapRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
  ) {
    this.deliveryProxyThrottleService.assertAllowed({
      cookieHeader,
      forwardedFor,
      realIp,
      requestIp,
    });

    return this.deliveryService.getOzonDeliveryMap(body);
  }

  @Post("ozon/points/info")
  @HttpCode(HttpStatus.OK)
  @ValidateResponse(DeliveryPickupPointDTO, { isArray: true })
  getOzonDeliveryPoints(
    @Body() body: StorefrontOzonDeliveryPointInfoRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
  ) {
    this.deliveryProxyThrottleService.assertAllowed({
      cookieHeader,
      forwardedFor,
      realIp,
      requestIp,
    });

    return this.deliveryService.getOzonDeliveryPoints(body.mapPointIds);
  }

  @ValidateResponse(DeliveryCityDTO, { isArray: true })
  @ApiOperation({ summary: "Search CDEK cities by name" })
  @ApiOkResponse({ type: [DeliveryCityDTO] })
  @Get("cdek/cities")
  searchCdekCities(@Query() query: SearchDeliveryCitiesQueryDTO) {
    return this.deliveryService.searchCdekCities(
      query.query,
      query.countryCode,
    );
  }

  @ValidateResponse(DeliveryPickupPointDTO, { isArray: true })
  @ApiOperation({ summary: "Get CDEK pickup points for city" })
  @ApiOkResponse({ type: [DeliveryPickupPointDTO] })
  @Get("cdek/pickup-points")
  getCdekPickupPoints(@Query() query: SearchDeliveryPickupPointsQueryDTO) {
    return this.deliveryService.getCdekPickupPoints(query.cityCode);
  }
}
