"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { routes } from "@/shared/constants";

import type {
  CreateProductCategoryInputDTO,
  CreateProductInputDTO,
  ProductCategoryDTO,
  ProductDTO,
  ProductImageDTO,
  ProductStatusDTO,
  UpdateProductCategoryInputDTO,
  UpdateProductImageInputDTO,
  UpdateProductInputDTO,
} from "./products.types";

const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getAdminProducts(): Promise<ProductDTO[]> {
  return requestAdminApi<ProductDTO[]>("/products");
}

export async function getProductCategories(): Promise<ProductCategoryDTO[]> {
  return requestAdminApi<ProductCategoryDTO[]>("/products/categories");
}

export async function createProductCategory(
  input: CreateProductCategoryInputDTO,
) {
  return requestAdminApi<ProductCategoryDTO>("/products/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProductCategory(
  categoryId: string,
  input: UpdateProductCategoryInputDTO,
) {
  return requestAdminApi<ProductCategoryDTO>(
    `/products/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteProductCategory(categoryId: string) {
  return requestAdminApi<ProductCategoryDTO>(
    `/products/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function createProduct(input: CreateProductInputDTO) {
  return requestAdminApi<ProductDTO>("/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInputDTO,
) {
  return requestAdminApi<ProductDTO>(
    `/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteProduct(productId: string) {
  return requestAdminApi<ProductDTO>(
    `/products/${encodeURIComponent(productId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function updateProductImage(
  productId: string,
  imageId: string,
  input: UpdateProductImageInputDTO,
) {
  return requestAdminApi<ProductImageDTO>(
    `/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteProductImage(productId: string, imageId: string) {
  return requestAdminApi<ProductImageDTO>(
    `/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function createProductAction(formData: FormData) {
  await createProduct({
    title: getRequiredString(formData.get("title"), "title"),
    slug: getRequiredString(formData.get("slug"), "slug"),
    description: getOptionalString(formData.get("description")),
    status: getProductStatus(formData.get("status")),
    isHit: getBoolean(formData.get("isHit")),
    categoryId: getRequiredString(formData.get("categoryId"), "categoryId"),
    priceRub: getRequiredInteger(formData.get("priceRub"), "priceRub"),
    currency: "RUB",
  });

  revalidatePath(routes.products);
}

export async function updateProductAction(formData: FormData) {
  const productId = getRequiredString(formData.get("productId"), "productId");

  await updateProduct(productId, {
    title: getRequiredString(formData.get("title"), "title"),
    slug: getRequiredString(formData.get("slug"), "slug"),
    description: getString(formData.get("description")),
    status: getProductStatus(formData.get("status")),
    isHit: getBoolean(formData.get("isHit")),
    categoryId: getRequiredString(formData.get("categoryId"), "categoryId"),
    priceRub: getRequiredInteger(formData.get("priceRub"), "priceRub"),
    currency: "RUB",
  });

  revalidatePath(routes.products);
}

export async function deleteProductAction(formData: FormData) {
  await deleteProduct(getRequiredString(formData.get("productId"), "productId"));
  revalidatePath(routes.products);
}

export async function createProductCategoryAction(formData: FormData) {
  await createProductCategory({
    title: getRequiredString(formData.get("title"), "title"),
    slug: getRequiredString(formData.get("slug"), "slug"),
    image: getOptionalString(formData.get("image")),
  });

  revalidatePath(routes.products);
}

export async function updateProductCategoryAction(formData: FormData) {
  const categoryId = getRequiredString(formData.get("categoryId"), "categoryId");

  await updateProductCategory(categoryId, {
    title: getRequiredString(formData.get("title"), "title"),
    slug: getRequiredString(formData.get("slug"), "slug"),
    image: getString(formData.get("image")),
  });

  revalidatePath(routes.products);
}

export async function deleteProductCategoryAction(formData: FormData) {
  await deleteProductCategory(
    getRequiredString(formData.get("categoryId"), "categoryId"),
  );
  revalidatePath(routes.products);
}

export async function addProductImageAction(formData: FormData) {
  const productId = getRequiredString(formData.get("productId"), "productId");
  const file = getRequiredFile(formData.get("file"));
  const uploadFormData = new FormData();
  const alt = getOptionalString(formData.get("alt"));

  uploadFormData.set("file", file);

  if (alt) {
    uploadFormData.set("alt", alt);
  }

  await requestAdminFormData<ProductImageDTO>(
    `/products/${encodeURIComponent(productId)}/images`,
    uploadFormData,
  );

  revalidatePath(routes.products);
}

export async function updateProductImageAction(formData: FormData) {
  const productId = getRequiredString(formData.get("productId"), "productId");
  const imageId = getRequiredString(formData.get("imageId"), "imageId");

  await updateProductImage(productId, imageId, {
    alt: getString(formData.get("alt")),
    sortOrder: getOptionalInteger(formData.get("sortOrder")),
  });

  revalidatePath(routes.products);
}

export async function deleteProductImageAction(formData: FormData) {
  const productId = getRequiredString(formData.get("productId"), "productId");
  const imageId = getRequiredString(formData.get("imageId"), "imageId");

  await deleteProductImage(productId, imageId);
  revalidatePath(routes.products);
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
  return requestAdmin<T>(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

async function requestAdminFormData<T>(path: string, body: FormData) {
  return requestAdmin<T>(path, {
    method: "POST",
    body,
  });
}

async function requestAdmin<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(AUTH_ACCESS_TOKEN_COOKIE_NAME)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(accessToken
        ? {
            cookie: `${AUTH_ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
          }
        : {}),
      ...getForwardedIpHeaders(headerStore),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as T;
}

function getRequiredString(value: FormDataEntryValue | null, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function getOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function getRequiredInteger(value: FormDataEntryValue | null, field: string) {
  const parsed = Number(getRequiredString(value, field));

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }

  return parsed;
}

function getOptionalInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("sortOrder must be a non-negative integer");
  }

  return parsed;
}

function getProductStatus(value: FormDataEntryValue | null): ProductStatusDTO {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }

  throw new Error("Invalid product status");
}

function getRequiredFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    throw new Error("Product image file is required");
  }

  return value;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function getForwardedIpHeaders(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp =
    headerStore.get("x-real-ip") ??
    headerStore.get("cf-connecting-ip") ??
    headerStore.get("true-client-ip");

  return {
    ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    ...(realIp ? { "x-real-ip": realIp } : {}),
  };
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Products API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: unknown;
    };

    if (typeof body.message === "string") {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
  } catch {
    return fallback;
  }

  return fallback;
}
