import { Controller, Get, Headers, Ip, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ValidateResponse } from "../common/response-validation.interceptor";

import {
  CdekCityDetailsDTO,
  DeliveryCityDTO,
  DeliveryPickupPointDTO,
  GetCdekCityQueryDTO,
  SearchDeliveryCitiesQueryDTO,
  SearchDeliveryPickupPointsQueryDTO,
  SearchOzonPickupPointsQueryDTO,
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

  @ValidateResponse(DeliveryPickupPointDTO, { isArray: true })
  @ApiOperation({ summary: "Get all Ozon pickup points for a CDEK city" })
  @ApiOkResponse({ type: [DeliveryPickupPointDTO] })
  @Get("ozon/pickup-points")
  getOzonPickupPoints(
    @Query() query: SearchOzonPickupPointsQueryDTO,
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

    return this.deliveryService.getOzonPickupPoints(query.cityCode);
  }

  @ValidateResponse(DeliveryCityDTO, { isArray: true })
  @ApiOperation({ summary: "Search CDEK cities by name" })
  @ApiOkResponse({ type: [DeliveryCityDTO] })
  @Get("cdek/cities")
  searchCdekCities(
    @Query() query: SearchDeliveryCitiesQueryDTO,
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

    return this.deliveryService.searchCdekCities(
      query.query,
      query.countryCode,
    );
  }

  @ValidateResponse(CdekCityDetailsDTO)
  @ApiOperation({ summary: "Get CDEK city details" })
  @ApiOkResponse({ type: CdekCityDetailsDTO })
  @Get("cdek/city")
  getCdekCity(
    @Query() query: GetCdekCityQueryDTO,
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

    return this.deliveryService.getCdekCity(query.cityCode);
  }

  @ValidateResponse(DeliveryPickupPointDTO, { isArray: true })
  @ApiOperation({ summary: "Get CDEK pickup points for city" })
  @ApiOkResponse({ type: [DeliveryPickupPointDTO] })
  @Get("cdek/pickup-points")
  getCdekPickupPoints(
    @Query() query: SearchDeliveryPickupPointsQueryDTO,
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

    return this.deliveryService.getCdekPickupPoints(query.cityCode);
  }
}
