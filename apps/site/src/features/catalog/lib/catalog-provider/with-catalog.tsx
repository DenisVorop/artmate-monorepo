"use client";

import type { ComponentType, ReactNode } from "react";
import type { Product, ProductCategory } from "@/entities/products";
import { CatalogProvider } from "./catalog-provider";
import type { CatalogProductPlacement } from "./catalog.context";
import type { CatalogCategoryValue } from "../catalog-state";

type WithCatalogProps = {
  categories: ProductCategory[];
  products: Product[];
  initialCategoryId?: string;
  section?: CatalogCategoryValue;
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
    section,
    renderProductCard,
  }: WithCatalogProps) {
    return (
      <CatalogProvider
        categories={categories}
        products={products}
        initialCategoryId={initialCategoryId}
        section={section}
        renderProductCard={renderProductCard}
      >
        <Component />
      </CatalogProvider>
    );
  }

  return CatalogWithProvider;
}
