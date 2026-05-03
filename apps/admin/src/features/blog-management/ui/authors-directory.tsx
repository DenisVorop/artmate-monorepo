"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, Trash2 } from "lucide-react";
import { useForm, type UseFormRegister } from "react-hook-form";

import {
  formatBlogPostDate,
  type BlogAuthor,
  useBlogAuthors,
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
  blogAuthorFormSchema,
  createBlogAuthorDefaultValues,
  deleteBlogAuthorFormSchema,
  getCreateBlogAuthorInput,
  getUpdateBlogAuthorInput,
  type BlogAuthorFormValues,
  type BlogRefreshCallback,
  type DeleteBlogAuthorFormValues,
} from "../lib";
import {
  useCreateBlogAuthor,
  useDeleteBlogAuthor,
  useUpdateBlogAuthor,
} from "../model";
import { LabeledField, textareaClassName } from "./form-controls";

export function BlogAuthorsDirectory() {
  const { authors, isError, isPending, refetch } = useBlogAuthors();
  const refreshAuthors = async () => {
    await refetch();
  };

  if (isError) {
    return (
      <DirectoryState
        description="Перезагрузите страницу и повторите действие."
        title="Не удалось загрузить авторов"
      />
    );
  }

  if (isPending) {
    return (
      <DirectoryState
        description="Получаем список добавленных авторов."
        title="Загрузка авторов"
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <AuthorsList authors={authors} onAuthorsChange={refreshAuthors} />
      <CreateAuthorPanel onAuthorsChange={refreshAuthors} />
    </div>
  );
}

function CreateAuthorPanel({
  onAuthorsChange,
}: {
  readonly onAuthorsChange: BlogRefreshCallback;
}) {
  const { handleSubmit, register, reset } = useForm<BlogAuthorFormValues>({
    defaultValues: createBlogAuthorDefaultValues,
    resolver: zodResolver(blogAuthorFormSchema),
  });
  const { isPending, mutate } = useCreateBlogAuthor({
    onSuccess: async () => {
      reset(createBlogAuthorDefaultValues);
      await onAuthorsChange();
    },
  });
  const submitForm = handleSubmit((values) => {
    mutate(getCreateBlogAuthorInput(values));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый автор</CardTitle>
        <CardDescription>
          Имя, публичный slug и краткое описание автора.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitForm}>
          <LabeledField label="Имя">
            <Input required {...register("name")} />
          </LabeledField>
          <LabeledField label="Slug">
            <Input required {...register("slug")} />
          </LabeledField>
          <LabeledField label="Роль">
            <Input {...register("role")} />
          </LabeledField>
          <LabeledField label="Аватар">
            <Input maxLength={40} {...register("avatar")} />
          </LabeledField>
          <LabeledField label="Фото URL">
            <Input {...register("image")} />
          </LabeledField>
          <LabeledField label="Bio">
            <textarea className={textareaClassName} {...register("bio")} />
          </LabeledField>
          <Button disabled={isPending} type="submit">
            <Plus data-icon="inline-start" aria-hidden="true" />
            Добавить автора
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AuthorsList({
  authors,
  onAuthorsChange,
}: {
  readonly authors: readonly BlogAuthor[];
  readonly onAuthorsChange: BlogRefreshCallback;
}) {
  if (authors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Авторы</CardTitle>
          <CardDescription>Авторы пока не созданы.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Добавьте первого автора через панель добавления
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Авторы</CardTitle>
        <CardDescription>
          {authors.length} элементов в справочнике.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {authors.map((author) => (
            <AuthorRow
              author={author}
              key={author.id}
              onAuthorsChange={onAuthorsChange}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AuthorRow({
  author,
  onAuthorsChange,
}: {
  readonly author: BlogAuthor;
  readonly onAuthorsChange: BlogRefreshCallback;
}) {
  const { handleSubmit, register } = useForm<BlogAuthorFormValues>({
    defaultValues: {
      avatar: author.avatar ?? "",
      bio: author.bio ?? "",
      image: author.image ?? "",
      name: author.name,
      role: author.role ?? "",
      slug: author.slug,
    },
    resolver: zodResolver(blogAuthorFormSchema),
  });
  const { isPending: isUpdatingAuthor, mutate: updateAuthor } =
    useUpdateBlogAuthor({
      onSuccess: onAuthorsChange,
    });
  const { isPending: isDeletingAuthor, mutate: deleteAuthor } =
    useDeleteBlogAuthor({
      onSuccess: onAuthorsChange,
    });
  const { handleSubmit: handleDeleteSubmit, register: registerDelete } =
    useForm<DeleteBlogAuthorFormValues>({
      defaultValues: {
        authorId: author.id,
      },
      resolver: zodResolver(deleteBlogAuthorFormSchema),
    });
  const submitUpdateForm = handleSubmit((values) => {
    updateAuthor({
      authorId: author.id,
      input: getUpdateBlogAuthorInput(values),
    });
  });
  const submitDeleteForm = handleDeleteSubmit((values) => {
    deleteAuthor(values.authorId);
  });

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <form className="grid gap-3 lg:grid-cols-2" onSubmit={submitUpdateForm}>
        <LabeledField label="Имя">
          <Input required {...register("name")} />
        </LabeledField>
        <LabeledField label="Slug">
          <Input required {...register("slug")} />
        </LabeledField>
        <LabeledField label="Роль">
          <Input {...register("role")} />
        </LabeledField>
        <LabeledField label="Аватар">
          <Input maxLength={40} {...register("avatar")} />
        </LabeledField>
        <LabeledField label="Фото URL">
          <Input {...register("image")} />
        </LabeledField>
        <LabeledField className="lg:row-span-2" label="Bio">
          <textarea className={textareaClassName} {...register("bio")} />
        </LabeledField>
        <div className="flex items-end">
          <Button
            aria-label={`Сохранить автора ${author.name}`}
            disabled={isUpdatingAuthor}
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
          Обновлен {formatBlogPostDate(author.updatedAt)}
        </span>
        <DeleteAuthorForm
          authorId={author.id}
          authorName={author.name}
          disabled={isDeletingAuthor}
          onSubmit={submitDeleteForm}
          register={registerDelete}
        />
      </div>
    </div>
  );
}

function DeleteAuthorForm({
  authorId,
  authorName,
  disabled,
  onSubmit,
  register,
}: {
  readonly authorId: string;
  readonly authorName: string;
  readonly disabled: boolean;
  readonly onSubmit: () => void;
  readonly register: UseFormRegister<DeleteBlogAuthorFormValues>;
}) {
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" value={authorId} {...register("authorId")} />
      <Button
        aria-label={`Удалить автора ${authorName}`}
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
