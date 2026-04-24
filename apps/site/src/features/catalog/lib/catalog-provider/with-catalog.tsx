"use client";

import type { ComponentType } from "react";
import type { Product, ProductCategory } from "@/entities/products";
import { CatalogProvider } from "./catalog-provider";

type WithCatalogProps = {
  categories: ProductCategory[];
  products: Product[];
  initialCategoryId?: string;
};

export function withCatalog(Component: ComponentType) {
  function CatalogWithProvider({ categories, products, initialCategoryId }: WithCatalogProps) {
    return (
      <CatalogProvider categories={categories} products={products} initialCategoryId={initialCategoryId}>
        <Component />
      </CatalogProvider>
    );
  }

  return CatalogWithProvider;
}
