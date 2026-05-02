import type { ProductStatus } from "@/entities/products";
import type {
  CreateProductCategoryInputDTO,
  CreateProductInputDTO,
  UpdateProductCategoryInputDTO,
  UpdateProductImageInputDTO,
  UpdateProductInputDTO,
} from "@/shared/actions/products";

export type ProductFormValues = {
  categoryId: string;
  description: string;
  isHit: boolean;
  priceRub: number;
  slug: string;
  status: ProductStatus;
  title: string;
};

export type ProductCategoryFormValues = {
  image: string;
  slug: string;
  title: string;
};

export type ProductImageCreateFormValues = {
  alt: string;
  file: FileList;
};

export type ProductImageUpdateFormValues = {
  alt: string;
  sortOrder?: number;
};

export function getProductDefaultValues({
  categoryId,
  description,
  isHit,
  priceRub,
  slug,
  status,
  title,
}: {
  readonly categoryId?: string;
  readonly description?: string;
  readonly isHit: boolean;
  readonly priceRub: number;
  readonly slug: string;
  readonly status: ProductStatus;
  readonly title: string;
}): ProductFormValues {
  return {
    categoryId: categoryId ?? "",
    description: description ?? "",
    isHit,
    priceRub,
    slug,
    status,
    title,
  };
}

export function getCreateProductInput(values: ProductFormValues): CreateProductInputDTO {
  return {
    categoryId: getOptionalText(values.categoryId),
    currency: "RUB",
    description: getOptionalText(values.description),
    isHit: values.isHit,
    priceRub: values.priceRub,
    slug: values.slug.trim(),
    status: values.status,
    title: values.title.trim(),
  };
}

export function getUpdateProductInput(values: ProductFormValues): UpdateProductInputDTO {
  return {
    categoryId: getNullableText(values.categoryId),
    currency: "RUB",
    description: values.description.trim(),
    isHit: values.isHit,
    priceRub: values.priceRub,
    slug: values.slug.trim(),
    status: values.status,
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

export function getRequiredString(value: FormDataEntryValue | null, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

export function getOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

export function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function getNullableString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

export function getBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

export function getRequiredInteger(value: FormDataEntryValue | null, field: string) {
  const parsed = Number(getRequiredString(value, field));

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }

  return parsed;
}

export function getOptionalInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("sortOrder must be a non-negative integer");
  }

  return parsed;
}

export function getProductStatus(value: FormDataEntryValue | null): ProductStatus {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }

  throw new Error("Invalid product status");
}

export function getRequiredFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    throw new Error("Product image file is required");
  }

  return value;
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
