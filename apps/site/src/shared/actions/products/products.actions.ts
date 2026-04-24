'use server';

import { productsData } from "@/entities/products/model";
import type { ProductsData } from "@/entities/products/model";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

export async function getProductsData(): Promise<ApiResultDTO<ProductsData>> {
  const result = await ApiResult.prepareApi(async () => productsData, {
    isEmptyCb: (data) => data.products.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<ProductsData>;
}
