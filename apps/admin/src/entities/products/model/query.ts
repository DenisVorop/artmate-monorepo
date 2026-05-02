import { queryOptions } from "@tanstack/react-query";

import {
  getAdminProduct,
  getAdminProducts,
  getProductCategories,
} from "@/shared/actions/products";

const adminProductsStaleTimeMs = 1000 * 60 * 5;

export const productsQueryKeys = {
  all: ["admin-products"] as const,
  categories: () => [...productsQueryKeys.all, "categories"] as const,
  detail: (productId: string) =>
    [...productsQueryKeys.all, "detail", productId] as const,
  list: () => [...productsQueryKeys.all, "list"] as const,
};

export const productsQuery = {
  categories: () =>
    queryOptions({
      queryKey: productsQueryKeys.categories(),
      queryFn: getProductCategories,
      staleTime: adminProductsStaleTimeMs,
      retryOnMount: false,
    }),
  detail: (productId: string) =>
    queryOptions({
      queryKey: productsQueryKeys.detail(productId),
      queryFn: () => getAdminProduct(productId),
      staleTime: adminProductsStaleTimeMs,
      retryOnMount: false,
    }),
  list: () =>
    queryOptions({
      queryKey: productsQueryKeys.list(),
      queryFn: getAdminProducts,
      staleTime: adminProductsStaleTimeMs,
      retryOnMount: false,
    }),
};
