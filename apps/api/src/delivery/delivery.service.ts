import { BadRequestException, Injectable } from "@nestjs/common";

import { OzonLogisticsService } from "../ozon/ozon-logistics.service";

import {
  cdekCitySearchCacheTtlMs,
  cdekPickupPointsCacheTtlMs,
  ozonDeliveryMapCacheTtlMs,
  ozonDeliveryPointInfoCacheTtlMs,
  ozonDeliveryPriceRub,
} from "./delivery.constants";
import type {
  StorefrontOzonDeliveryMapRequestDTO,
  StorefrontOzonDeliveryMapResponseDTO,
} from "./dto";
import { CdekDeliveryProvider } from "./providers/cdek/cdek-delivery.provider";
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
      return [];
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

  async getOzonDeliveryMap(
    request: StorefrontOzonDeliveryMapRequestDTO,
  ): Promise<StorefrontOzonDeliveryMapResponseDTO> {
    try {
      const clusters = await this.providerResponseCache.getOrSet(
        `ozon:map:${JSON.stringify(request)}`,
        ozonDeliveryMapCacheTtlMs,
        () =>
          this.ozonLogisticsService.getMapClusters({
            viewport: {
              left_bottom: request.viewport.leftBottom,
              right_top: request.viewport.rightTop,
            },
            zoom: request.zoom,
          }),
      );

      return { clusters };
    } catch {
      return { clusters: [] };
    }
  }

  async getOzonDeliveryPoints(mapPointIds: readonly string[]) {
    try {
      const points = await this.providerResponseCache.getOrSet(
        `ozon:point-info:${JSON.stringify(mapPointIds)}`,
        ozonDeliveryPointInfoCacheTtlMs,
        () => this.ozonLogisticsService.getPickupPointsByIds(mapPointIds),
      );

      return points.map((point) => ({
        ...point,
        deliveryPrice: ozonDeliveryPriceRub,
        minimumDeliveryPrice: ozonDeliveryPriceRub,
      }));
    } catch {
      return [];
    }
  }

  searchOzonPickupPoints() {
    // Text search stays neutral until Ozon publishes a confirmed point-list contract.
    return [];
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
