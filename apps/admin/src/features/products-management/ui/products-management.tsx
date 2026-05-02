"use client";

import type { Product, ProductCategory } from "@/entities/products";

import { useProductsManagement } from "../model";
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
  const { categories, products, refreshProductsView } = useProductsManagement({
    categories: initialCategories,
    products: initialProducts,
  });

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
