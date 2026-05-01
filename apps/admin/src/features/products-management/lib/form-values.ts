import type { ProductStatus } from "@/entities/products";

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
