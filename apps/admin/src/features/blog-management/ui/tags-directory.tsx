"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, Trash2 } from "lucide-react";
import { useForm, type UseFormRegister } from "react-hook-form";

import { formatBlogPostDate, type BlogTag, useBlogTags } from "@/entities/blog";
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
  blogTagFormSchema,
  createBlogTagDefaultValues,
  deleteBlogTagFormSchema,
  getCreateBlogTagInput,
  getUpdateBlogTagInput,
  type BlogRefreshCallback,
  type BlogTagFormValues,
  type DeleteBlogTagFormValues,
} from "../lib";
import {
  useCreateBlogTag,
  useDeleteBlogTag,
  useUpdateBlogTag,
} from "../model";
import { LabeledField } from "./form-controls";

export function BlogTagsDirectory() {
  const { isError, isPending, refetch, tags } = useBlogTags();
  const refreshTags = async () => {
    await refetch();
  };

  if (isError) {
    return (
      <DirectoryState
        description="Перезагрузите страницу и повторите действие."
        title="Не удалось загрузить теги"
      />
    );
  }

  if (isPending) {
    return (
      <DirectoryState
        description="Получаем список добавленных тегов."
        title="Загрузка тегов"
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <TagsList onTagsChange={refreshTags} tags={tags} />
      <CreateTagPanel onTagsChange={refreshTags} />
    </div>
  );
}

function CreateTagPanel({
  onTagsChange,
}: {
  readonly onTagsChange: BlogRefreshCallback;
}) {
  const { handleSubmit, register, reset } = useForm<BlogTagFormValues>({
    defaultValues: createBlogTagDefaultValues,
    resolver: zodResolver(blogTagFormSchema),
  });
  const { isPending, mutate } = useCreateBlogTag({
    onSuccess: async () => {
      reset(createBlogTagDefaultValues);
      await onTagsChange();
    },
  });
  const submitForm = handleSubmit((values) => {
    mutate(getCreateBlogTagInput(values));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый тег</CardTitle>
        <CardDescription>
          Теги помогают связывать посты по общим темам.
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
          <Button disabled={isPending} type="submit">
            <Plus data-icon="inline-start" aria-hidden="true" />
            Добавить тег
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TagsList({
  onTagsChange,
  tags,
}: {
  readonly onTagsChange: BlogRefreshCallback;
  readonly tags: readonly BlogTag[];
}) {
  if (tags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Теги</CardTitle>
          <CardDescription>Теги пока не созданы.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Добавьте первый тег через панель добавления
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Теги</CardTitle>
        <CardDescription>
          {tags.length} элементов в справочнике.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {tags.map((tag) => (
            <TagRow key={tag.id} onTagsChange={onTagsChange} tag={tag} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TagRow({
  onTagsChange,
  tag,
}: {
  readonly onTagsChange: BlogRefreshCallback;
  readonly tag: BlogTag;
}) {
  const { handleSubmit, register } = useForm<BlogTagFormValues>({
    defaultValues: {
      slug: tag.slug,
      title: tag.title,
    },
    resolver: zodResolver(blogTagFormSchema),
  });
  const { isPending: isUpdatingTag, mutate: updateTag } = useUpdateBlogTag({
    onSuccess: onTagsChange,
  });
  const { isPending: isDeletingTag, mutate: deleteTag } = useDeleteBlogTag({
    onSuccess: onTagsChange,
  });
  const { handleSubmit: handleDeleteSubmit, register: registerDelete } =
    useForm<DeleteBlogTagFormValues>({
      defaultValues: {
        tagId: tag.id,
      },
      resolver: zodResolver(deleteBlogTagFormSchema),
    });
  const submitUpdateForm = handleSubmit((values) => {
    updateTag({
      tagId: tag.id,
      input: getUpdateBlogTagInput(values),
    });
  });
  const submitDeleteForm = handleDeleteSubmit((values) => {
    deleteTag(values.tagId);
  });

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <form
        className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto]"
        onSubmit={submitUpdateForm}
      >
        <LabeledField label="Название">
          <Input required {...register("title")} />
        </LabeledField>
        <LabeledField label="Slug">
          <Input required {...register("slug")} />
        </LabeledField>
        <div className="flex items-end">
          <Button
            aria-label={`Сохранить тег ${tag.title}`}
            disabled={isUpdatingTag}
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
          Обновлен {formatBlogPostDate(tag.updatedAt)}
        </span>
        <DeleteTagForm
          disabled={isDeletingTag}
          onSubmit={submitDeleteForm}
          register={registerDelete}
          tagId={tag.id}
          tagTitle={tag.title}
        />
      </div>
    </div>
  );
}

function DeleteTagForm({
  disabled,
  onSubmit,
  register,
  tagId,
  tagTitle,
}: {
  readonly disabled: boolean;
  readonly onSubmit: () => void;
  readonly register: UseFormRegister<DeleteBlogTagFormValues>;
  readonly tagId: string;
  readonly tagTitle: string;
}) {
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" value={tagId} {...register("tagId")} />
      <Button
        aria-label={`Удалить тег ${tagTitle}`}
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
