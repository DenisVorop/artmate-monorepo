"use client";

import type { ComponentType, ReactNode } from "react";
import type { Product, ProductCategory } from "@/entities/products";
import { CatalogProvider } from "./catalog-provider";
import type { CatalogProductPlacement } from "./catalog.context";

type WithCatalogProps = {
  categories: ProductCategory[];
  products: Product[];
  initialCategoryId?: string;
  renderProductCard?: (
    _product: Product,
    _index: number,
    _placement: CatalogProductPlacement,
  ) => ReactNode;
};

export function withCatalog(Component: ComponentType) {
  function CatalogWithProvider({
    categories,
    products,
    initialCategoryId,
    renderProductCard,
  }: WithCatalogProps) {
    return (
      <CatalogProvider
        categories={categories}
        products={products}
        initialCategoryId={initialCategoryId}
        renderProductCard={renderProductCard}
      >
        <Component />
      </CatalogProvider>
    );
  }

  return CatalogWithProvider;
}
