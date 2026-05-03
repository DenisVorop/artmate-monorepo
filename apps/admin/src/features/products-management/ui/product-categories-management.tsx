"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, Trash2 } from "lucide-react";
import { useForm, type UseFormRegister } from "react-hook-form";

import {
  formatProductDate,
  type Product,
  type ProductCategory,
} from "@/entities/products";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/shared/ui";

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
  useProductsManagement,
  useUpdateProductCategory,
} from "../model";
import { LabeledField } from "./form-controls";
import { ProductImagePreview } from "./product-image-preview";

export function ProductCategoriesManagement() {
  const { categories, isError, isPending, products, refreshProductsView } =
    useProductsManagement();

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить категории</CardTitle>
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
          <CardTitle>Загрузка категорий</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем категории и товары для счетчиков.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <ProductCategoriesList
        categories={categories}
        onProductsChange={refreshProductsView}
        products={products}
      />
      <CreateProductCategoryPanel onProductsChange={refreshProductsView} />
    </div>
  );
}

function CreateProductCategoryPanel({
  onProductsChange,
}: {
  readonly onProductsChange: ProductsRefreshCallback;
}) {
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
      onSuccess: () => reset(createProductCategoryDefaultValues),
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новая категория</CardTitle>
        <CardDescription>
          Раздел каталога, URL и изображение для метаданных.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitForm}>
          <LabeledField label="Название">
            <Input placeholder="Котики" required {...register("title")} />
          </LabeledField>
          <LabeledField label="Slug">
            <Input placeholder="kotiki" required {...register("slug")} />
          </LabeledField>
          <LabeledField label="Изображение">
            <Input placeholder="https://..." {...register("image")} />
          </LabeledField>
          <Button disabled={isCreatingCategory} type="submit">
            <Plus data-icon="inline-start" aria-hidden="true" />
            Добавить категорию
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProductCategoriesList({
  categories,
  onProductsChange,
  products,
}: {
  readonly categories: readonly ProductCategory[];
  readonly onProductsChange: ProductsRefreshCallback;
  readonly products: readonly Product[];
}) {
  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Категории</CardTitle>
          <CardDescription>Категории каталога пока не созданы.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Добавьте первую категорию через панель добавления
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Категории</CardTitle>
        <CardDescription>
          {categories.length} элементов в справочнике.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
    <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[3rem_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(12rem,1.5fr)_auto_auto_auto_auto]">
      <ProductImagePreview
        className="size-12 rounded-md"
        imageUrl={category.image}
        label={category.title}
      />
      <form className="contents" onSubmit={submitUpdateForm}>
        <Input
          aria-label="Название категории"
          required
          {...register("title")}
        />
        <Input aria-label="Slug категории" required {...register("slug")} />
        <Input
          aria-label="Изображение категории"
          placeholder="https://..."
          {...register("image")}
        />
        <Badge className="self-center" variant="outline">
          {productsCount}
        </Badge>
        <span className="self-center text-sm text-muted-foreground">
          {formatProductDate(category.updatedAt)}
        </span>
        <div className="flex justify-end gap-2">
          <Button
            aria-label={`Сохранить категорию ${category.title}`}
            disabled={isUpdatingCategory}
            size="icon-sm"
            type="submit"
            variant="outline"
          >
            <Save aria-hidden="true" />
          </Button>
        </div>
      </form>
      <DeleteProductCategoryForm
        categoryId={category.id}
        categoryTitle={category.title}
        disabled={productsCount > 0 || isDeletingCategory}
        onSubmit={submitDeleteForm}
        register={registerDelete}
      />
    </div>
  );
}

function DeleteProductCategoryForm({
  categoryId,
  categoryTitle,
  disabled,
  onSubmit,
  register,
}: {
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly disabled: boolean;
  readonly onSubmit: () => void;
  readonly register: UseFormRegister<DeleteCategoryFormValues>;
}) {
  return (
    <form className="self-center" onSubmit={onSubmit}>
      <input type="hidden" value={categoryId} {...register("categoryId")} />
      <Button
        aria-label={`Удалить категорию ${categoryTitle}`}
        disabled={disabled}
        size="icon-sm"
        type="submit"
        variant="destructive"
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </form>
  );
}
