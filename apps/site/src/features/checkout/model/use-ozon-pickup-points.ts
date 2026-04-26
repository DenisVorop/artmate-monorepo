"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getOzonDeliveryMap,
  getOzonDeliveryPointInfo,
  type OzonDeliveryMapResponseDTO,
  type OzonDeliveryPointInfoDTO,
} from "@/shared/actions/ozon";
import { ApiResult } from "@/shared/lib/api-result";

import {
  getCheckoutDeliveryCity,
  getMapPointIds,
  type CheckoutDeliveryCityId,
} from "../lib";

export type CheckoutPickupPointsResult = {
  map: OzonDeliveryMapResponseDTO;
  points: OzonDeliveryPointInfoDTO[];
};

export function useOzonPickupPoints(cityId: CheckoutDeliveryCityId) {
  const city = getCheckoutDeliveryCity(cityId);
  const { data, error, isError, isFetching, isPending, refetch } = useQuery({
    queryKey: ["checkout", "ozon-pickup-points", city.id],
    queryFn: async (): Promise<CheckoutPickupPointsResult> => {
      const map =
        ApiResult.fromDTO(await getOzonDeliveryMap(city.request)).unwrap() ?? {
          clusters: [],
          points: [],
        };
      const mapPointIds = getMapPointIds(map);

      if (mapPointIds.length === 0) {
        return {
          map,
          points: [],
        };
      }

      const pointInfo =
        ApiResult.fromDTO(
          await getOzonDeliveryPointInfo({ map_point_ids: mapPointIds }),
        ).unwrap() ?? { points: [] };

      return {
        map,
        points: pointInfo.points,
      };
    },
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  return {
    data,
    error,
    isError,
    isFetching,
    isPending,
    refetch,
  };
}
