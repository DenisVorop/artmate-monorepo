import {
  catalogLandingsQuery,
  type CatalogLandingPagesResult,
} from "@/entities/catalog-landings";
import { getProductCategoryBySlug, getProductBySlug, getRelatedProducts } from "@/entities/products";
import type { Product, ProductCategory } from "@/entities/products";
import { productsQuery, type ProductsDataResult } from "@/entities/products";
import { reviewsQuery, type ReviewsDataResult } from "@/entities/reviews";
import { getCatalogLandingPages } from "@/shared/actions/catalog-landings";
import { getProductsData } from "@/shared/actions/products";
import { getReviewsData } from "@/shared/actions/reviews";

import type { TaskFn } from "../types/data-builder";

import { BaseDataBuilder } from "./base-data-builder";

type Fields = {
  productsData?: ProductsDataResult;
  catalogLandings?: CatalogLandingPagesResult;
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
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("productsData", async function () {
      return setApiResultQueryData(
        productsQuery.getData().queryKey,
        await getProductsData(),
      );
    });
  }

  withCatalogLandings() {
    const setApiResultQueryData = this.setApiResultQueryData.bind(this);

    return this.add("catalogLandings", async function () {
      return setApiResultQueryData(
        catalogLandingsQuery.getList().queryKey,
        await getCatalogLandingPages(),
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

  withCategory(categorySlug: string) {
    return this.add("category", async function () {
      const data = await this.$.productsData;

      if (!data || data.products.length === 0) {
        return undefined;
      }

      return getProductCategoryBySlug(data.categories, categorySlug);
    });
  }

  withProduct(productSlug: string) {
    return this.add("product", async function () {
      const data = await this.$.productsData;

      if (!data || data.products.length === 0) {
        return undefined;
      }

      return getProductBySlug(data.products, productSlug);
    });
  }

  withRelatedProducts(limit = 4) {
    return this.add("relatedProducts", async function () {
      const data = await this.$.productsData;
      const product = await this.$.product;

      if (!data || data.products.length === 0 || !product) {
        return [];
      }

      return getRelatedProducts(data.products, product, limit);
    });
  }
}
