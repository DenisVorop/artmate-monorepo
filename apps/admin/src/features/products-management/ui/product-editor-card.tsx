"use client";

import type { FormEvent } from "react";
import { Trash2 } from "lucide-react";

import {
  formatProductDate,
  formatProductPrice,
  getProductPrimaryImage,
  getProductStatusBadgeVariant,
  getProductStatusLabel,
  type Product,
  type ProductCategory,
} from "@/entities/products";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { reportMutationError, type ProductsRefreshCallback } from "../lib";
import { useDeleteProduct } from "../model";
import { ProductEditForm } from "./product-edit-form";
import { ProductImagePreview } from "./product-image-preview";
import { ProductImages } from "./product-images";

type ProductEditorCardProps = {
  readonly categories: readonly ProductCategory[];
  readonly onProductsChange: ProductsRefreshCallback;
  readonly product: Product;
};

export function ProductEditorCard({
  categories,
  onProductsChange,
  product,
}: ProductEditorCardProps) {
  const primaryImage = getProductPrimaryImage(product);
  const { isPending: isDeletingProduct, mutate: deleteProduct } =
    useDeleteProduct({
      onSuccess: onProductsChange,
    });

  function handleDeleteProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    deleteProduct(product.id, {
      onError: reportMutationError,
    });
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProductImagePreview
            imageUrl={primaryImage?.url}
            label={primaryImage?.alt ?? product.title}
          />
          <div className="min-w-0">
            <CardTitle className="truncate">{product.title}</CardTitle>
            <CardDescription>
              {product.slug} · {product.category?.title ?? "Без категории"} ·{" "}
              {formatProductPrice(product)} · обновлен{" "}
              {formatProductDate(product.updatedAt)}
            </CardDescription>
          </div>
        </div>
        <CardAction className="flex items-start gap-2">
          {product.isHit && <Badge variant="secondary">Хит</Badge>}
          <Badge variant={getProductStatusBadgeVariant(product.status)}>
            {getProductStatusLabel(product.status)}
          </Badge>
          <form onSubmit={handleDeleteProductSubmit}>
            <Button
              aria-label={`Удалить товар ${product.title}`}
              disabled={isDeletingProduct}
              size="icon-sm"
              type="submit"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </form>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ProductEditForm
          categories={categories}
          onProductsChange={onProductsChange}
          product={product}
        />
        <ProductImages onProductsChange={onProductsChange} product={product} />
      </CardContent>
    </Card>
  );
}
