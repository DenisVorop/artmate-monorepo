"use client";

import type { Product, ProductCategory } from "@/entities/products";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

import type { ProductsRefreshCallback } from "../lib";
import { ProductEditorCard } from "./product-editor-card";
import { ProductsTable } from "./products-table";

type ProductsListProps = {
  readonly categories: readonly ProductCategory[];
  readonly onProductsChange: ProductsRefreshCallback;
  readonly onSelectProduct: (productId: string) => void;
  readonly products: readonly Product[];
  readonly selectedProductId: string | null;
};

export function ProductsList({
  categories,
  onProductsChange,
  onSelectProduct,
  products,
  selectedProductId,
}: ProductsListProps) {
  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? products[0];

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Каталог</CardTitle>
          <CardDescription>Локальные товары пока не созданы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Добавьте первый товар через форму выше
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <ProductsTable
        onSelectProduct={onSelectProduct}
        products={products}
        selectedProductId={selectedProduct?.id ?? null}
      />
      {selectedProduct ? (
        <ProductEditorCard
          categories={categories}
          key={selectedProduct.id}
          onProductsChange={onProductsChange}
          product={selectedProduct}
        />
      ) : null}
    </div>
  );
}
