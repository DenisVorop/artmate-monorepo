export type DeliveryCityDTO = {
  code: number;
  countryCode: string;
  name: string;
};

export type OzonDeliveryCityDTO = {
  countryCode: string;
  id: string;
  name: string;
  region: string;
};

export type DeliveryPickupPointDTO = {
  id: string;
  title: string;
  address: string;
  workHours: string;
  deliveryPrice: number;
  minimumDeliveryPrice?: number;
  cityCode?: number;
  latitude?: number;
  longitude?: number;
};
