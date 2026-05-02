"use client";

import type { Product, ProductCategory } from "@/entities/products";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { useProductDetailsManagement } from "../model";
import { ProductEditorCard } from "./product-editor-card";

type ProductDetailsManagementProps = {
  readonly categories: readonly ProductCategory[];
  readonly product: Product;
};

export function ProductDetailsManagement({
  categories: initialCategories,
  product: initialProduct,
}: ProductDetailsManagementProps) {
  const {
    categories,
    handleProductDeleted,
    isError,
    product,
    refreshProductView,
  } = useProductDetailsManagement({
    categories: initialCategories,
    product: initialProduct,
  });

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось обновить данные</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Перезагрузите страницу и повторите действие.
        </CardContent>
      </Card>
    );
  }

  return (
    <ProductEditorCard
      categories={categories}
      onProductDeleted={handleProductDeleted}
      onProductsChange={refreshProductView}
      product={product}
    />
  );
}
