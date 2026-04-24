import { queryOptions } from "@tanstack/react-query";

import { getProductsData } from "@/shared/actions/products";
import type { ApiResultDTO } from "@/shared/lib/api-result";

import type { ProductsData } from "@/entities/products/model";

export type ProductsDataResult = ApiResultDTO<ProductsData>;

const baseKey = "products";

export const productsQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: () => getProductsData(),
      staleTime: Infinity,
    }),
};
