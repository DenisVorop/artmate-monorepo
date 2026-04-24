import { homeQuery, type HomeDataResult } from "@/entities/home";
import { productsQuery, type ProductsDataResult } from "@/entities/products";
import { reviewsQuery, type ReviewsDataResult } from "@/entities/reviews";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  homeData?: HomeDataResult;
  productsData?: ProductsDataResult;
  reviewsData?: ReviewsDataResult;
};

export class HomeDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(key: K, fn: TaskFn<TData & Partial<TFields>, V>) {
    return super.add(key, fn) as unknown as HomeDataBuilder<TData & Record<K, V>, TFields>;
  }

  withHomeData() {
    const { queryClient } = this;

    return this.add("homeData", async function () {
      await queryClient.prefetchQuery(homeQuery.getData());

      return queryClient.getQueryData<HomeDataResult>(homeQuery.getData().queryKey);
    });
  }

  withProducts() {
    const { queryClient } = this;

    return this.add("productsData", async function () {
      await queryClient.prefetchQuery(productsQuery.getData());

      return queryClient.getQueryData<ProductsDataResult>(productsQuery.getData().queryKey);
    });
  }

  withReviews() {
    const { queryClient } = this;

    return this.add("reviewsData", async function () {
      await queryClient.prefetchQuery(reviewsQuery.getData());

      return queryClient.getQueryData<ReviewsDataResult>(reviewsQuery.getData().queryKey);
    });
  }
}
