"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Rocket, Save, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

import type { Product, ProductCategory } from "@/entities/products";
import type { SeoEntry } from "@/entities/seo";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  TooltipProvider,
} from "@/shared/ui";

import {
  createSeoEntryDefaultValues,
  getCreateSeoEntryInput,
  getPublishSeoEntryInput,
  getSeoEntryDefaultValues,
  getUpdateSeoEntryInput,
  seoEntryFormSchema,
  type SeoEntryFormValues,
  type SeoRefreshCallback,
} from "../lib";
import {
  useCreateSeoEntry,
  useDeleteSeoEntry,
  usePublishSeoEntry,
  useUpdateSeoEntry,
} from "../model";
import {
  CategorySelect,
  LabeledCheckbox,
  LabeledField,
  ProductSelect,
  SourceKindSelect,
  textareaClassName,
} from "./form-controls";

type SeoEntryFormProps = {
  readonly categories: readonly ProductCategory[];
  readonly entry?: SeoEntry;
  readonly onDeleted?: () => void;
  readonly onSaved: SeoRefreshCallback;
  readonly products: readonly Product[];
};

const fieldDescriptions = {
  alias: "Произвольный ключ в source JSON для группировки, поиска или внешней привязки записи.",
  canonical:
    "Канонический URL страницы. Можно использовать шаблоны, например {{site.url}}{{path}}.",
  category:
    "Категория, данные которой доступны в шаблонах как {{category.title}}, {{category.slug}} и {{category.image}}.",
  comment:
    "Комментарий к snapshot: зачем создан черновик, публикация или откат.",
  description:
    "Meta description для поисковой выдачи. Можно использовать Mustache-шаблоны.",
  follow:
    "Разрешает поисковикам переходить по ссылкам на странице. Выключение даст nofollow.",
  index:
    "Разрешает индексацию страницы. Выключение даст noindex.",
  keywords:
    "Meta keywords. Введите ключевые фразы через запятую, они сохранятся массивом.",
  ogDescription:
    "Описание превью для соцсетей и мессенджеров.",
  ogImage:
    "Абсолютный URL изображения для Open Graph. Если пусто у категории, может подставиться image категории.",
  ogImageAlt:
    "Альтернативное описание изображения Open Graph.",
  ogTitle:
    "Заголовок превью для соцсетей и мессенджеров.",
  path:
    "Путь страницы на сайте, по которому сайт ищет опубликованное SEO, например /catalog.",
  product:
    "Товар, данные которого доступны в шаблонах как {{product.title}}, {{product.priceRub}} и {{product.image}}.",
  source:
    "Тип источника данных для шаблонов: обычная страница, товар, категория или custom source.",
  title:
    "Основной title страницы. Можно использовать Mustache-шаблоны, например {{product.title}} - Artmate.",
} as const;

