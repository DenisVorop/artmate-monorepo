"use client";

import { materialKindLabels } from "@/entities/material-sets";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@/shared/ui";

import { useImportState } from "../lib/import-state";
import { ImportPreview } from "./preview";

const textFields = [
  {
    name: "title",
    label: "Название набора",
    placeholder: "Набор маркеров, 48 цветов",
    maxLength: 160,
  },
  {
    name: "brand",
    label: "Бренд",
    placeholder: "Название производителя",
    maxLength: 120,
  },
  {
    name: "line",
    label: "Серия (необязательно)",
    placeholder: "Название серии",
    maxLength: 120,
  },
  {
    name: "slug",
    label: "Идентификатор",
    placeholder: "brand-markers-48",
    maxLength: 160,
  },
] as const;

export function ImportForm() {
  const {
    form,
    preview,
    message,
    success,
    fileInputRef,
    isReadingFile,
    isPreviewPending,
    isImportPending,
    readFile,
    check,
    create,
  } = useImportState();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;
  const isBusy = isReadingFile || isPreviewPending || isImportPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый набор</CardTitle>
        <CardDescription>
          Загрузите цвета и проверьте их перед добавлением. Существующие наборы
          останутся без изменений.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={handleSubmit(check)} noValidate>
          <fieldset
            className="grid gap-4 sm:grid-cols-2"
            disabled={isImportPending}
          >
            {textFields.map((field) => (
              <div className="grid gap-2" key={field.name}>
                <label
                  htmlFor={`material-${field.name}`}
                  className="text-sm font-medium"
                >
                  {field.label}
                </label>
                <Input
                  {...register(field.name)}
                  id={`material-${field.name}`}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  aria-invalid={Boolean(errors[field.name])}
                  aria-describedby={
                    errors[field.name]
                      ? `material-${field.name}-error`
                      : undefined
                  }
                />
                {errors[field.name] && (
                  <p
                    id={`material-${field.name}-error`}
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors[field.name]?.message}
                  </p>
                )}
              </div>
            ))}
            <div className="grid gap-2">
              <label htmlFor="material-kind" className="text-sm font-medium">
                Материалы
              </label>
              <NativeSelect
                {...register("kind")}
                id="material-kind"
                className="w-full"
              >
                {Object.entries(materialKindLabels).map(([kind, label]) => (
                  <NativeSelectOption key={kind} value={kind}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label htmlFor="material-file" className="text-sm font-medium">
                Файл с цветами
              </label>
              <Input
                ref={fileInputRef}
                id="material-file"
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={(event) => void readFile(event.target.files?.[0])}
                aria-invalid={Boolean(errors.source)}
                aria-describedby="material-file-help material-file-error"
              />
              <input type="hidden" {...register("source")} />
              <p
                id="material-file-help"
                className="text-sm text-muted-foreground"
              >
                CSV в UTF-8: до 50 КБ и 1000 цветов. Обязательные столбцы — code
                и hex; name и pantone можно оставить пустыми. Разделитель —
                запятая, точка с запятой или табуляция. Сохраняйте коды как
                текст, чтобы не потерять нули в начале.
              </p>
              <a
                className="w-fit text-sm underline underline-offset-4"
                href="/templates/material-set.csv"
                download
              >
                Скачать шаблон CSV
              </a>
              <p
                id="material-file-error"
                className="text-sm text-destructive"
                role={errors.source ? "alert" : undefined}
              >
                {errors.source?.message}
              </p>
            </div>
          </fieldset>
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          {success && (
            <p role="status" className="text-sm">
              {success}
            </p>
          )}
          {preview && <ImportPreview preview={preview} />}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="outline" disabled={isBusy}>
              {isReadingFile
                ? "Читаем файл…"
                : isPreviewPending
                  ? "Проверяем…"
                  : "Проверить данные"}
            </Button>
            {preview?.canImport && (
              <Button
                type="button"
                onClick={() => void create()}
                disabled={isBusy}
              >
                {isImportPending ? "Добавляем…" : "Добавить набор"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
