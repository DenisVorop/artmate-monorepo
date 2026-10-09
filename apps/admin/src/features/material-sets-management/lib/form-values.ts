import { z } from "zod";

import type { MaterialSetImportInputDTO } from "@/shared/actions/material-sets";

export const maxSourceBytes = 50_000;

export const importSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Укажите название")
    .max(160, "Не более 160 символов"),
  slug: z
    .string()
    .trim()
    .min(1, "Укажите идентификатор")
    .max(160, "Не более 160 символов")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Используйте строчные латинские буквы, цифры и дефисы между словами",
    ),
  brand: z
    .string()
    .trim()
    .min(1, "Укажите бренд")
    .max(120, "Не более 120 символов"),
  line: z.string().trim().max(120, "Не более 120 символов"),
  kind: z.enum(["MARKER", "PENCIL", "PAINT", "OTHER"]),
  source: z
    .string()
    .min(1, "Выберите файл с цветами")
    .max(maxSourceBytes, "Файл должен быть не больше 50 КБ")
    .refine(
      (source) => new TextEncoder().encode(source).byteLength <= maxSourceBytes,
      "Файл должен быть не больше 50 КБ",
    ),
});

export type ImportFormValues = z.infer<typeof importSchema>;

export const defaultValues: ImportFormValues = {
  title: "",
  slug: "",
  brand: "",
  line: "",
  kind: "MARKER",
  source: "",
};

export function buildImportInput(
  values: ImportFormValues,
): MaterialSetImportInputDTO {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    brand: values.brand.trim(),
    ...(values.line.trim() ? { line: values.line.trim() } : {}),
    kind: values.kind,
    source: values.source,
  };
}

export function getImportError(status?: number) {
  if (status === 401 || status === 403)
    return "Не удалось подтвердить доступ. Обновите страницу и войдите снова.";
  if (status === 409)
    return "Набор с таким идентификатором уже существует. Проверьте список ниже. Для другого набора выберите новый идентификатор.";
  if (status === 400)
    return "Данные не прошли проверку. Проверьте поля и файл, затем повторите предварительную проверку.";
  if (status === 413)
    return "Файл слишком большой. Загрузите файл не больше 50 КБ.";
  return "Не удалось получить ответ. Повторите предварительную проверку. Если набор уже добавлен, проверка сообщит об этом.";
}
