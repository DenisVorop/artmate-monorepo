"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Save } from "lucide-react";

import type {
  BlogAuthor,
  BlogCategory,
  BlogPost,
  BlogPostContent,
  BlogTag,
} from "@/entities/blog";
import { Button, Input } from "@/shared/ui";

import {
  blogPostFormSchema,
  emptyBlogPostContent,
  getBlogPostDefaultValues,
  getCreateBlogPostDefaultValues,
  getCreateBlogPostInput,
  getUpdateBlogPostInput,
  normalizeBlogPostContent,
  type BlogPostFormValues,
  type BlogRefreshCallback,
} from "../lib";
import { useCreateBlogPost, useUpdateBlogPost } from "../model";
import { BlogPostContentBuilder } from "./content-builder";
import {
  BlogAuthorSelect,
  BlogCategorySelect,
  BlogPostStatusSelect,
  LabeledCheckbox,
  LabeledField,
  textareaClassName,
} from "./form-controls";

type BlogPostFormProps = {
  readonly authors: readonly BlogAuthor[];
  readonly categories: readonly BlogCategory[];
  readonly onSaved: BlogRefreshCallback;
  readonly post?: BlogPost;
  readonly tags: readonly BlogTag[];
};

export function BlogPostForm({
  authors,
  categories,
  onSaved,
  post,
  tags,
}: BlogPostFormProps) {
  const isEditMode = Boolean(post);
  const defaultValues = useMemo(
    () =>
      post
        ? getBlogPostDefaultValues(post)
        : getCreateBlogPostDefaultValues({ categories }),
    [categories, post],
  );
  const [content, setContent] = useState<BlogPostContent>(() =>
    post ? normalizeBlogPostContent(post.content) : emptyBlogPostContent,
  );
  const { handleSubmit, register, reset } = useForm<BlogPostFormValues>({
    defaultValues,
    resolver: zodResolver(blogPostFormSchema),
  });
  const { isPending: isCreatingPost, mutate: createPost } = useCreateBlogPost({
    onSuccess: async () => {
      reset(getCreateBlogPostDefaultValues({ categories }));
      setContent(emptyBlogPostContent);
      await onSaved();
    },
  });
  const { isPending: isUpdatingPost, mutate: updatePost } = useUpdateBlogPost({
    onSuccess: onSaved,
  });
  const isSaving = isCreatingPost || isUpdatingPost;

  const submitForm = handleSubmit((values) => {
    if (post) {
      updatePost({
        postId: post.id,
        input: getUpdateBlogPostInput(values, content),
      });

      return;
    }

    createPost(getCreateBlogPostInput(values, content));
  });

  return (
    <form className="grid gap-5" onSubmit={submitForm}>
      <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.7fr)_10rem_9rem]">
        <LabeledField label="Заголовок">
          <Input required {...register("title")} />
        </LabeledField>
        <LabeledField label="Slug">
          <Input required {...register("slug")} />
        </LabeledField>
        <LabeledField label="Статус">
          <BlogPostStatusSelect
            defaultValue={defaultValues.status}
            selectProps={register("status")}
          />
        </LabeledField>
        <LabeledCheckbox label="В подборке">
          <input type="checkbox" {...register("featured")} />
        </LabeledCheckbox>
      </div>

      <LabeledField label="Краткое описание">
        <textarea required className={textareaClassName} {...register("excerpt")} />
      </LabeledField>

      <div className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_9rem_minmax(10rem,1fr)]">
        <LabeledField label="Автор">
          <BlogAuthorSelect
            authors={authors}
            defaultValue={defaultValues.authorId}
            selectProps={register("authorId")}
          />
        </LabeledField>
        <LabeledField label="Категория">
          <BlogCategorySelect
            categories={categories}
            defaultValue={defaultValues.categoryId}
            selectProps={register("categoryId")}
          />
        </LabeledField>
        <LabeledField label="Минуты">
          <Input
            min={0}
            step={1}
            type="number"
            {...register("readTimeMinutes", {
              valueAsNumber: true,
            })}
          />
        </LabeledField>
        <LabeledField label="Дата публикации">
          <Input type="datetime-local" {...register("publishedAt")} />
        </LabeledField>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,0.6fr)]">
        <LabeledField label="Обложка URL">
          <Input {...register("imageUrl")} />
        </LabeledField>
        <LabeledField label="Alt обложки">
          <Input {...register("imageAlt")} />
        </LabeledField>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <LabeledField label="SEO title">
          <Input {...register("metaTitle")} />
        </LabeledField>
        <LabeledField label="SEO description">
          <Input {...register("metaDescription")} />
        </LabeledField>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-xs font-medium text-muted-foreground">Теги</legend>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Теги пока не созданы</p>
          ) : (
            tags.map((tag) => (
              <label
                key={tag.id}
                className="flex h-8 items-center gap-2 rounded-lg border border-input px-2.5 text-sm"
              >
                <input type="checkbox" value={tag.id} {...register("tagIds")} />
                {tag.title}
              </label>
            ))
          )}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Конструктор статьи</p>
          <p className="text-xs text-muted-foreground">
            {content.blocks.length} блоков
          </p>
        </div>
        <BlogPostContentBuilder onValueChange={setContent} value={content} />
      </div>

      <div className="flex justify-end">
        <Button disabled={isSaving} type="submit">
          <Save data-icon="inline-start" aria-hidden="true" />
          {isEditMode ? "Сохранить пост" : "Создать пост"}
        </Button>
      </div>
    </form>
  );
}
