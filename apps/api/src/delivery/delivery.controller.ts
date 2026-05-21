import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ValidateResponse } from "../common/response-validation.interceptor";

import {
  DeliveryCityDTO,
  DeliveryPickupPointDTO,
  SearchDeliveryCitiesQueryDTO,
  SearchDeliveryPickupPointsQueryDTO,
} from "./dto";
import { DeliveryService } from "./delivery.service";

@ApiTags("Delivery")
@Controller("delivery")
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

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
