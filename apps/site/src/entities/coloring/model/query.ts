import { queryOptions } from "@tanstack/react-query";

import { getPublicColoring } from "@/shared/actions/colorings";
import { ApiResult } from "@/shared/lib/api-result";

const baseKey = "coloring";

export const coloringQuery = {
  getDetail: (collectionSlug: string, number: number, publishedRevisionId: string) =>
    queryOptions({
      queryKey: [baseKey, "detail", collectionSlug, number, publishedRevisionId] as const,
      queryFn: async () => {
        const coloring = ApiResult.fromDTO(
          await getPublicColoring(collectionSlug, number),
        ).unwrap();

        if (
          coloring &&
          (coloring.collection.slug !== collectionSlug || coloring.number !== number)
        ) {
          throw new Error(
            `Coloring route mismatch: expected "${collectionSlug}/${number}", received "${coloring.collection.slug}/${coloring.number}"`,
          );
        }

        if (coloring?.publishedRevisionId !== publishedRevisionId) {
          throw new Error(
            `Coloring revision mismatch for "${collectionSlug}/${number}": expected "${publishedRevisionId}", received "${coloring?.publishedRevisionId ?? "missing"}"`,
          );
        }

        return coloring;
      },
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
