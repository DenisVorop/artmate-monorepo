import type {
  OzonDeliveryMapRequestDTO,
  OzonDeliveryMapResponseDTO,
  OzonDeliveryPointInfoDTO,
} from "@/shared/actions/ozon";

export type CheckoutDeliveryCityId = "moscow" | "spb";

export type CheckoutDeliveryCity = {
  id: CheckoutDeliveryCityId;
  label: string;
  shortLabel: string;
  request: OzonDeliveryMapRequestDTO;
};

export const checkoutDeliveryCities = [
  {
    id: "moscow",
    label: "Москва",
    shortLabel: "Мск",
    request: {
      viewport: {
        left_bottom: {
          lat: 55.55,
          long: 37.35,
        },
        right_top: {
          lat: 55.95,
          long: 37.85,
        },
      },
      zoom: 12,
    },
  },
  {
    id: "spb",
    label: "Санкт-Петербург",
    shortLabel: "СПб",
    request: {
      viewport: {
        left_bottom: {
          lat: 59.84,
          long: 30.18,
        },
        right_top: {
          lat: 60.02,
          long: 30.47,
        },
      },
      zoom: 12,
    },
  },
] satisfies [CheckoutDeliveryCity, ...CheckoutDeliveryCity[]];

export function getCheckoutDeliveryCity(cityId: CheckoutDeliveryCityId) {
  return (
    checkoutDeliveryCities.find((city) => city.id === cityId) ??
    checkoutDeliveryCities[0]
  );
}

export function getMapPointIds(map: OzonDeliveryMapResponseDTO | undefined) {
  if (!map) {
    return [];
  }

  const ids = new Set<number>();

  for (const cluster of map.clusters) {
    for (const mapPointId of cluster.map_point_ids) {
      ids.add(mapPointId);
    }
  }

  for (const point of map.points) {
    ids.add(point.map_point_id);
  }

  return Array.from(ids);
}

export function getSelectedDeliveryPoint(
  points: OzonDeliveryPointInfoDTO[],
  pickupPointId: string,
) {
  return points.find((point) => String(point.map_point_id) === pickupPointId);
}

export function getDeliveryPointKindLabel(point: OzonDeliveryPointInfoDTO) {
  return point.type === "POSTAMAT" ? "Постамат" : "ПВЗ";
}

export function getDeliveryPointStatusLabel(point: OzonDeliveryPointInfoDTO) {
  return point.available ? "Доступен" : "Недоступен";
}
