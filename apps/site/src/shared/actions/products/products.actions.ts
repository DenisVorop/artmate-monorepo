'use server';

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import { productsData, type ProductsData } from "./products.data";

export async function getProductsData(): Promise<ApiResultDTO<ProductsData>> {
  const result = await ApiResult.prepareApi(async () => productsData, {
    isEmptyCb: (data) => data.products.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<ProductsData>;
}
