"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { useProductsManagement } from "../model";
import { CreateProductCard } from "./create-product-card";
import { ProductsList } from "./products-list";

export function ProductsManagement() {
  const { categories, isError, isPending, products, refreshProductsView, tags } =
    useProductsManagement();

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить каталог</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Перезагрузите страницу и повторите действие.
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка каталога</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем товары и категории.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <CreateProductCard
        categories={categories}
        onProductsChange={refreshProductsView}
        tags={tags}
      />
      <ProductsList products={products} />
    </div>
  );
}
