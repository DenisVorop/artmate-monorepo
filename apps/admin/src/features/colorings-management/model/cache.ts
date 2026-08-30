import type { QueryClient } from "@tanstack/react-query";

import { coloringCollectionsQueryKeys } from "@/entities/coloring-collections";
import { coloringsQueryKeys } from "@/entities/colorings";
import { productsQueryKeys } from "@/entities/products";

export async function invalidateColoringManagement(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: coloringsQueryKeys.list() }),
    queryClient.invalidateQueries({ queryKey: coloringsQueryKeys.details() }),
    queryClient.invalidateQueries({ queryKey: coloringCollectionsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
  ]);
}
