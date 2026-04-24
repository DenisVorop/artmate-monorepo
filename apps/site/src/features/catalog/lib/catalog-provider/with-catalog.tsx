"use client";

import type { ComponentType } from "react";
import type { Product, ProductCategory } from "@/entities/products";
import { CatalogProvider } from "./catalog-provider";

type WithCatalogProps = {
  categories: ProductCategory[];
  products: Product[];
  initialCategoryId?: string;
  onAddToCart?: (_product: Product, _quantity?: number) => Promise<void> | void;
};

export function withCatalog(Component: ComponentType) {
  function CatalogWithProvider({
    categories,
    products,
    initialCategoryId,
    onAddToCart,
  }: WithCatalogProps) {
    return (
      <CatalogProvider
        categories={categories}
        products={products}
        initialCategoryId={initialCategoryId}
        onAddToCart={onAddToCart}
      >
        <Component />
      </CatalogProvider>
    );
  }

  return CatalogWithProvider;
}
