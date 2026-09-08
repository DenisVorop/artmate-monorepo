import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { OzonLogisticsService } from "../ozon/ozon-logistics.service";

import {
  cdekCityDetailsCacheTtlMs,
  cdekCitySearchCacheTtlMs,
  cdekPickupPointsCacheTtlMs,
  ozonDeliveryPriceRub,
} from "./delivery.constants";
import { CdekDeliveryProvider } from "./providers/cdek/cdek-delivery.provider";
import { OzonCityPickupPointsService } from "./ozon-city-pickup-points.service";
import { ProviderResponseCacheService } from "./provider-response-cache.service";
import type {
  DeliveryCartItem,
  DeliveryQuote,
  DeliverySelection,
  DeliveryShipmentOrder,
} from "./providers/delivery-provider.interface";

@Injectable()
export class DeliveryService {
  constructor(
    private readonly cdekDeliveryProvider: CdekDeliveryProvider,
    private readonly ozonLogisticsService: OzonLogisticsService,
    private readonly providerResponseCache: ProviderResponseCacheService,
    private readonly ozonCityPickupPointsService: OzonCityPickupPointsService,
  ) {}

  async searchCdekCities(query: string, countryCode?: string) {
    const normalizedQuery = query.trim();
    const normalizedCountryCode = countryCode?.trim().toUpperCase();

    try {
      return await this.providerResponseCache.getOrSet(
        `cdek:cities:${JSON.stringify([normalizedQuery, normalizedCountryCode])}`,
        cdekCitySearchCacheTtlMs,
        () =>
          this.cdekDeliveryProvider.searchCities(
            normalizedQuery,
            normalizedCountryCode,
          ),
      );
    } catch {
      throw new BadGatewayException(
        "Не удалось загрузить города. Попробуйте ещё раз.",
      );
    }
  }

  async getCdekCity(cityCode: number) {
    try {
      return await this.providerResponseCache.getOrSet(
        `cdek:city:${cityCode}`,
        cdekCityDetailsCacheTtlMs,
        () => this.cdekDeliveryProvider.getCity(cityCode),
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          "Город не найден. Выберите другой населённый пункт.",
        );
      }
      throw new BadGatewayException(
        "Не удалось загрузить координаты города. Попробуйте ещё раз.",
      );
    }
  }

  async getCdekPickupPoints(cityCode: number) {
    try {
      return await this.providerResponseCache.getOrSet(
        `cdek:pickup-points:${cityCode}`,
        cdekPickupPointsCacheTtlMs,
        () => this.cdekDeliveryProvider.getPickupPoints(cityCode),
      );
    } catch {
      return [];
    }
  }

  async getOzonPickupPoints(cityCode: number) {
    const city = await this.getCdekCity(cityCode);
    const points = await this.ozonCityPickupPointsService.getPickupPoints(city);
    return points.map((point) => ({
      ...point,
      deliveryPrice: ozonDeliveryPriceRub,
      minimumDeliveryPrice: ozonDeliveryPriceRub,
    }));
  }

  calculatePickupPointDelivery(
    selection: DeliverySelection,
    items: DeliveryCartItem[],
  ): Promise<DeliveryQuote> {
    switch (selection.provider) {
      case "cdek":
        return this.cdekDeliveryProvider.calculatePickupPointDelivery({
          items,
          selection,
        });
      case "ozon":
        return this.calculateManualOzonDelivery(selection);
    }
  }

  createCdekOrder(order: DeliveryShipmentOrder) {
    return this.cdekDeliveryProvider.createOrder(order);
  }

  getCdekOrder(uuid: string) {
    return this.cdekDeliveryProvider.getOrder(uuid);
  }

  getCdekOrderByNumber(cdekNumber: string) {
    return this.cdekDeliveryProvider.getOrderByCdekNumber(cdekNumber);
  }

  deleteCdekOrder(uuid: string) {
    return this.cdekDeliveryProvider.deleteOrder(uuid);
  }

  private async calculateManualOzonDelivery(
    selection: DeliverySelection,
  ): Promise<DeliveryQuote> {
    const pickupPointId = selection.pickupPointId;

    if (!pickupPointId?.trim()) {
      throw new BadRequestException("delivery.pickupPointId is required");
    }

    const pickupPoint =
      await this.ozonLogisticsService.getPickupPoint(pickupPointId);

    return {
      deliveryPrice: ozonDeliveryPriceRub,
      pickupPoint: {
        ...pickupPoint,
        deliveryPrice: ozonDeliveryPriceRub,
      },
      provider: "ozon",
    };
  }
}
