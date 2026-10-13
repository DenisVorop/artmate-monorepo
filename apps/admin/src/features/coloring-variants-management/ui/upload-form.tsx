"use client";

import { Controller } from "react-hook-form";

import type { ColoringVariants } from "@/entities/coloring-variants";
import type { MaterialSetSummary } from "@/entities/material-sets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@/shared/ui";

import { useUploadState } from "../lib/upload-state";
import { getTargetStatus } from "../lib/publication-values";
import { PaletteFields } from "./palette-fields";

const fileFields = [
  {
    name: "outline",
    label: "Контуры",
    altName: "outlineAlt",
    altLabel: "Описание контурного изображения",
  },
  {
    name: "colored",
    label: "Цветной образец",
    altName: "imageAlt",
    altLabel: "Описание цветного изображения",
  },
] as const;

export function UploadForm({
  state,
  materialSets,
}: {
  readonly state: ColoringVariants;
  readonly materialSets: MaterialSetSummary[];
}) {
  const {
    form,
    target,
    rows,
    materialSet,
    isSetPending,
    isSetError,
    isPending,
    error,
    needsReload,
    replacement,
    confirmReplacement,
    cancelReplacement,
    selectTarget,
    submit,
  } = useUploadState(state);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;
  const original = target === "original";
  const status = getTargetStatus(state, target);
  const replacementTitle = original
    ? "Оригинал"
    : (materialSet?.title ?? "Адаптация");
  const targetExists = original
    ? Boolean(state.original)
    : state.variants.some((item) => item.materialSetId === target);
  const setUnavailable =
    !original &&
    (isSetPending || isSetError || !materialSet || materialSet.isArchived);
  return (
    <form className="grid gap-5" onSubmit={handleSubmit(submit)} noValidate>
      <fieldset
        className="grid gap-5"
        disabled={isPending || form.formState.isSubmitting || needsReload}
      >
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="variant-target">
            Что загрузить
          </label>
          <NativeSelect
            id="variant-target"
            className="w-full"
            value={target}
            onChange={(event) => selectTarget(event.target.value)}
          >
            <NativeSelectOption value="original">Оригинал</NativeSelectOption>
            {materialSets
              .filter((set) => !set.isArchived)
              .map((set) => (
                <NativeSelectOption
                  key={set.id}
                  value={set.id}
                  disabled={!state.original}
                >
                  {set.title}
                </NativeSelectOption>
              ))}
          </NativeSelect>
          {!state.original && (
            <p className="text-sm text-muted-foreground">
              Сначала загрузите оригинал, затем выберите набор для адаптации.
            </p>
          )}
          {targetExists && (
            <p className="text-sm text-muted-foreground">
              {status === "published"
                ? "Загрузка сразу заменит изображения и палитру в новом просмотрщике."
                : status === "archived"
                  ? "Этот вариант в архиве. Его нельзя заменить."
                  : "Загрузка заменит сохранённые изображения и палитру черновика."}
            </p>
          )}
          {errors.target && (
            <p role="alert" className="text-sm text-destructive">
              {errors.target.message}
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Нужны два изображения PNG или WebP одинакового размера, до 20 МБ
          каждое.
        </p>
        <p className="text-sm text-muted-foreground">
          Палитра на обоих изображениях должна соответствовать выбранному
          варианту. Для адаптации сохраните рисунок и обозначения оригинала.
        </p>
        <div key={target} className="grid gap-4 sm:grid-cols-2">
          {fileFields.map((item) => (
            <div className="grid content-start gap-3" key={item.name}>
              <label
                className="text-sm font-medium"
                htmlFor={`variant-${item.name}`}
              >
                {item.label}
              </label>
              <Controller
                control={control}
                name={item.name}
                render={({ field: { onChange, onBlur, name, ref } }) => (
                  <Input
                    id={`variant-${item.name}`}
                    name={name}
                    ref={ref}
                    type="file"
                    accept="image/png,image/webp,.png,.webp"
                    onBlur={onBlur}
                    onChange={(event) => onChange(event.target.files?.[0])}
                    aria-invalid={Boolean(errors[item.name])}
                    aria-describedby={
                      errors[item.name]
                        ? `variant-${item.name}-error`
                        : undefined
                    }
                  />
                )}
              />
              {errors[item.name] && (
                <p
                  id={`variant-${item.name}-error`}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors[item.name]?.message}
                </p>
              )}
              <label
                className="text-sm font-medium"
                htmlFor={`variant-${item.altName}`}
              >
                {item.altLabel}
              </label>
              <Input
                {...register(item.altName)}
                id={`variant-${item.altName}`}
                maxLength={220}
                aria-invalid={Boolean(errors[item.altName])}
                aria-describedby={
                  errors[item.altName]
                    ? `variant-${item.altName}-error`
                    : undefined
                }
              />
              {errors[item.altName] && (
                <p
                  id={`variant-${item.altName}-error`}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors[item.altName]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        {!original && isSetPending ? (
          <p role="status" className="text-sm">
            Загружаем цвета набора…
          </p>
        ) : !original && (isSetError || !materialSet) ? (
          <p role="alert" className="text-sm text-destructive">
            Не удалось загрузить цвета. Обновите страницу.
          </p>
        ) : !original && materialSet?.isArchived ? (
          <p role="alert" className="text-sm text-destructive">
            Набор в архиве. Выберите другой набор.
          </p>
        ) : (
          <PaletteFields
            form={form}
            rows={rows}
            original={original}
            lockSymbols={state.variants.length > 0}
            materialSet={materialSet}
          />
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {needsReload ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => window.location.reload()}
        >
          Обновить страницу
        </Button>
      ) : (
        <Button
          type="submit"
          className="w-fit"
          disabled={isPending || setUnavailable || status === "archived"}
        >
          {isPending
            ? "Сохраняем…"
            : targetExists
              ? "Заменить изображения и палитру"
              : "Загрузить изображения и палитру"}
        </Button>
      )}
      <AlertDialog
        open={Boolean(replacement)}
        onOpenChange={(open) => {
          if (!open) cancelReplacement();
        }}
      >
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Заменить опубликованный вариант «{replacementTitle}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Новые изображения и палитра сразу появятся в новом просмотрщике.
              Предыдущие файлы будут заменены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {replacement && (
            <div className="grid gap-2 text-sm break-all">
              <p>Контуры: {replacement.outline.name}</p>
              <p>Цветной образец: {replacement.colored.name}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmReplacement();
              }}
            >
              Заменить опубликованное
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
