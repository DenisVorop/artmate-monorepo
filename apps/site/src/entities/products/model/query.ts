import { queryOptions } from "@tanstack/react-query";

import { getProductsData } from "@/shared/actions/products";
import type { ApiResultDTO } from "@/shared/lib/api-result";

import { emptyProductsData, type ProductsData } from "@/entities/products/model";

export type ProductsDataResult = ApiResultDTO<ProductsData>;

const baseKey = "products";

const initialData: ProductsDataResult = {
  status: "empty",
  data: emptyProductsData,
  isSuccess: false,
  isEmpty: true,
  isError: false,
};

export const productsQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: () => getProductsData(),
      initialData,
      staleTime: Infinity,
    }),
};
