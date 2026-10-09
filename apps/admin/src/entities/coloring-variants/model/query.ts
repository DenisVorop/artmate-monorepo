import { queryOptions } from "@tanstack/react-query";

import { getColoringVariants } from "@/shared/actions/coloring-variants";

export const coloringVariantsQueryKeys = {
  detail: (coloringId: string) =>
    ["admin-coloring-variants", coloringId] as const,
};

export const coloringVariantsQuery = {
  detail: (coloringId: string) =>
    queryOptions({
      queryKey: coloringVariantsQueryKeys.detail(coloringId),
      queryFn: () => getColoringVariants(coloringId),
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
