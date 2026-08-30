import { queryOptions } from "@tanstack/react-query";

import {
  getPublicColoringCollection,
  getPublicColoringCollections,
} from "@/shared/actions/coloring-collections";
import { ApiResult } from "@/shared/lib/api-result";

const baseKey = "coloring-collections";

export const coloringCollectionsQuery = {
  baseKey: [baseKey] as const,
  getList: () =>
    queryOptions({
      queryKey: [baseKey, "list"] as const,
      queryFn: async () => ApiResult.fromDTO(await getPublicColoringCollections()).unwrap() ?? [],
      staleTime: Infinity,
      retryOnMount: false,
    }),
  getDetail: (slug: string) =>
    queryOptions({
      queryKey: [baseKey, "detail", slug] as const,
      queryFn: async () =>
        ApiResult.fromDTO(await getPublicColoringCollection(slug)).unwrap() ?? null,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
