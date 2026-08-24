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

export type OzonMapCoordinateDTO = {
  lat: number;
  long: number;
};

export type OzonMapViewportDTO = {
  leftBottom: OzonMapCoordinateDTO;
  rightTop: OzonMapCoordinateDTO;
};

export type OzonDeliveryMapRequestDTO = {
  viewport: OzonMapViewportDTO;
  zoom: number;
};

export type OzonDeliveryMapClusterDTO = {
  coordinate: OzonMapCoordinateDTO;
  isSameBuilding: boolean;
  mapPointIds: string[];
  pointsCount: number;
  viewport?: OzonMapViewportDTO;
};

export type OzonDeliveryMapResponseDTO = {
  clusters: OzonDeliveryMapClusterDTO[];
};
