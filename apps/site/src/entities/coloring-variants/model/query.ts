import { queryOptions } from "@tanstack/react-query";

import { getPublicColoringVariants } from "@/shared/actions/coloring-variants";
import { ApiResult } from "@/shared/lib/api-result";

const baseKey = "coloring-variants";

export const coloringVariantsQuery = {
  getDetail: (collectionSlug: string, number: number, token: string) =>
    queryOptions({
      queryKey: [baseKey, "detail", collectionSlug, number, token] as const,
      queryFn: async () => {
        const coloring = ApiResult.fromDTO(
          await getPublicColoringVariants(collectionSlug, number),
        ).unwrap();

        if (
          coloring &&
          (coloring.collection.slug !== collectionSlug || coloring.number !== number)
        ) {
          throw new Error(
            `Coloring route mismatch: expected "${collectionSlug}/${number}", received "${coloring.collection.slug}/${coloring.number}"`,
          );
        }

        if (coloring?.token !== token) {
          throw new Error(
            `Coloring publication mismatch for "${collectionSlug}/${number}": expected "${token}", received "${coloring?.token ?? "missing"}"`,
          );
        }

        return coloring;
      },
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
