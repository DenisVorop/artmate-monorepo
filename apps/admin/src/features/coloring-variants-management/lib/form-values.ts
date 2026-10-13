import { z } from "zod";

import type { ColoringVariants } from "@/entities/coloring-variants";

export const symbols = "123456789ABCDEFGHIJ".split("");
export const maxImageBytes = 20 * 1024 * 1024;

const imageSchema = z
  .custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "Выберите изображение",
  )
  .superRefine((file, context) => {
    if (!(typeof File !== "undefined" && file instanceof File)) return;
    if (!["image/png", "image/webp"].includes(file.type))
      context.addIssue({
        code: "custom",
        message: "Выберите изображение PNG или WebP",
      });
    if (file.size === 0 || file.size > maxImageBytes)
      context.addIssue({
        code: "custom",
        message: "Изображение должно быть непустым и не больше 20 МБ",
      });
  });

const baseSchema = z.object({
  target: z.string().min(1, "Выберите набор"),
  expectedToken: z.string().min(1),
  outline: imageSchema,
  colored: imageSchema,
  outlineAlt: z
    .string()
    .trim()
    .min(1, "Опишите контурное изображение")
    .max(220, "Не более 220 символов"),
  imageAlt: z
    .string()
    .trim()
    .min(1, "Опишите цветное изображение")
    .max(220, "Не более 220 символов"),
  palette: z
    .array(
      z.object({
        symbolPosition: z.number().int().min(1).max(19),
        enabled: z.boolean(),
        hex: z.string(),
        materialColorId: z.string(),
      }),
    )
    .min(1)
    .max(19),
});

export type UploadFormValues = z.infer<typeof baseSchema>;

export function createUploadSchema(state: ColoringVariants) {
  return baseSchema.superRefine((values, context) => {
    const active = values.palette.filter((row) => row.enabled);
    const positions = active.map((row) => row.symbolPosition);
    const originalPositions =
      state.original?.palette.map((row) => row.symbolPosition) ?? [];
    if (!active.length)
      context.addIssue({
        code: "custom",
        path: ["palette", "root"],
        message: "Выберите хотя бы одно обозначение",
      });
    if (new Set(positions).size !== positions.length)
      context.addIssue({
        code: "custom",
        path: ["palette", "root"],
        message: "Каждое обозначение должно встречаться один раз",
      });
    if (values.target !== "original" && !state.original)
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "Сначала загрузите оригинал",
      });
    if (
      (values.target !== "original" || state.variants.length > 0) &&
      (positions.length !== originalPositions.length ||
        positions.some((position) => !originalPositions.includes(position)))
    ) {
      context.addIssue({
        code: "custom",
        path: ["palette", "root"],
        message: "Сохраните все обозначения оригинала",
      });
    }
    values.palette.forEach((row, index) => {
      if (!row.enabled) return;
      if (values.target === "original" && !/^#[0-9a-f]{6}$/i.test(row.hex))
        context.addIssue({
          code: "custom",
          path: ["palette", index, "hex"],
          message: "Введите цвет в формате #AABBCC",
        });
      if (values.target !== "original" && !row.materialColorId)
        context.addIssue({
          code: "custom",
          path: ["palette", index, "materialColorId"],
          message: "Выберите цвет набора",
        });
    });
  });
}

export function createUploadDefaults(
  state: ColoringVariants,
  target = "original",
) {
  const original = state.original?.palette ?? [];
  const variant = state.variants.find((item) => item.materialSetId === target);
  return {
    target,
    expectedToken: state.token,
    outlineAlt: "",
    imageAlt: "",
    palette: symbols.map((_, index) => {
      const symbolPosition = index + 1;
      const source = original.find(
        (row) => row.symbolPosition === symbolPosition,
      );
      return {
        symbolPosition,
        enabled: Boolean(source),
        hex: source?.hex ?? "",
        materialColorId:
          variant?.palette.find((row) => row.symbolPosition === symbolPosition)
            ?.materialColorId ?? "",
      };
    }),
  };
}

export function buildUploadFormData(values: UploadFormValues) {
  const palette = values.palette
    .filter((row) => row.enabled)
    .map((row) =>
      values.target === "original"
        ? { symbolPosition: row.symbolPosition, hex: row.hex.toUpperCase() }
        : {
            symbolPosition: row.symbolPosition,
            materialColorId: row.materialColorId,
          },
    );
  const data = new FormData();
  data.set("target", values.target);
  data.set("expectedToken", values.expectedToken);
  data.set("outline", values.outline);
  data.set("colored", values.colored);
  data.set("outlineAlt", values.outlineAlt.trim());
  data.set("imageAlt", values.imageAlt.trim());
  data.set("palette", JSON.stringify(palette));
  return data;
}

export function getUploadError(code?: string, status?: number) {
  const messages: Record<string, string> = {
    STALE_UPLOAD: "Картинка уже изменена. Обновите страницу перед загрузкой.",
    OUTLINE_IN_USE:
      "Проверьте размеры изображений и соответствие контуров оригиналу.",
    SYMBOLS_IN_USE:
      "Обозначения используются в других вариантах. Сохраните прежний список обозначений.",
    VARIANT_ARCHIVED: "Этот вариант в архиве. Его нельзя заменить.",
    COLORING_ARCHIVED: "Раскраска или альбом в архиве. Загрузка недоступна.",
    MATERIAL_SET_ARCHIVED: "Набор материалов в архиве. Выберите другой набор.",
    ORIGINAL_REQUIRED:
      "Сначала загрузите оригинал, затем добавьте адаптацию для набора.",
    PALETTE_INVALID:
      "Проверьте обозначения и цвета палитры. Для адаптации нужны все обозначения оригинала.",
    MATERIAL_COLOR_INVALID:
      "Один из цветов недоступен в выбранном наборе. Обновите страницу и выберите цвет снова.",
    IMAGE_INVALID:
      "Не удалось обработать изображения. Проверьте, что оба файла имеют формат PNG или WebP и одинаковые размеры.",
  };
  if (code && messages[code]) return messages[code];
  if (status === 401 || status === 403)
    return "Загрузка недоступна. Обновите страницу и войдите снова.";
  if (status === 413)
    return "Файлы слишком большие. Каждый файл должен быть не больше 20 МБ.";
  if (status === 409)
    return "Данные изменились. Обновите страницу перед загрузкой.";
  if (status === 400)
    return "Не удалось сохранить изображения. Проверьте файлы, описания и палитру.";
  return "Не удалось получить ответ о сохранении. Обновите страницу и проверьте загруженные изображения перед повторной попыткой.";
}
