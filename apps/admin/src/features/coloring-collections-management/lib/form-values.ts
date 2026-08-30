import { z } from "zod";

import type { ColoringCollection } from "@/entities/coloring-collections";
import type {
  CreateColoringCollectionInputDTO,
  CreateColoringInputDTO,
  UpdateColoringCollectionInputDTO,
} from "@/shared/actions/colorings";

const slugSchema = z
  .string()
  .trim()
  .min(1, "Укажите slug")
  .max(180, "Максимум 180 символов")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Используйте строчные латинские буквы, цифры и дефисы");
const titleSchema = z.string().trim().min(1, "Укажите название").max(220);
const descriptionSchema = z.string().trim().max(12_000, "Максимум 12 000 символов");
const positionSchema = z.number().int("Укажите целое число").min(0).max(2_147_483_647);

export const collectionFormSchema = z.object({
  description: descriptionSchema,
  expectedColoringCount: z.number().int().min(1, "Минимум 1").max(99, "Максимум 99"),
  position: positionSchema,
  productId: z.string().min(1, "Выберите товар"),
  slug: slugSchema,
  title: titleSchema,
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

export const createCollectionDefaultValues = {
  description: "",
  expectedColoringCount: 25,
  position: 0,
  productId: "",
  slug: "",
  title: "",
} satisfies CollectionFormValues;

export function getCollectionDefaultValues(
  collection: ColoringCollection,
): CollectionFormValues {
  return {
    description: collection.description ?? "",
    expectedColoringCount: collection.expectedColoringCount,
    position: collection.position,
    productId: collection.productId,
    slug: collection.slug,
    title: collection.title,
  };
}

export function getCreateCollectionInput(
  values: CollectionFormValues,
): CreateColoringCollectionInputDTO {
  return {
    expectedColoringCount: values.expectedColoringCount,
    position: values.position,
    productId: values.productId,
    slug: values.slug.trim(),
    title: values.title.trim(),
    ...(values.description.trim()
      ? { description: values.description.trim() }
      : {}),
  };
}

export function getUpdateCollectionInput(
  values: CollectionFormValues,
  updatedAt: string,
): UpdateColoringCollectionInputDTO {
  return { ...getCollectionMetadataInput(values), updatedAt };
}

function getCollectionMetadataInput(values: CollectionFormValues) {
  return {
    description: values.description.trim() || null,
    expectedColoringCount: values.expectedColoringCount,
    position: values.position,
    slug: values.slug.trim(),
    title: values.title.trim(),
  };
}

const coverFileSchema = z.custom<File>(
  (value) =>
    typeof File !== "undefined" &&
    value instanceof File &&
    ["image/jpeg", "image/png", "image/webp"].includes(value.type) &&
    value.size <= 10 * 1024 * 1024,
  "Выберите JPEG, PNG или WebP размером не более 10 МиБ",
);

export const coverFormSchema = z.object({
  alt: z.string().trim().min(1, "Укажите alt-текст").max(220),
  file: coverFileSchema,
});

export type CoverFormValues = z.infer<typeof coverFormSchema>;

export function getCoverFormData(values: CoverFormValues, updatedAt: string) {
  const formData = new FormData();
  formData.set("cover", values.file);
  formData.set("alt", values.alt.trim());
  formData.set("updatedAt", updatedAt);
  return formData;
}

export const coloringFormSchema = z.object({
  collectionId: z.string().min(1),
  description: descriptionSchema,
  position: positionSchema,
  themeTagIds: z.array(z.string()),
  title: titleSchema,
});

export type ColoringFormValues = z.infer<typeof coloringFormSchema>;

export function getColoringDefaultValues(
  collectionId: string,
  position = 0,
): ColoringFormValues {
  return {
    collectionId,
    description: "",
    position,
    themeTagIds: [],
    title: "",
  };
}

export function getCreateColoringInput(values: ColoringFormValues): CreateColoringInputDTO {
  return {
    collectionId: values.collectionId,
    description: values.description.trim() || null,
    position: values.position,
    themeTagIds: values.themeTagIds,
    title: values.title.trim(),
  };
}
