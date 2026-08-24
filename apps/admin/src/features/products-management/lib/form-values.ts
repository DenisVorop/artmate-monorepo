import { z } from "zod";

import {
  productStatuses,
  productTagGroups,
  type ProductStatusDTO,
  type ProductTagGroupDTO,
} from "@/shared/actions/products";
import type {
  CreateProductCategoryInputDTO,
  CreateProductInputDTO,
  CreateProductTagInputDTO,
  UpdateProductCategoryInputDTO,
  UpdateProductImageInputDTO,
  UpdateProductInputDTO,
  UpdateProductTagInputDTO,
} from "@/shared/actions/products";

const requiredTextSchema = (message: string) => z.string().trim().min(1, message);
const optionalTextSchema = z.string().trim();

export const productFormSchema = z.object({
  categoryId: optionalTextSchema,
  description: optionalTextSchema,
  isHit: z.boolean(),
  isOutOfStock: z.boolean(),
  isOzonDeliveryAvailable: z.boolean(),
  priceRub: z.number().finite("Укажите цену").min(0, "Цена не может быть отрицательной"),
  slug: requiredTextSchema("Укажите slug"),
  status: z.enum(productStatuses),
  tagIds: z.array(z.string()),
  title: requiredTextSchema("Укажите название"),
});

export const productCategoryFormSchema = z.object({
  image: optionalTextSchema,
  slug: requiredTextSchema("Укажите slug"),
  title: requiredTextSchema("Укажите название"),
});

export const productTagFormSchema = z.object({
  group: z.enum(productTagGroups),
  slug: requiredTextSchema("Укажите slug"),
  title: requiredTextSchema("Укажите название"),
});

export const productImageCreateFormSchema = z.object({
  alt: optionalTextSchema,
  file: z.custom<FileList>(
    (value) =>
      typeof FileList !== "undefined" &&
      value instanceof FileList &&
      Boolean(value.item(0)) &&
      (value.item(0)?.size ?? 0) > 0,
    "Выберите изображение",
  ),
});

