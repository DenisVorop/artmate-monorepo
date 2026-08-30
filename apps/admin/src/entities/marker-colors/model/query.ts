import { queryOptions } from "@tanstack/react-query";

import { getAdminMarkerColors } from "@/shared/actions/colorings";

export const markerColorsQueryKeys = {
  all: ["admin-marker-colors"] as const,
  catalog: () => [...markerColorsQueryKeys.all, "catalog"] as const,
};

export const markerColorsQuery = {
  catalog: () =>
    queryOptions({
      queryKey: markerColorsQueryKeys.catalog(),
      queryFn: getAdminMarkerColors,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
