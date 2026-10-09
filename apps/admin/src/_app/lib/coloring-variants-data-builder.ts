import type { QueryClient } from "@tanstack/react-query";

import { coloringVariantsQuery } from "@/entities/coloring-variants";
import { materialSetsQuery } from "@/entities/material-sets";

export async function buildColoringVariantsData(
  queryClient: QueryClient,
  coloringId: string,
) {
  await Promise.all([
    queryClient.prefetchQuery(coloringVariantsQuery.detail(coloringId)),
    queryClient.prefetchQuery(materialSetsQuery.list()),
  ]);
}
