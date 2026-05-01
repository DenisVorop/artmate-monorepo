"use client";

import { useCallback } from "react";

import {
  useCategories,
  useProducts,
  type Product,
  type ProductCategory,
} from "@/entities/products";

import { CreateProductCard } from "./create-product-card";
import { ProductCategoriesCard } from "./product-categories-card";
import { ProductsList } from "./products-list";

type ProductsManagementProps = {
  readonly categories: readonly ProductCategory[];
  readonly products: readonly Product[];
};

export function ProductsManagement({
  categories: initialCategories,
  products: initialProducts,
}: ProductsManagementProps) {
  const { products, refetch: refetchProducts } = useProducts({
    initialData: initialProducts,
  });
  const { categories, refetch: refetchCategories } = useCategories({
    initialData: initialCategories,
  });
  const refreshProductsView = useCallback(async () => {
    await Promise.all([refetchProducts(), refetchCategories()]);
  }, [refetchCategories, refetchProducts]);

  return (
    <div className="grid gap-4">
      <ProductCategoriesCard
        categories={categories}
        onProductsChange={refreshProductsView}
        products={products}
      />
      <CreateProductCard
        categories={categories}
        onProductsChange={refreshProductsView}
      />
      <ProductsList products={products} />
    </div>
  );
}
