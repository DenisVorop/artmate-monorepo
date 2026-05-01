"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import {
  productsQueryKeys,
  useCategories,
  useProduct,
  type Product,
  type ProductCategory,
} from "@/entities/products";
import { routes } from "@/shared/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { ProductEditorCard } from "./product-editor-card";

type ProductDetailsManagementProps = {
  readonly categories: readonly ProductCategory[];
  readonly product: Product;
};

export function ProductDetailsManagement({
  categories: initialCategories,
  product: initialProduct,
}: ProductDetailsManagementProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    isError: isProductError,
    product,
    refetch: refetchProduct,
  } = useProduct({
    initialData: initialProduct,
    productId: initialProduct.id,
  });
  const {
    categories,
    isError: isCategoriesError,
    refetch: refetchCategories,
  } = useCategories({
    initialData: initialCategories,
  });

  const refreshProductView = useCallback(async () => {
    await Promise.all([
      refetchProduct(),
      refetchCategories(),
      queryClient.invalidateQueries({
        queryKey: productsQueryKeys.list(),
      }),
    ]);
  }, [queryClient, refetchCategories, refetchProduct]);

  const handleProductDeleted = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: productsQueryKeys.list(),
    });
    queryClient.removeQueries({
      queryKey: productsQueryKeys.detail(initialProduct.id),
    });
    router.push(routes.products);
  }, [initialProduct.id, queryClient, router]);

  if (isProductError || isCategoriesError) {
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
