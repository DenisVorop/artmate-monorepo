"use client";

import type { FormEvent } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

import type { Product, ProductCategory } from "@/entities/products";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/shared/ui";

import {
  getOptionalString,
  getRequiredString,
  getString,
  reportMutationError,
  type ProductsRefreshCallback,
} from "../lib";
import {
  useCreateProductCategory,
  useDeleteProductCategory,
  useUpdateProductCategory,
} from "../model";
import { LabeledField } from "./form-controls";
import { ProductImagePreview } from "./product-image-preview";

type ProductCategoriesCardProps = {
  readonly categories: readonly ProductCategory[];
  readonly onProductsChange: ProductsRefreshCallback;
  readonly products: readonly Product[];
};

export function ProductCategoriesCard({
  categories,
  onProductsChange,
  products,
}: ProductCategoriesCardProps) {
  const { isPending: isCreatingCategory, mutate: createCategory } =
    useCreateProductCategory({
      onSuccess: onProductsChange,
    });

  function handleCreateCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    createCategory(
      {
        image: getOptionalString(formData.get("image")),
        slug: getRequiredString(formData.get("slug"), "slug"),
        title: getRequiredString(formData.get("title"), "title"),
      },
      {
        onError: reportMutationError,
        onSuccess: () => form.reset(),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Категории</CardTitle>
        <CardDescription>
          Разделы каталога, URL и изображение для метаданных
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(12rem,1.5fr)_auto]"
          onSubmit={handleCreateCategorySubmit}
        >
          <LabeledField label="Название">
            <Input name="title" placeholder="Котики" required />
          </LabeledField>
          <LabeledField label="Slug">
            <Input name="slug" placeholder="kotiki" required />
          </LabeledField>
          <LabeledField label="Изображение">
            <Input name="image" placeholder="https://..." />
          </LabeledField>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={isCreatingCategory}
              type="submit"
              variant="outline"
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              Добавить
            </Button>
          </div>
        </form>

        {categories.length > 0 ? (
          <div className="grid gap-3">
            {categories.map((category) => {
              const productsCount = products.filter(
                (product) => product.categoryId === category.id,
              ).length;

              return (
                <ProductCategoryRow
                  category={category}
                  key={category.id}
                  onProductsChange={onProductsChange}
                  productsCount={productsCount}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Создайте категорию, чтобы добавлять товары
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductCategoryRow({
  category,
  onProductsChange,
  productsCount,
}: {
  readonly category: ProductCategory;
  readonly onProductsChange: ProductsRefreshCallback;
  readonly productsCount: number;
}) {
  const { isPending: isUpdatingCategory, mutate: updateCategory } =
    useUpdateProductCategory({
      onSuccess: onProductsChange,
    });
  const { isPending: isDeletingCategory, mutate: deleteCategory } =
    useDeleteProductCategory({
      onSuccess: onProductsChange,
    });

  function handleUpdateCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    updateCategory(
      {
        categoryId: category.id,
        input: {
          image: getString(formData.get("image")),
          slug: getRequiredString(formData.get("slug"), "slug"),
          title: getRequiredString(formData.get("title"), "title"),
        },
      },
      {
        onError: reportMutationError,
      },
    );
  }

  function handleDeleteCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    deleteCategory(category.id, {
      onError: reportMutationError,
    });
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[3.5rem_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(12rem,1.5fr)_auto_auto_auto]">
      <ProductImagePreview
        className="size-14"
        imageUrl={category.image}
        label={category.title}
      />
      <form className="contents" onSubmit={handleUpdateCategorySubmit}>
        <Input
          aria-label="Название категории"
          defaultValue={category.title}
          name="title"
          required
        />
        <Input
          aria-label="Slug категории"
          defaultValue={category.slug}
          name="slug"
          required
        />
        <Input
          aria-label="Изображение категории"
          defaultValue={category.image}
          name="image"
          placeholder="https://..."
        />
        <Button
          disabled={isUpdatingCategory}
          size="icon-sm"
          type="submit"
          variant="outline"
        >
          <Save aria-hidden="true" />
        </Button>
      </form>
      <Badge variant="outline">{productsCount}</Badge>
      <form onSubmit={handleDeleteCategorySubmit}>
        <Button
          disabled={productsCount > 0 || isDeletingCategory}
          size="icon-sm"
          type="submit"
          variant="destructive"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
