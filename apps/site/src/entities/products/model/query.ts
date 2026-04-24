import { queryOptions } from "@tanstack/react-query";

import { getProductsData } from "@/shared/actions/products";
import { ensureApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type { ProductsData } from "./types";

export type ProductsDataResult = ApiResultDTO<ProductsData>;

const baseKey = "products";

export const productsQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async () => ensureApiResult(await getProductsData()),
      staleTime: Infinity,
    }),
};