export const productImageUpdateFormSchema = z.object({
  alt: optionalTextSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const deleteProductFormSchema = z.object({
  productId: requiredTextSchema("Не указан товар"),
});

export const deleteCategoryFormSchema = z.object({
  categoryId: requiredTextSchema("Не указана категория"),
});

export const deleteProductImageFormSchema = z.object({
  imageId: requiredTextSchema("Не указано изображение"),
  productId: requiredTextSchema("Не указан товар"),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export type ProductCategoryFormValues = z.infer<typeof productCategoryFormSchema>;

export type ProductTagFormValues = z.infer<typeof productTagFormSchema>;

export type ProductImageCreateFormValues = z.infer<typeof productImageCreateFormSchema>;

export type ProductImageUpdateFormValues = z.infer<typeof productImageUpdateFormSchema>;

export type DeleteProductFormValues = z.infer<typeof deleteProductFormSchema>;

export type DeleteCategoryFormValues = z.infer<typeof deleteCategoryFormSchema>;

export type DeleteProductImageFormValues = z.infer<typeof deleteProductImageFormSchema>;

export const createProductDefaultValues = {
  categoryId: "",
  description: "",
  isHit: false,
  isOutOfStock: false,
  isOzonDeliveryAvailable: true,
  priceRub: 0,
  slug: "",
  status: "draft",
  tagIds: [],
  title: "",
} satisfies ProductFormValues;

export const createProductCategoryDefaultValues = {
  image: "",
  slug: "",
  title: "",
} satisfies ProductCategoryFormValues;

export const createProductTagDefaultValues = {
  group: "theme",
  slug: "",
  title: "",
} satisfies ProductTagFormValues;

export const createProductImageDefaultValues = {
  alt: "",
} satisfies Partial<ProductImageCreateFormValues>;

export function getProductDefaultValues({
  categoryId,
  description,
  isHit,
  isOutOfStock,
  isOzonDeliveryAvailable,
  priceRub,
  slug,
  status,
  tags,
  title,
}: {
  readonly categoryId?: string;
  readonly description?: string;
  readonly isHit: boolean;
  readonly isOutOfStock: boolean;
  readonly isOzonDeliveryAvailable: boolean;
  readonly priceRub: number;
  readonly slug: string;
  readonly status: ProductStatusDTO;
  readonly tags?: readonly {
    readonly id: string;
  }[];
  readonly title: string;
}): ProductFormValues {
  return {
    categoryId: categoryId ?? "",
    description: description ?? "",
    isHit,
    isOutOfStock,
    isOzonDeliveryAvailable,
    priceRub,
    slug,
    status,
    tagIds: tags?.map((tag) => tag.id) ?? [],
    title,
  };
}

export function getCreateProductInput(values: ProductFormValues): CreateProductInputDTO {
  return {
    categoryId: getOptionalText(values.categoryId),
    currency: "RUB",
    description: getOptionalText(values.description),
    isHit: values.isHit,
    isOutOfStock: values.isOutOfStock,
    isOzonDeliveryAvailable: values.isOzonDeliveryAvailable,
    priceRub: values.priceRub,
    slug: values.slug.trim(),
    status: values.status,
    tagIds: values.tagIds,
    title: values.title.trim(),
  };
}

export function getUpdateProductInput(values: ProductFormValues): UpdateProductInputDTO {
  return {
    categoryId: getNullableText(values.categoryId),
    currency: "RUB",
    description: values.description.trim(),
    isHit: values.isHit,
    isOutOfStock: values.isOutOfStock,
    isOzonDeliveryAvailable: values.isOzonDeliveryAvailable,
    priceRub: values.priceRub,
    slug: values.slug.trim(),
    status: values.status,
    tagIds: values.tagIds,
    title: values.title.trim(),
  };
}

export function getCreateCategoryInput(
  values: ProductCategoryFormValues,
): CreateProductCategoryInputDTO {
  return {
    image: getOptionalText(values.image),
    slug: values.slug.trim(),
    title: values.title.trim(),
  };
}

export function getUpdateCategoryInput(
  values: ProductCategoryFormValues,
): UpdateProductCategoryInputDTO {
  return {
    image: values.image.trim(),
    slug: values.slug.trim(),
    title: values.title.trim(),
  };
}

export function getCreateTagInput(values: ProductTagFormValues): CreateProductTagInputDTO {
  return {
    group: values.group,
    slug: values.slug.trim(),
    title: values.title.trim(),
  };
}

export function getUpdateTagInput(values: ProductTagFormValues): UpdateProductTagInputDTO {
  return getCreateTagInput(values);
}

export function getProductTagDefaultValues({
  group,
  slug,
  title,
}: {
  readonly group: ProductTagGroupDTO;
  readonly slug: string;
  readonly title: string;
}): ProductTagFormValues {
  return {
    group,
    slug,
    title,
  };
}

export function getCreateProductImageFormData(values: ProductImageCreateFormValues) {
  const formData = new FormData();
  const alt = getOptionalText(values.alt);

  formData.set("file", getFileFromList(values.file));

  if (alt) {
    formData.set("alt", alt);
  }

  return formData;
}

export function getUpdateProductImageInput(
  values: ProductImageUpdateFormValues,
): UpdateProductImageInputDTO {
  return {
    alt: values.alt.trim(),
    sortOrder: values.sortOrder,
  };
}

export function getCategoryProductsCount(
  products: readonly { readonly categoryId?: string }[],
  categoryId: string,
) {
  return products.filter((product) => product.categoryId === categoryId).length;
}

function getOptionalText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function getNullableText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function getFileFromList(value: FileList) {
  const file = value.item(0);

  if (!file || file.size === 0) {
    throw new Error("Product image file is required");
  }

  return file;
}
