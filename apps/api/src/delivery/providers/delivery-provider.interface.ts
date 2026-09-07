export type DeliveryProviderCode = "cdek" | "ozon";

export type DeliveryCartItem = {
  id: string;
  slug?: string;
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

export type DeliveryDateRange = {
  min: string;
  max: string;
};

export type DeliveryQuote = {
  provider: DeliveryProviderCode;
  pickupPoint: DeliveryPickupPoint;
  deliveryPrice: number;
  estimatedDeliveryDateRange?: DeliveryDateRange;
};

export type DeliveryShipmentCustomer = {
  name: string;
  phone: string;
  email: string;
};

export type DeliveryShipmentOrder = {
  id: string;
  customer: DeliveryShipmentCustomer;
  delivery: {
    provider: DeliveryProviderCode;
    pickupPoint: DeliveryPickupPoint;
  };
  items: DeliveryCartItem[];
  comment?: string;
};

export type DeliveryShipmentMutationResult = {
  externalNumber?: string;
  externalUuid?: string;
  requestPayload?: Record<string, unknown>;
  requestState?: string;
  requestUuid?: string;
  responsePayload: unknown;
  statusCode?: string;
  statusName?: string;
};

export type DeliveryShipmentCreateResult = DeliveryShipmentMutationResult;

export type DeliveryShipmentDeleteResult = DeliveryShipmentMutationResult;

export interface DeliveryProviderAdapter {
  readonly provider: DeliveryProviderCode;
  calculatePickupPointDelivery(input: {
    items: DeliveryCartItem[];
    selection: DeliverySelection;
  }): Promise<DeliveryQuote>;
}

/** No request/response shape is defined until Ozon point-list is confirmed. */
export interface OzonPointListAdapter {
  readonly enabled: boolean;
}
