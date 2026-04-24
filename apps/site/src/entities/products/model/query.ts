import { queryOptions } from "@tanstack/react-query";

import { getProductsData } from "@/shared/actions/products";
import { ApiResult } from "@/shared/lib/api-result";

import type { ProductsData } from "./types";

export type ProductsDataResult = ProductsData | null;

const baseKey = "products";

export const productsQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async () => ApiResult.fromDTO(await getProductsData()).unwrap() ?? null,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
