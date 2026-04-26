export type OzonCoordinateDTO = {
  lat: number;
  long: number;
};

export type OzonDeliveryViewportDTO = {
  left_bottom: OzonCoordinateDTO;
  right_top: OzonCoordinateDTO;
};

export type OzonDeliveryMapRequestDTO = {
  viewport: OzonDeliveryViewportDTO;
  zoom: number;
};

export type OzonDeliveryMapClusterDTO = {
  cluster_id: string;
  coordinate: OzonCoordinateDTO;
  count: number;
  map_point_ids: number[];
};

export type OzonDeliveryMapPointDTO = {
  map_point_id: number;
  coordinate: OzonCoordinateDTO;
  type: "PVZ" | "POSTAMAT";
  status: "available" | "temporarily_unavailable";
  available: boolean;
};

export type OzonDeliveryMapResponseDTO = {
  clusters: OzonDeliveryMapClusterDTO[];
  points: OzonDeliveryMapPointDTO[];
};

export type OzonDeliveryPointInfoRequestDTO = {
  map_point_ids: number[];
};

export type OzonDeliveryPointRestrictionsDTO = {
  max_weight_g: number;
  max_dimensions_cm: {
    width: number;
    height: number;
    depth: number;
  };
  notes: string[];
  unavailable_reason?: string;
};

export type OzonDeliveryPointInfoDTO = {
  map_point_id: number;
  external_id: string;
  name: string;
  type: "PVZ" | "POSTAMAT";
  address: string;
  city: string;
  coordinate: OzonCoordinateDTO;
  status: "available" | "temporarily_unavailable";
  available: boolean;
  work_hours: string;
  delivery_price: number;
  delivery_term_days: number;
  restrictions: OzonDeliveryPointRestrictionsDTO;
  available_delivery_methods: string[];
  payment_methods: string[];
  how_to_get: string;
};

export type OzonDeliveryPointInfoResponseDTO = {
  points: OzonDeliveryPointInfoDTO[];
};
