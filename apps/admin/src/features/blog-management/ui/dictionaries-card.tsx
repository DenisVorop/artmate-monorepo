"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";

import type { BlogAuthor, BlogCategory, BlogTag } from "@/entities/blog";
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
  blogAuthorFormSchema,
  blogCategoryFormSchema,
  blogTagFormSchema,
  createBlogAuthorDefaultValues,
  createBlogCategoryDefaultValues,
  createBlogTagDefaultValues,
  getCreateBlogAuthorInput,
  getCreateBlogCategoryInput,
  getCreateBlogTagInput,
  type BlogAuthorFormValues,
  type BlogCategoryFormValues,
  type BlogRefreshCallback,
  type BlogTagFormValues,
} from "../lib";
import {
  useCreateBlogAuthor,
  useCreateBlogCategory,
  useCreateBlogTag,
} from "../model";
import { LabeledField, textareaClassName } from "./form-controls";

type BlogDictionariesCardProps = {
  readonly authors: readonly BlogAuthor[];
  readonly categories: readonly BlogCategory[];
  readonly onBlogChange: BlogRefreshCallback;
  readonly tags: readonly BlogTag[];
};

export function BlogDictionariesCard({
  authors,
  categories,
  onBlogChange,
  tags,
}: BlogDictionariesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Справочники</CardTitle>
        <CardDescription>
          Авторы, категории и теги нужны для публикации постов.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-3">
        <AuthorForm authors={authors} onBlogChange={onBlogChange} />
        <CategoryForm categories={categories} onBlogChange={onBlogChange} />
        <TagForm onBlogChange={onBlogChange} tags={tags} />
      </CardContent>
    </Card>
  );
}

function AuthorForm({
  authors,
  onBlogChange,
}: {
  readonly authors: readonly BlogAuthor[];
  readonly onBlogChange: BlogRefreshCallback;
}) {
  const { handleSubmit, register, reset } = useForm<BlogAuthorFormValues>({
    defaultValues: createBlogAuthorDefaultValues,
    resolver: zodResolver(blogAuthorFormSchema),
  });
  const { isPending, mutate } = useCreateBlogAuthor({
    onSuccess: async () => {
      reset(createBlogAuthorDefaultValues);
      await onBlogChange();
    },
  });
  const submitForm = handleSubmit((values) => {
    mutate(getCreateBlogAuthorInput(values));
  });

  return (
    <section className="grid content-start gap-3 rounded-lg border p-3">
      <DictionaryHeader count={authors.length} title="Авторы" />
      <form className="grid gap-3" onSubmit={submitForm}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <LabeledField label="Имя">
            <Input required {...register("name")} />
          </LabeledField>
          <LabeledField label="Slug">
            <Input required {...register("slug")} />
          </LabeledField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <LabeledField label="Роль">
            <Input {...register("role")} />
          </LabeledField>
          <LabeledField label="Аватар">
            <Input maxLength={40} {...register("avatar")} />
          </LabeledField>
        </div>
        <LabeledField label="Фото URL">
          <Input {...register("image")} />
        </LabeledField>
        <LabeledField label="Bio">
          <textarea className={textareaClassName} {...register("bio")} />
        </LabeledField>
        <Button disabled={isPending} size="sm" type="submit">
          <Plus data-icon="inline-start" aria-hidden="true" />
          Добавить автора
        </Button>
      </form>
    </section>
  );
}

function CategoryForm({
  categories,
  onBlogChange,
}: {
  readonly categories: readonly BlogCategory[];
  readonly onBlogChange: BlogRefreshCallback;
}) {
  const { handleSubmit, register, reset } = useForm<BlogCategoryFormValues>({
    defaultValues: createBlogCategoryDefaultValues,
    resolver: zodResolver(blogCategoryFormSchema),
  });
  const { isPending, mutate } = useCreateBlogCategory({
    onSuccess: async () => {
      reset(createBlogCategoryDefaultValues);
      await onBlogChange();
    },
  });
  const submitForm = handleSubmit((values) => {
    mutate(getCreateBlogCategoryInput(values));
  });

  return (
    <section className="grid content-start gap-3 rounded-lg border p-3">
      <DictionaryHeader count={categories.length} title="Категории" />
      <form className="grid gap-3" onSubmit={submitForm}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <LabeledField label="Название">
            <Input required {...register("title")} />
          </LabeledField>
          <LabeledField label="Slug">
            <Input required {...register("slug")} />
          </LabeledField>
        </div>
        <LabeledField label="Описание">
          <textarea className={textareaClassName} {...register("description")} />
        </LabeledField>
        <Button disabled={isPending} size="sm" type="submit">
          <Plus data-icon="inline-start" aria-hidden="true" />
          Добавить категорию
        </Button>
      </form>
    </section>
  );
}

function TagForm({
  onBlogChange,
  tags,
}: {
  readonly onBlogChange: BlogRefreshCallback;
  readonly tags: readonly BlogTag[];
}) {
  const { handleSubmit, register, reset } = useForm<BlogTagFormValues>({
    defaultValues: createBlogTagDefaultValues,
    resolver: zodResolver(blogTagFormSchema),
  });
  const { isPending, mutate } = useCreateBlogTag({
    onSuccess: async () => {
      reset(createBlogTagDefaultValues);
      await onBlogChange();
    },
  });
  const submitForm = handleSubmit((values) => {
    mutate(getCreateBlogTagInput(values));
  });

  return (
    <section className="grid content-start gap-3 rounded-lg border p-3">
      <DictionaryHeader count={tags.length} title="Теги" />
      <form className="grid gap-3" onSubmit={submitForm}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <LabeledField label="Название">
            <Input required {...register("title")} />
          </LabeledField>
          <LabeledField label="Slug">
            <Input required {...register("slug")} />
          </LabeledField>
        </div>
        <Button disabled={isPending} size="sm" type="submit">
          <Plus data-icon="inline-start" aria-hidden="true" />
          Добавить тег
        </Button>
      </form>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 12).map((tag) => (
            <Badge key={tag.id} variant="secondary">
              {tag.title}
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DictionaryHeader({
  count,
  title,
}: {
  readonly count: number;
  readonly title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <Badge variant="outline">{count}</Badge>
    </div>
  );
}
