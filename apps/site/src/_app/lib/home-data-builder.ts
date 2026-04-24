import { homeQuery, type HomeDataResult } from "@/entities/home";
import { productsQuery, type ProductsDataResult } from "@/entities/products";
import { reviewsQuery, type ReviewsDataResult } from "@/entities/reviews";
import { getHomeData } from "@/shared/actions/home";
import { getProductsData } from "@/shared/actions/products";
import { getReviewsData } from "@/shared/actions/reviews";

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
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("homeData", async function () {
      return setApiResultQueryData(homeQuery.getData().queryKey, await getHomeData());
    });
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

  withReviews() {
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("reviewsData", async function () {
      return setApiResultQueryData(
        reviewsQuery.getData().queryKey,
        await getReviewsData(),
      );
    });
  }
}
