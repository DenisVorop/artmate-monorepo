"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getOzonDeliveryMap,
  getOzonDeliveryPoints,
  type OzonDeliveryMapClusterDTO,
  type OzonDeliveryMapRequestDTO,
} from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";

export function useOzonPickupPoints(request: OzonDeliveryMapRequestDTO | undefined) {
  const mapResult = useQuery({
    enabled: Boolean(request),
    queryFn: async () => {
      if (!request) {
        return undefined;
      }

      return ApiResult.fromDTO(await getOzonDeliveryMap(request)).unwrap();
    },
    queryKey: ["delivery", "ozon", "map", request] as const,
    staleTime: 60_000,
  });
  const { aggregateClusters, mapPointIds } = useMemo(
    () => partitionOzonMapClusters(mapResult.data?.clusters ?? []),
    [mapResult.data?.clusters],
  );
  const pointsResult = useQuery({
    enabled: mapPointIds.length > 0,
    queryFn: async () => ApiResult.fromDTO(await getOzonDeliveryPoints(mapPointIds)).unwrap() ?? [],
    queryKey: ["delivery", "ozon", "points", mapPointIds] as const,
    staleTime: 5 * 60_000,
  });

  return {
    aggregateClusters,
    isError: mapResult.isError || pointsResult.isError,
    isPending:
      Boolean(request) &&
      (mapResult.isPending || (mapPointIds.length > 0 && pointsResult.isPending)),
    pickupPoints: pointsResult.data ?? [],
  };
}

function partitionOzonMapClusters(clusters: readonly OzonDeliveryMapClusterDTO[]) {
  const aggregateClusters: OzonDeliveryMapClusterDTO[] = [];
  const terminalPointIds = new Set<string>();

  for (const cluster of clusters) {
    if (!cluster.isSameBuilding && cluster.viewport) {
      aggregateClusters.push(cluster);
    } else {
      cluster.mapPointIds.forEach((id) => terminalPointIds.add(id));
    }
  }

  return {
    aggregateClusters,
    mapPointIds: [...terminalPointIds].sort(),
  };
}