export function SeoEntryForm({
  categories,
  entry,
  onDeleted,
  onSaved,
  products,
}: SeoEntryFormProps) {
  const isEditMode = Boolean(entry);
  const defaultValues = useMemo(
    () => (entry ? getSeoEntryDefaultValues(entry) : createSeoEntryDefaultValues),
    [entry],
  );
  const { handleSubmit, register, reset } = useForm<SeoEntryFormValues>({
    defaultValues,
    resolver: zodResolver(seoEntryFormSchema),
  });
  const { isPending: isCreatingEntry, mutate: createEntry } = useCreateSeoEntry({
    onSuccess: async () => {
      reset(createSeoEntryDefaultValues);
      await onSaved();
    },
  });
  const { isPending: isUpdatingEntry, mutate: updateEntry } = useUpdateSeoEntry({
    onSuccess: onSaved,
  });
  const { isPending: isPublishingEntry, mutate: publishEntry } =
    usePublishSeoEntry({
      onSuccess: onSaved,
    });
  const { isPending: isDeletingEntry, mutate: deleteEntry } = useDeleteSeoEntry({
    onSuccess: async () => {
      onDeleted?.();
      await onSaved();
    },
  });
  const isSaving =
    isCreatingEntry || isUpdatingEntry || isPublishingEntry || isDeletingEntry;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const submitDraft = handleSubmit((values) => {
    if (entry) {
      updateEntry({
        entryId: entry.id,
        input: getUpdateSeoEntryInput(values, products, categories),
      });

      return;
    }

    createEntry(getCreateSeoEntryInput(values, products, categories));
  });
  const submitPublish = handleSubmit((values) => {
    if (!entry) {
      return;
    }

    publishEntry({
      entryId: entry.id,
      input: getPublishSeoEntryInput(values),
    });
  });

  return (
    <Card className="min-w-0 overflow-visible">
      <CardHeader>
        <CardTitle>{isEditMode ? "SEO запись" : "Новая SEO запись"}</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <form className="grid min-w-0 gap-4" onSubmit={submitDraft}>
            <div className="grid gap-3 2xl:grid-cols-[minmax(12rem,1.2fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)]">
              <LabeledField description={fieldDescriptions.path} label="Path">
                <Input required placeholder="/catalog" {...register("path")} />
              </LabeledField>
              <LabeledField
                description={fieldDescriptions.source}
                label="Источник"
              >
                <SourceKindSelect
                  defaultValue={defaultValues.sourceKind}
                  selectProps={register("sourceKind")}
                />
              </LabeledField>
              <LabeledField description={fieldDescriptions.alias} label="Alias">
                <Input placeholder="catalog-main" {...register("alias")} />
              </LabeledField>
            </div>

            <div className="grid gap-3 2xl:grid-cols-2">
              <LabeledField description={fieldDescriptions.product} label="Товар">
                <ProductSelect
                  defaultValue={defaultValues.productId}
                  products={products}
                  selectProps={register("productId")}
                />
              </LabeledField>
              <LabeledField
                description={fieldDescriptions.category}
                label="Категория"
              >
                <CategorySelect
                  categories={categories}
                  defaultValue={defaultValues.categoryId}
                  selectProps={register("categoryId")}
                />
              </LabeledField>
            </div>

            <div className="grid gap-3 2xl:grid-cols-2">
              <LabeledField description={fieldDescriptions.title} label="Title">
                <Input {...register("title")} />
              </LabeledField>
              <LabeledField
                description={fieldDescriptions.canonical}
                label="Canonical"
              >
                <Input placeholder="{{path}}" {...register("canonical")} />
              </LabeledField>
            </div>

            <LabeledField
              description={fieldDescriptions.description}
              label="Description"
            >
              <textarea className={textareaClassName} {...register("description")} />
            </LabeledField>

            <LabeledField description={fieldDescriptions.keywords} label="Keywords">
              <Input placeholder="через запятую" {...register("keywords")} />
            </LabeledField>

            <div className="grid gap-3 2xl:grid-cols-2">
              <LabeledField description={fieldDescriptions.ogTitle} label="OG title">
                <Input {...register("ogTitle")} />
              </LabeledField>
              <LabeledField
                description={fieldDescriptions.ogDescription}
                label="OG description"
              >
                <Input {...register("ogDescription")} />
              </LabeledField>
              <LabeledField description={fieldDescriptions.ogImage} label="OG image">
                <Input placeholder="https://..." {...register("ogImage")} />
              </LabeledField>
              <LabeledField
                description={fieldDescriptions.ogImageAlt}
                label="OG image alt"
              >
                <Input {...register("ogImageAlt")} />
              </LabeledField>
            </div>

            <div className="grid gap-3 2xl:grid-cols-[8rem_8rem_minmax(10rem,1fr)]">
              <LabeledCheckbox description={fieldDescriptions.index} label="Index">
                <input type="checkbox" {...register("robotsIndex")} />
              </LabeledCheckbox>
              <LabeledCheckbox description={fieldDescriptions.follow} label="Follow">
                <input type="checkbox" {...register("robotsFollow")} />
              </LabeledCheckbox>
              <LabeledField
                description={fieldDescriptions.comment}
                label="Комментарий"
              >
                <Input {...register("comment")} />
              </LabeledField>
            </div>

            <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur sm:flex-row sm:flex-wrap sm:justify-end">
              {entry ? (
                <>
                  <Button
                    disabled={isSaving}
                    onClick={submitPublish}
                    type="button"
                    variant="outline"
                  >
                    <Rocket data-icon="inline-start" aria-hidden="true" />
                    Опубликовать
                  </Button>
                  <Button
                    disabled={isSaving}
                    onClick={() => deleteEntry(entry.id)}
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 data-icon="inline-start" aria-hidden="true" />
                    Удалить
                  </Button>
                </>
              ) : null}
              <Button disabled={isSaving} type="submit">
                {entry ? (
                  <Save data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <Eye data-icon="inline-start" aria-hidden="true" />
                )}
                {entry ? "Сохранить черновик" : "Создать черновик"}
              </Button>
            </div>
          </form>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
