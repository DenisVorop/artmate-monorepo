"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp, Plus, Rocket } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Controller, useForm, useFormState } from "react-hook-form";

import { useColoringCollection } from "@/entities/coloring-collections";
import {
  formatColoringNumber,
  getNextAvailableColoringNumber,
  getNextColoringPosition,
  useColorings,
  type Coloring,
} from "@/entities/colorings";
import { useProducts, useTags, type ProductTag } from "@/entities/products";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Progress,
  Separator,
  Textarea,
} from "@/shared/ui";

import {
  collectionFormSchema,
  coloringFormSchema,
  coverFormSchema,
  createCollectionDefaultValues,
  getCollectionDefaultValues,
  getColoringDefaultValues,
  getCoverFormData,
  getCreateColoringInput,
  getUpdateCollectionInput,
  type CollectionFormValues,
  type ColoringFormValues,
  type CoverFormValues,
} from "../lib";
import {
  useCreateColoring,
  usePublishCollection,
  useUpdateCollection,
  useUploadCollectionCover,
} from "../model";
import { CollectionForm, Field } from "./collection-form";
import { StateCard, StatusBadge } from "./digital-versions-management";

type DigitalVersionDetailsProps = {
  readonly collectionId: string;
};

export function DigitalVersionDetails({ collectionId }: DigitalVersionDetailsProps) {
  const {
    collection,
    isError: isCollectionError,
    isPending: isCollectionPending,
  } = useColoringCollection({ collectionId });
  const { colorings, isError: isColoringsError, isPending: isColoringsPending } = useColorings();
  const { isError: isProductsError, isPending: isProductsPending, products } = useProducts();
  const { isError: isTagsError, isPending: isTagsPending, tags } = useTags();
  const collectionForm = useForm<CollectionFormValues>({
    defaultValues: collection
      ? getCollectionDefaultValues(collection)
      : createCollectionDefaultValues,
    resolver: zodResolver(collectionFormSchema),
  });
  const { dirtyFields: collectionDirtyFields } = useFormState({
    control: collectionForm.control,
  });
  const syncedCollectionVersion = useRef<string | undefined>(undefined);
  const { isPending: isUpdating, mutate: updateCollection } = useUpdateCollection({
    onSuccess: (updatedCollection) => {
      collectionForm.reset(getCollectionDefaultValues(updatedCollection));
    },
  });
  const { isPending: isPublishing, mutate: publishCollection } = usePublishCollection();

  useEffect(() => {
    if (collection) {
      const version = `${collection.id}:${collection.updatedAt}`;

      if (syncedCollectionVersion.current === version) {
        return;
      }

      syncedCollectionVersion.current = version;
      collectionForm.reset(getCollectionDefaultValues(collection), {
        keepDirtyValues: true,
      });
    }
  }, [collection, collectionDirtyFields, collectionForm]);

  if (isCollectionError || isColoringsError || isProductsError || isTagsError) {
    return <StateCard title="Не удалось загрузить цифровую версию" text="Перезагрузите страницу и повторите попытку." />;
  }

  if (
    isCollectionPending ||
    isColoringsPending ||
    isProductsPending ||
    isTagsPending ||
    !collection
  ) {
    return <StateCard title="Загрузка цифровой версии" text="Получаем метаданные, раскраски и теги." />;
  }

  const collectionColorings = colorings
    .filter((coloring) => coloring.collectionId === collectionId)
    .sort((first, second) => first.position - second.position);
  const progress = Math.min(
    100,
    Math.round((collection.coloringCount / collection.expectedColoringCount) * 100),
  );
  const isDraft = collection.status === "draft";

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div className="grid min-w-0 gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{collection.title}</CardTitle>
              <StatusBadge status={collection.status} />
            </div>
            <CardDescription>
              Товар: {collection.product.title} · /{collection.slug}
            </CardDescription>
          </div>
          <Button
            disabled={!isDraft || isPublishing}
            onClick={() => {
              if (!isPublishing) publishCollection(collection.id);
            }}
            type="button"
          >
            <Rocket data-icon="inline-start" aria-hidden="true" />
            {isPublishing ? "Публикуем..." : "Опубликовать"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span>Подготовлено: {collection.coloringCount} из {collection.expectedColoringCount}</span>
            <span>Опубликовано: {collection.publishedColoringCount}</span>
          </div>
          <Progress aria-label={`Готовность ${progress}%`} value={progress} />
          <p className="text-xs text-muted-foreground">Общая готовность: {progress}%</p>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Метаданные</CardTitle>
            <CardDescription>
              Товар нельзя заменить после создания коллекции.
              {!isDraft && " Опубликованные и архивные коллекции нельзя изменять."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionForm
              disableProduct
              form={collectionForm}
              formId={`digital-version-${collection.id}`}
              onSubmit={collectionForm.handleSubmit((values) => {
                if (!isUpdating && isDraft) {
                  updateCollection({
                    collectionId: collection.id,
                    input: getUpdateCollectionInput(
                      values,
                      collection.updatedAt,
                    ),
                  });
                }
              })}
              products={products}
              submitDisabled={!isDraft}
              submitLabel={isDraft ? "Сохранить метаданные" : "Метаданные зафиксированы"}
              submitPending={isUpdating}
            />
          </CardContent>
        </Card>

        <CoverForm
          collectionId={collection.id}
          currentAlt={collection.cover?.alt ?? collection.title}
          currentCover={collection.cover}
          updatedAt={collection.updatedAt}
          disabled={!isDraft}
        />
      </div>

      <ColoringsSection
        collectionId={collection.id}
        colorings={collectionColorings}
        disabled={collection.status === "archived"}
        expectedColoringCount={collection.expectedColoringCount}
        tags={tags.filter((tag) => tag.group === "theme")}
      />
    </div>
  );
}

type CoverFormProps = {
  readonly collectionId: string;
  readonly currentAlt: string;
  readonly currentCover?: {
    readonly alt: string;
    readonly height: number;
    readonly url: string;
    readonly width: number;
  };
  readonly disabled: boolean;
  readonly updatedAt: string;
};

function CoverForm({
  collectionId,
  currentAlt,
  currentCover,
  disabled,
  updatedAt,
}: CoverFormProps) {
  const form = useForm<CoverFormValues>({
    defaultValues: { alt: currentAlt },
    resolver: zodResolver(coverFormSchema),
  });
  const isAltDirty = Boolean(form.formState.dirtyFields.alt);
  const { isPending, mutate: uploadCover } = useUploadCollectionCover({
    onSuccess: (collection) => form.reset({ alt: collection.cover?.alt ?? collection.title }),
  });

  useEffect(() => {
    if (!isAltDirty) {
      form.resetField("alt", { defaultValue: currentAlt });
    }
  }, [currentAlt, form, isAltDirty]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Обложка</CardTitle>
        <CardDescription>JPEG, PNG или WebP, не более 10 МиБ.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
          {currentCover ? (
            // The storage host is dynamic, so Next Image cannot safely optimize this URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={currentCover.alt}
              className="size-full object-cover"
              height={currentCover.height}
              src={currentCover.url}
              width={currentCover.width}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              Обложка не загружена
            </div>
          )}
        </div>
        <form
          className="grid gap-4"
          encType="multipart/form-data"
          onSubmit={form.handleSubmit((values) => {
            if (!isPending && !disabled) {
              uploadCover({
                collectionId,
                formData: getCoverFormData(values, updatedAt),
              });
            }
          })}
        >
          <Field error={form.formState.errors.file?.message} label="Файл">
            <Controller
              control={form.control}
              name="file"
              render={({ field: { name, onBlur, onChange, ref } }) => (
                <Input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={disabled || isPending}
                  name={name}
                  onBlur={onBlur}
                  onChange={(event) => onChange(event.target.files?.[0])}
                  ref={ref}
                  type="file"
                />
              )}
            />
          </Field>
          <Field error={form.formState.errors.alt?.message} label="Alt-текст">
            <Input disabled={disabled || isPending} {...form.register("alt")} />
          </Field>
          <Button disabled={disabled || isPending} type="submit" variant="outline">
            <ImageUp data-icon="inline-start" aria-hidden="true" />
            {isPending ? "Загружаем..." : "Загрузить обложку"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type ColoringsSectionProps = {
  readonly collectionId: string;
  readonly colorings: readonly Coloring[];
  readonly disabled: boolean;
  readonly expectedColoringCount: number;
  readonly tags: readonly ProductTag[];
};

function ColoringsSection({
  collectionId,
  colorings,
  disabled,
  expectedColoringCount,
  tags,
}: ColoringsSectionProps) {
  const nextNumber = getNextAvailableColoringNumber(
    colorings,
    expectedColoringCount,
  );
  const nextPosition = getNextColoringPosition(colorings);
  const isFull = nextNumber === undefined;
  const form = useForm<ColoringFormValues>({
    defaultValues: getColoringDefaultValues(collectionId, nextPosition),
    resolver: zodResolver(coloringFormSchema),
  });
  const { isPending, mutate: createColoring } = useCreateColoring({
    onSuccess: (createdColoring) => {
      const updatedColorings = colorings.some(
        ({ id }) => id === createdColoring.id,
      )
        ? colorings
        : [...colorings, createdColoring];

      form.reset(
        getColoringDefaultValues(
          collectionId,
          getNextColoringPosition(updatedColorings),
        ),
      );
    },
  });
  const formDisabled = disabled || isPending || isFull;

  useEffect(() => {
    if (!form.formState.isDirty) {
      form.reset(getColoringDefaultValues(collectionId, nextPosition));
    }
  }, [collectionId, form, nextPosition]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Раскраски</CardTitle>
        <CardDescription>
          {colorings.length} раскрасок в этой цифровой версии.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form
          className="grid gap-4 rounded-lg border p-4"
          onSubmit={form.handleSubmit((values) => {
            if (!formDisabled) createColoring(getCreateColoringInput(values));
          })}
        >
          <input type="hidden" {...form.register("collectionId")} />
          <div className="flex items-center gap-2">
            <Plus className="size-4" aria-hidden="true" />
            <h3 className="font-medium">Новая раскраска</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            {isFull ? (
              <span>
                Все номера от 1 до {expectedColoringCount} уже заняты.
              </span>
            ) : (
              <>
                <span className="text-muted-foreground">
                  Предполагаемый следующий номер:
                </span>
                <Badge variant="secondary">
                  Картина {formatColoringNumber(nextNumber)}
                </Badge>
              </>
            )}
          </div>
          <Field error={form.formState.errors.title?.message} label="Название">
            <Input disabled={formDisabled} {...form.register("title")} />
          </Field>
          <Field error={form.formState.errors.description?.message} label="Описание">
            <Textarea disabled={formDisabled} rows={3} {...form.register("description")} />
          </Field>
          <Field error={form.formState.errors.position?.message} label="Позиция">
            <Input
              className="max-w-40"
              disabled={formDisabled}
              min={0}
              step={1}
              type="number"
              {...form.register("position", { valueAsNumber: true })}
            />
          </Field>
          <fieldset className="grid gap-2" disabled={formDisabled}>
            <legend className="text-sm font-medium">Темы</legend>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Теги группы theme пока не созданы.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" value={tag.id} {...form.register("themeTagIds")} />
                    {tag.title}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div>
            <Button disabled={formDisabled} type="submit">
              <Plus data-icon="inline-start" aria-hidden="true" />
              {isPending ? "Создаём..." : "Создать раскраску"}
            </Button>
          </div>
        </form>

        <Separator />

        {colorings.length === 0 ? (
          <p className="text-sm text-muted-foreground">В коллекции пока нет раскрасок.</p>
        ) : (
          <div className="grid gap-2">
            {colorings.map((coloring) => (
              <Link
                key={coloring.id}
                className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                href={routes.digitalVersionColoring(collectionId, coloring.id)}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{coloring.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Картина {formatColoringNumber(coloring.number)} · позиция{" "}
                    {coloring.position}
                  </p>
                </div>
                <Badge variant={coloring.status === "published" ? "default" : "secondary"}>
                  {coloring.status === "published"
                    ? "Опубликовано"
                    : coloring.status === "archived"
                      ? "В архиве"
                      : "Черновик"}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
