"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, Trash2 } from "lucide-react";
import { useForm, type UseFormRegister } from "react-hook-form";

import {
  formatBlogPostDate,
  type BlogCategory,
  useBlogCategories,
} from "@/entities/blog";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/shared/ui";

import {
  blogCategoryFormSchema,
  createBlogCategoryDefaultValues,
  deleteBlogCategoryFormSchema,
  getCreateBlogCategoryInput,
  getUpdateBlogCategoryInput,
  type BlogCategoryFormValues,
  type BlogRefreshCallback,
  type DeleteBlogCategoryFormValues,
} from "../lib";
import {
  useCreateBlogCategory,
  useDeleteBlogCategory,
  useUpdateBlogCategory,
} from "../model";
import { LabeledField, textareaClassName } from "./form-controls";

export function BlogCategoriesDirectory() {
  const { categories, isError, isPending, refetch } = useBlogCategories();
  const refreshCategories = async () => {
    await refetch();
  };

  if (isError) {
    return (
      <DirectoryState
        description="Перезагрузите страницу и повторите действие."
        title="Не удалось загрузить категории"
      />
    );
  }

  if (isPending) {
    return (
      <DirectoryState
        description="Получаем список добавленных категорий."
        title="Загрузка категорий"
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <CategoriesList
        categories={categories}
        onCategoriesChange={refreshCategories}
      />
      <CreateCategoryPanel onCategoriesChange={refreshCategories} />
    </div>
  );
}

function CreateCategoryPanel({
  onCategoriesChange,
}: {
  readonly onCategoriesChange: BlogRefreshCallback;
}) {
  const { handleSubmit, register, reset } = useForm<BlogCategoryFormValues>({
    defaultValues: createBlogCategoryDefaultValues,
    resolver: zodResolver(blogCategoryFormSchema),
  });
  const { isPending, mutate } = useCreateBlogCategory({
    onSuccess: async () => {
      reset(createBlogCategoryDefaultValues);
      await onCategoriesChange();
    },
  });
  const submitForm = handleSubmit((values) => {
    mutate(getCreateBlogCategoryInput(values));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новая категория</CardTitle>
        <CardDescription>
          Категория группирует посты и участвует в публичном URL.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitForm}>
          <LabeledField label="Название">
            <Input required {...register("title")} />
          </LabeledField>
          <LabeledField label="Slug">
            <Input required {...register("slug")} />
          </LabeledField>
          <LabeledField label="Описание">
            <textarea
              className={textareaClassName}
              {...register("description")}
            />
          </LabeledField>
          <Button disabled={isPending} type="submit">
            <Plus data-icon="inline-start" aria-hidden="true" />
            Добавить категорию
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CategoriesList({
  categories,
  onCategoriesChange,
}: {
  readonly categories: readonly BlogCategory[];
  readonly onCategoriesChange: BlogRefreshCallback;
}) {
  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Категории</CardTitle>
          <CardDescription>Категории пока не созданы.</CardDescription>
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
          {categories.map((category) => (
            <CategoryRow
              category={category}
              key={category.id}
              onCategoriesChange={onCategoriesChange}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryRow({
  category,
  onCategoriesChange,
}: {
  readonly category: BlogCategory;
  readonly onCategoriesChange: BlogRefreshCallback;
}) {
  const { handleSubmit, register } = useForm<BlogCategoryFormValues>({
    defaultValues: {
      description: category.description ?? "",
      slug: category.slug,
      title: category.title,
    },
    resolver: zodResolver(blogCategoryFormSchema),
  });
  const { isPending: isUpdatingCategory, mutate: updateCategory } =
    useUpdateBlogCategory({
      onSuccess: onCategoriesChange,
    });
  const { isPending: isDeletingCategory, mutate: deleteCategory } =
    useDeleteBlogCategory({
      onSuccess: onCategoriesChange,
    });
  const { handleSubmit: handleDeleteSubmit, register: registerDelete } =
    useForm<DeleteBlogCategoryFormValues>({
      defaultValues: {
        categoryId: category.id,
      },
      resolver: zodResolver(deleteBlogCategoryFormSchema),
    });
  const submitUpdateForm = handleSubmit((values) => {
    updateCategory({
      categoryId: category.id,
      input: getUpdateBlogCategoryInput(values),
    });
  });
  const submitDeleteForm = handleDeleteSubmit((values) => {
    deleteCategory(values.categoryId);
  });

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <form className="grid gap-3 lg:grid-cols-2" onSubmit={submitUpdateForm}>
        <LabeledField label="Название">
          <Input required {...register("title")} />
        </LabeledField>
        <LabeledField label="Slug">
          <Input required {...register("slug")} />
        </LabeledField>
        <LabeledField className="lg:col-span-2" label="Описание">
          <textarea
            className={textareaClassName}
            {...register("description")}
          />
        </LabeledField>
        <div className="flex items-end">
          <Button
            aria-label={`Сохранить категорию ${category.title}`}
            disabled={isUpdatingCategory}
            type="submit"
            variant="outline"
          >
            <Save data-icon="inline-start" aria-hidden="true" />
            Сохранить
          </Button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          Обновлена {formatBlogPostDate(category.updatedAt)}
        </span>
        <DeleteCategoryForm
          categoryId={category.id}
          categoryTitle={category.title}
          disabled={isDeletingCategory}
          onSubmit={submitDeleteForm}
          register={registerDelete}
        />
      </div>
    </div>
  );
}

function DeleteCategoryForm({
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
  readonly register: UseFormRegister<DeleteBlogCategoryFormValues>;
}) {
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" value={categoryId} {...register("categoryId")} />
      <Button
        aria-label={`Удалить категорию ${categoryTitle}`}
        disabled={disabled}
        size="sm"
        type="submit"
        variant="destructive"
      >
        <Trash2 data-icon="inline-start" aria-hidden="true" />
        Удалить
      </Button>
    </form>
  );
}

function DirectoryState({
  description,
  title,
}: {
  readonly description: string;
  readonly title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}
