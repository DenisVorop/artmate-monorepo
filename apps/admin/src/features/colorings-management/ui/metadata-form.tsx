"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { Save } from "lucide-react";

import type { ColoringCollection } from "@/entities/coloring-collections";
import {
  formatColoringNumber,
  maxColoringNumber,
  type Coloring,
} from "@/entities/colorings";
import type { ProductTag } from "@/entities/products";
import { routes } from "@/shared/constants";
import { Button, Input, Textarea } from "@/shared/ui";

import {
  getColoringMetadataSchema,
  getColoringMetadataValues,
  getUpdateColoringInput,
  type ColoringMetadataValues,
} from "../lib";
import { useUpdateColoring } from "../model";
import { fieldClassName, FormField } from "./form-field";

export function MetadataForm({
  collections,
  coloring,
  colorings,
  disabled: parentDisabled,
  themeTags,
}: {
  readonly collections: readonly ColoringCollection[];
  readonly coloring: Coloring;
  readonly colorings: readonly Coloring[];
  readonly disabled?: boolean;
  readonly themeTags: readonly ProductTag[];
}) {
  const router = useRouter();
  const metadataSchema = useMemo(
    () =>
      getColoringMetadataSchema({
        collections,
        coloringId: coloring.id,
        colorings,
      }),
    [collections, coloring.id, colorings],
  );
  const form = useForm<ColoringMetadataValues>({
    defaultValues: getColoringMetadataValues(coloring),
    resolver: zodResolver(metadataSchema),
  });
  const { dirtyFields } = useFormState({ control: form.control });
  const syncedColoringVersion = useRef<string | undefined>(undefined);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = form;
  const { isPending, mutate } = useUpdateColoring({
    onSuccess: (updatedColoring) => {
      reset(getColoringMetadataValues(updatedColoring));

      if (updatedColoring.collectionId !== coloring.collectionId) {
        router.replace(
          routes.digitalVersionColoring(
            updatedColoring.collectionId,
            updatedColoring.id,
          ),
        );
      }
    },
  });
  const disabled = parentDisabled || coloring.status !== "draft";
  const selectedCollectionId = useWatch({
    control: form.control,
    name: "collectionId",
  });
  const selectedNumber = useWatch({
    control: form.control,
    name: "number",
  });
  const selectedCollection = collections.find(
    ({ id }) => id === selectedCollectionId,
  );
  const selectedNumberMax = Math.min(
    maxColoringNumber,
    selectedCollection?.expectedColoringCount ?? maxColoringNumber,
  );
  const formattedSelectedNumber = Number.isInteger(selectedNumber)
    ? formatColoringNumber(selectedNumber)
    : "—";
  const collectionOptions = collections.filter(
    (collection) =>
      collection.status !== "archived" ||
      collection.id === coloring.collectionId,
  );

  useEffect(() => {
    const version = `${coloring.id}:${coloring.updatedAt}`;

    if (syncedColoringVersion.current === version) {
      return;
    }

    syncedColoringVersion.current = version;
    reset(getColoringMetadataValues(coloring), { keepDirtyValues: true });
  }, [coloring, dirtyFields, reset]);

  return (
    <form
      className="grid gap-5"
      onSubmit={handleSubmit(
        (values) =>
          !disabled &&
          mutate({
            coloringId: coloring.id,
            input: getUpdateColoringInput(values, coloring.updatedAt),
          }),
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormField error={errors.title?.message} label="Название">
          <Input disabled={disabled || isPending} {...register("title")} />
        </FormField>
        <FormField error={errors.collectionId?.message} label="Коллекция">
          <select
            className={fieldClassName}
            disabled={disabled || isPending}
            {...register("collectionId")}
          >
            <option value="">Выберите коллекцию</option>
            {collectionOptions.map((collection) => (
              <option
                disabled={collection.status === "archived"}
                key={collection.id}
                value={collection.id}
              >
                {collection.title} · {collection.product.title}
              </option>
            ))}
          </select>
        </FormField>
        <FormField error={errors.number?.message} label="Номер в URL">
          <Input
            disabled={disabled || isPending}
            max={selectedNumberMax}
            min={1}
            step={1}
            type="number"
            {...register("number", { valueAsNumber: true })}
          />
        </FormField>
        <FormField error={errors.position?.message} label="Позиция">
          <Input
            disabled={disabled || isPending}
            min={0}
            type="number"
            {...register("position", { valueAsNumber: true })}
          />
        </FormField>
      </div>
      <p className="text-sm text-muted-foreground">
        Публичный адрес после публикации:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
          /raskraski/digital/{selectedCollection?.slug ?? "…"}/
          {formattedSelectedNumber}
        </code>
      </p>
      <FormField error={errors.description?.message} label="Описание">
        <Textarea
          disabled={disabled || isPending}
          rows={5}
          {...register("description")}
        />
      </FormField>
      <fieldset className="grid gap-2" disabled={disabled || isPending}>
        <legend className="mb-1 text-sm font-medium">Тематические теги</legend>
        {themeTags.length ? (
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
            {themeTags.map((tag) => (
              <label className="flex items-center gap-2 text-sm" key={tag.id}>
                <input
                  type="checkbox"
                  value={tag.id}
                  {...register("themeTagIds")}
                />
                <span>{tag.title}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Тематические теги товаров пока не созданы.
          </p>
        )}
      </fieldset>
      <div>
        <Button disabled={disabled || isPending} type="submit">
          <Save data-icon="inline-start" aria-hidden="true" />
          {disabled
            ? "Метаданные зафиксированы"
            : isPending
              ? "Сохраняем..."
              : "Сохранить метаданные"}
        </Button>
      </div>
    </form>
  );
}
