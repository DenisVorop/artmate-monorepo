import { getProductCategoryBySlug, getProductBySlug, getRelatedProducts } from "@/entities/products";
import type { Product, ProductCategory } from "@/entities/products";
import { productsQuery, type ProductsDataResult } from "@/entities/products/model/query";
import { reviewsQuery } from "@/entities/reviews/model/query";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  prefetchProductsData: void;
  prefetchReviewsData: void;
  category?: ProductCategory;
  product?: Product;
  relatedProducts: Product[];
};

export class CatalogDataBuilder<TData, TFields extends Fields> extends BaseDataBuilder<
  TData,
  TFields
> {
  add<K extends keyof TFields, V extends TFields[K]>(key: K, fn: TaskFn<TData & Partial<TFields>, V>) {
    return super.add(key, fn) as unknown as CatalogDataBuilder<TData & Record<K, V>, TFields>;
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

  withCategory(categorySlug: string) {
    const { queryClient } = this;

    return this.add("category", async function () {
      const productsResult = queryClient.getQueryData<ProductsDataResult>(productsQuery.getData().queryKey);
      const productsData = productsResult?.data;

      return productsData
        ? getProductCategoryBySlug(productsData.categories, categorySlug)
        : undefined;
    });
  }

  withProduct(productSlug: string) {
    const { queryClient } = this;

    return this.add("product", async function () {
      const productsResult = queryClient.getQueryData<ProductsDataResult>(productsQuery.getData().queryKey);
      const productsData = productsResult?.data;

      return productsData ? getProductBySlug(productsData.products, productSlug) : undefined;
    });
  }

  withRelatedProducts(limit = 4) {
    const { queryClient } = this;

    return this.add("relatedProducts", async function () {
      const productsResult = queryClient.getQueryData<ProductsDataResult>(productsQuery.getData().queryKey);
      const productsData = productsResult?.data;
      const product = await this.$.product;

      return productsData && product ? getRelatedProducts(productsData.products, product, limit) : [];
    });
  }
}
