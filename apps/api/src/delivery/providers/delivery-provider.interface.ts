export type DeliveryProviderCode = "cdek" | "ozon";

export type DeliveryCartItem = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type DeliverySelection = {
  provider: DeliveryProviderCode;
  cityCode?: number;
  pickupPointAddress?: string;
  pickupPointId?: string;
};

export type DeliveryPickupPoint = {
  id: string;
  title: string;
  address: string;
  workHours: string;
  deliveryPrice: number;
  cityCode?: number;
  latitude?: number;
  longitude?: number;
};

export type DeliveryQuote = {
  provider: DeliveryProviderCode;
  pickupPoint: DeliveryPickupPoint;
  deliveryPrice: number;
};

export interface DeliveryProviderAdapter {
  readonly provider: DeliveryProviderCode;
  calculatePickupPointDelivery(input: {
    items: DeliveryCartItem[];
    selection: DeliverySelection;
  }): Promise<DeliveryQuote>;
}
