import { coloringQuery, type Coloring } from "@/entities/coloring";
import { productsQuery, type ProductsDataResult } from "@/entities/products";
import { getPublicColoring } from "@/shared/actions/colorings";
import { getProductsData } from "@/shared/actions/products";
import { ApiResult } from "@/shared/lib/api-result";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  coloring?: Coloring | null;
  productsData?: ProductsDataResult;
};

export class ColoringDataBuilder<
  TData = object,
  TFields extends Fields = Fields,
> extends BaseDataBuilder<TData, TFields> {
  add<K extends keyof TFields, V extends TFields[K]>(
    key: K,
    fn: TaskFn<TData & Partial<TFields>, V>,
  ) {
    return super.add(key, fn) as unknown as ColoringDataBuilder<TData & Record<K, V>, TFields>;
  }

  withColoring(collectionSlug: string, number: number) {
    const queryClient = this.queryClient;

    return this.add("coloring", async function () {
      const coloring = getColoringFromResult(
        ApiResult.fromDTO(await getPublicColoring(collectionSlug, number)),
      );

      if (!coloring) {
        return null;
      }

      if (coloring.collection.slug !== collectionSlug || coloring.number !== number) {
        throw new Error("Colorings API returned a mismatched route identity");
      }

      queryClient.setQueryData(
        coloringQuery.getDetail(collectionSlug, number, coloring.publishedRevisionId).queryKey,
        coloring,
      );

      return coloring;
    });
  }

  withProducts() {
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("productsData", async function () {
      return setApiResultQueryData(productsQuery.getData().queryKey, await getProductsData());
    });
  }
}

function getColoringFromResult(result: ApiResult<Coloring>) {
  if (result.isError) {
    if (result.error?.status === 404) {
      return null;
    }

    throw result.error ?? new Error("Unknown colorings API error");
  }

  if (!result.data) {
    throw new Error("Colorings API returned no data");
  }

  return result.data;
}
