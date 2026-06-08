"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useForm } from "react-hook-form";

import {
  getProductTagGroupLabel,
  useTags,
  type ProductTag,
} from "@/entities/products";
import { productTagGroups } from "@/shared/actions/products";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

import {
  createProductTagDefaultValues,
  getCreateTagInput,
  getProductTagDefaultValues,
  getUpdateTagInput,
  productTagFormSchema,
  type ProductTagFormValues,
} from "../lib";
import {
  useCreateProductTag,
  useDeleteProductTag,
  useUpdateProductTag,
} from "../model";
import { fieldClassName, LabeledField } from "./form-controls";

export function ProductTagsManagement() {
  const { isError, isPending, refetch, tags } = useTags();
  const refreshTags = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить теги</CardTitle>
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
          <CardTitle>Загрузка тегов</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем справочник признаков товаров.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <CreateProductTagCard onTagsChange={refreshTags} />
      <ProductTagsList onTagsChange={refreshTags} tags={tags} />
    </div>
  );
}

function CreateProductTagCard({ onTagsChange }: { readonly onTagsChange: () => void }) {
  const { handleSubmit, register, reset } = useForm<ProductTagFormValues>({
    defaultValues: createProductTagDefaultValues,
    resolver: zodResolver(productTagFormSchema),
  });
  const { isPending: isCreatingTag, mutate: createTag } = useCreateProductTag({
    onSuccess: onTagsChange,
  });
  const submitForm = handleSubmit((values) => {
    createTag(getCreateTagInput(values), {
      onSuccess: () => reset(createProductTagDefaultValues),
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый тег</CardTitle>
        <CardDescription>Признаки товара для SEO-подборок каталога.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_12rem_auto]"
          onSubmit={submitForm}
        >
          <LabeledField label="Название">
            <Input required {...register("title")} />
          </LabeledField>
          <LabeledField label="Slug">
            <Input required {...register("slug")} />
          </LabeledField>
          <LabeledField label="Группа">
            <select className={fieldClassName} {...register("group")}>
              {productTagGroups.map((group) => (
                <option key={group} value={group}>
                  {getProductTagGroupLabel(group)}
                </option>
              ))}
            </select>
          </LabeledField>
          <div className="flex items-end">
            <Button className="w-full" disabled={isCreatingTag} type="submit">
              Создать
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProductTagsList({
  onTagsChange,
  tags,
}: {
  readonly onTagsChange: () => void;
  readonly tags: readonly ProductTag[];
}) {
  if (tags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Тегов пока нет</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Добавьте первый тег, чтобы назначать его товарам и использовать в подборках.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Теги товаров</CardTitle>
        <CardDescription>Редактирование справочника признаков.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Группа</TableHead>
              <TableHead className="w-28 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((tag) => (
              <ProductTagRow key={tag.id} onTagsChange={onTagsChange} tag={tag} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ProductTagRow({
  onTagsChange,
  tag,
}: {
  readonly onTagsChange: () => void;
  readonly tag: ProductTag;
}) {
  const { handleSubmit, register } = useForm<ProductTagFormValues>({
    defaultValues: getProductTagDefaultValues(tag),
    resolver: zodResolver(productTagFormSchema),
  });
  const { isPending: isUpdatingTag, mutate: updateTag } = useUpdateProductTag({
    onSuccess: onTagsChange,
  });
  const { isPending: isDeletingTag, mutate: deleteTag } = useDeleteProductTag({
    onSuccess: onTagsChange,
  });
  const submitForm = handleSubmit((values) => {
    updateTag({
      input: getUpdateTagInput(values),
      tagId: tag.id,
    });
  });

  return (
    <TableRow>
      <TableCell>
        <form id={`product-tag-${tag.id}`} onSubmit={submitForm} />
        <Input form={`product-tag-${tag.id}`} required {...register("title")} />
      </TableCell>
      <TableCell>
        <Input form={`product-tag-${tag.id}`} required {...register("slug")} />
      </TableCell>
      <TableCell>
        <select className={fieldClassName} form={`product-tag-${tag.id}`} {...register("group")}>
          {productTagGroups.map((group) => (
            <option key={group} value={group}>
              {getProductTagGroupLabel(group)}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            aria-label={`Сохранить тег ${tag.title}`}
            disabled={isUpdatingTag}
            form={`product-tag-${tag.id}`}
            size="icon-sm"
            type="submit"
            variant="outline"
          >
            <Save aria-hidden="true" />
          </Button>
          <Button
            aria-label={`Удалить тег ${tag.title}`}
            disabled={isDeletingTag}
            onClick={() => deleteTag(tag.id)}
            size="icon-sm"
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
