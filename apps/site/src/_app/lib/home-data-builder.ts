import { productsQuery, type ProductsDataResult } from "@/entities/products";
import { getProductsData } from "@/shared/actions/products";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  productsData?: ProductsDataResult;
};

export class HomeDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(key: K, fn: TaskFn<TData & Partial<TFields>, V>) {
    return super.add(key, fn) as unknown as HomeDataBuilder<TData & Record<K, V>, TFields>;
  }

  withProducts() {
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("productsData", async function () {
      return setApiResultQueryData(
        productsQuery.getData().queryKey,
        await getProductsData(),
      );
    });
  }
}
