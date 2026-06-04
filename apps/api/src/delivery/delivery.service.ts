import { BadRequestException, Injectable } from "@nestjs/common";

import { CdekDeliveryProvider } from "./providers/cdek/cdek-delivery.provider";
import type {
  DeliveryCartItem,
  DeliveryQuote,
  DeliverySelection,
  DeliveryShipmentOrder,
} from "./providers/delivery-provider.interface";

@Injectable()
export class DeliveryService {
  constructor(private readonly cdekDeliveryProvider: CdekDeliveryProvider) {}

  searchCdekCities(query: string, countryCode?: string) {
    return this.cdekDeliveryProvider.searchCities(query, countryCode);
  }

  getCdekPickupPoints(cityCode: number) {
    return this.cdekDeliveryProvider.getPickupPoints(cityCode);
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
    if (!selection.pickupPointAddress?.trim()) {
      throw new BadRequestException("delivery.pickupPointAddress is required");
    }

    return {
      deliveryPrice: 0,
      pickupPoint: {
        address: selection.pickupPointAddress.trim(),
        deliveryPrice: 0,
        id: "manual-ozon-pickup",
        title: "Заявка из формы",
        workHours: "Уточняется",
      },
      provider: "ozon",
    };
  }
}
