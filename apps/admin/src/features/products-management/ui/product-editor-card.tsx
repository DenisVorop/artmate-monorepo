"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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

import {
  deleteProductFormSchema,
  type DeleteProductFormValues,
  type ProductsRefreshCallback,
} from "../lib";
import { useDeleteProduct } from "../model";
import { ProductEditForm } from "./product-edit-form";
import { ProductImagePreview } from "./product-image-preview";
import { ProductImages } from "./product-images";

type ProductEditorCardProps = {
  readonly categories: readonly ProductCategory[];
  readonly onProductDeleted?: ProductsRefreshCallback;
  readonly onProductsChange: ProductsRefreshCallback;
  readonly product: Product;
};

export function ProductEditorCard({
  categories,
  onProductDeleted,
  onProductsChange,
  product,
}: ProductEditorCardProps) {
  const primaryImage = getProductPrimaryImage(product);
  const { handleSubmit, register } = useForm<DeleteProductFormValues>({
    defaultValues: {
      productId: product.id,
    },
    resolver: zodResolver(deleteProductFormSchema),
  });
  const { isPending: isDeletingProduct, mutate: deleteProduct } =
    useDeleteProduct({
      onSuccess: onProductDeleted ?? onProductsChange,
    });
  const submitDeleteForm = handleSubmit((values) => {
    deleteProduct(values.productId);
  });

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
          <form onSubmit={submitDeleteForm}>
            <input type="hidden" {...register("productId")} />
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
