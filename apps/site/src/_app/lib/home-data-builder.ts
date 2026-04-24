import { homeQuery } from "@/entities/home/model/query";
import { productsQuery } from "@/entities/products/model/query";
import { reviewsQuery } from "@/entities/reviews/model/query";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  prefetchHomeData: void;
  prefetchProductsData: void;
  prefetchReviewsData: void;
};

export class HomeDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(key: K, fn: TaskFn<TData & Partial<TFields>, V>) {
    return super.add(key, fn) as unknown as HomeDataBuilder<TData & Record<K, V>, TFields>;
  }

  prefetchHomeData() {
    const { queryClient } = this;

    return this.add("prefetchHomeData", async function () {
      return queryClient.prefetchQuery(homeQuery.getData());
    });
  }

  prefetchProductsData() {
    const { queryClient } = this;

    return this.add("prefetchProductsData", async function () {
      return queryClient.prefetchQuery(productsQuery.getData());
    });
  }

  prefetchReviewsData() {
    const { queryClient } = this;

    return this.add("prefetchReviewsData", async function () {
      return queryClient.prefetchQuery(reviewsQuery.getData());
    });
  }
}
