import { BadRequestException, Injectable } from "@nestjs/common";

import { OzonLogisticsService } from "../ozon/ozon-logistics.service";

import { ozonDeliveryPriceRub } from "./delivery.constants";
import type {
  StorefrontOzonDeliveryMapRequestDTO,
  StorefrontOzonDeliveryMapResponseDTO,
} from "./dto";
import { CdekDeliveryProvider } from "./providers/cdek/cdek-delivery.provider";
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
  ) {}

  searchCdekCities(query: string, countryCode?: string) {
    return this.cdekDeliveryProvider.searchCities(query, countryCode);
  }

  getCdekPickupPoints(cityCode: number) {
    return this.cdekDeliveryProvider.getPickupPoints(cityCode);
  }

  async getOzonDeliveryMap(
    request: StorefrontOzonDeliveryMapRequestDTO,
  ): Promise<StorefrontOzonDeliveryMapResponseDTO> {
    const clusters = await this.ozonLogisticsService.getMapClusters({
      viewport: {
        left_bottom: request.viewport.leftBottom,
        right_top: request.viewport.rightTop,
      },
      zoom: request.zoom,
    });

    return { clusters };
  }

  getOzonDeliveryPoints(mapPointIds: readonly string[]) {
    return this.ozonLogisticsService
      .getPickupPointsByIds(mapPointIds)
      .then((points) =>
        points.map((point) => ({
          ...point,
          deliveryPrice: ozonDeliveryPriceRub,
        })),
      );
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
