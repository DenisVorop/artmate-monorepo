"use server";

import { cookies, headers } from "next/headers";

import type {
  CreateProductCategoryInputDTO,
  CreateProductInputDTO,
  ProductCategoryDTO,
  ProductDTO,
  ProductImageDTO,
  UpdateProductCategoryInputDTO,
  UpdateProductImageInputDTO,
  UpdateProductInputDTO,
} from "./products.types";

const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getAdminProducts(): Promise<ProductDTO[]> {
  return requestAdminApi<ProductDTO[]>("/products");
}

export async function getAdminProduct(productId: string): Promise<ProductDTO> {
  return requestAdminApi<ProductDTO>(
    `/products/${encodeURIComponent(productId)}`,
  );
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

export async function addProductImage(productId: string, formData: FormData) {
  return requestAdminFormData<ProductImageDTO>(
    `/products/${encodeURIComponent(productId)}/images`,
    formData,
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
