import { getProductCategoryBySlug, getProductBySlug, getRelatedProducts } from "@/entities/products";
import type { Product, ProductCategory } from "@/entities/products";
import { productsQuery, type ProductsDataResult } from "@/entities/products";
import { reviewsQuery, type ReviewsDataResult } from "@/entities/reviews";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  productsData?: ProductsDataResult;
  reviewsData?: ReviewsDataResult;
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

  withCategory(categorySlug: string) {
    return this.add("category", async function () {
      const data = await this.$.productsData;

      if (!data || data.isEmpty) {
        return undefined;
      }

      return getProductCategoryBySlug(data.data!.categories, categorySlug);
    });
  }

  withProduct(productSlug: string) {
    return this.add("product", async function () {
      const data = await this.$.productsData;

      if (!data || data.isEmpty) {
        return undefined;
      }

      return getProductBySlug(data.data!.products, productSlug);
    });
  }

  withRelatedProducts(limit = 4) {
    return this.add("relatedProducts", async function () {
      const data = await this.$.productsData;
      const product = await this.$.product;

      if (!data || data.isEmpty || !product) {
        return [];
      }

      return getRelatedProducts(data.data!.products, product, limit);
    });
  }
}
