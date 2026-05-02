"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Save, Trash2 } from "lucide-react";

import type { Product, ProductCategory } from "@/entities/products";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/shared/ui";

import {
  createProductCategoryDefaultValues,
  deleteCategoryFormSchema,
  getCategoryProductsCount,
  getCreateCategoryInput,
  getUpdateCategoryInput,
  productCategoryFormSchema,
  type DeleteCategoryFormValues,
  type ProductCategoryFormValues,
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
  const { handleSubmit, register, reset } = useForm<ProductCategoryFormValues>({
    defaultValues: createProductCategoryDefaultValues,
    resolver: zodResolver(productCategoryFormSchema),
  });
  const { isPending: isCreatingCategory, mutate: createCategory } =
    useCreateProductCategory({
      onSuccess: onProductsChange,
    });
  const submitForm = handleSubmit((values) => {
    createCategory(getCreateCategoryInput(values), {
      onSuccess: () => reset(),
    });
  });

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
          onSubmit={submitForm}
        >
          <LabeledField label="Название">
            <Input
              placeholder="Котики"
              required
              {...register("title")}
            />
          </LabeledField>
          <LabeledField label="Slug">
            <Input
              placeholder="kotiki"
              required
              {...register("slug")}
            />
          </LabeledField>
          <LabeledField label="Изображение">
            <Input placeholder="https://..." {...register("image")} />
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
              const productsCount = getCategoryProductsCount(products, category.id);

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
  const { handleSubmit, register } = useForm<ProductCategoryFormValues>({
    defaultValues: {
      image: category.image ?? "",
      slug: category.slug,
      title: category.title,
    },
    resolver: zodResolver(productCategoryFormSchema),
  });
  const { isPending: isUpdatingCategory, mutate: updateCategory } =
    useUpdateProductCategory({
      onSuccess: onProductsChange,
    });
  const { isPending: isDeletingCategory, mutate: deleteCategory } =
    useDeleteProductCategory({
      onSuccess: onProductsChange,
    });
  const { handleSubmit: handleDeleteSubmit, register: registerDelete } =
    useForm<DeleteCategoryFormValues>({
      defaultValues: {
        categoryId: category.id,
      },
      resolver: zodResolver(deleteCategoryFormSchema),
    });
  const submitUpdateForm = handleSubmit((values) => {
    updateCategory({
      categoryId: category.id,
      input: getUpdateCategoryInput(values),
    });
  });
  const submitDeleteForm = handleDeleteSubmit((values) => {
    deleteCategory(values.categoryId);
  });

  return (
    <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[3.5rem_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(12rem,1.5fr)_auto_auto_auto]">
      <ProductImagePreview
        className="size-14"
        imageUrl={category.image}
        label={category.title}
      />
      <form className="contents" onSubmit={submitUpdateForm}>
        <Input
          aria-label="Название категории"
          required
          {...register("title")}
        />
        <Input
          aria-label="Slug категории"
          required
          {...register("slug")}
        />
        <Input
          aria-label="Изображение категории"
          placeholder="https://..."
          {...register("image")}
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
      <form onSubmit={submitDeleteForm}>
        <input type="hidden" {...registerDelete("categoryId")} />
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
