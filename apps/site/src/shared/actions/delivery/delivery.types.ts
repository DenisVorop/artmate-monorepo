export type DeliveryCityDTO = {
  code: number;
  countryCode: string;
  name: string;
};

export type DeliveryPickupPointDTO = {
  id: string;
  title: string;
  address: string;
  workHours: string;
  deliveryPrice: number;
  cityCode?: number;
  latitude?: number;
  longitude?: number;
};
