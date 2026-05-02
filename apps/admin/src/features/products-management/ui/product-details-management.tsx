"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { useProductDetailsManagement } from "../model";
import { ProductEditorCard } from "./product-editor-card";

type ProductDetailsManagementProps = {
  readonly productId: string;
};

export function ProductDetailsManagement({ productId }: ProductDetailsManagementProps) {
  const {
    categories,
    handleProductDeleted,
    isError,
    isPending,
    product,
    refreshProductView,
  } = useProductDetailsManagement({
    productId,
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

  if (isPending || !product) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка товара</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем данные карточки.
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
