'use server';

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import {
  productHighlights,
  productHowItWorks,
  productSpecs,
} from "./products.data";
import type {
  ApiProductDTO,
  Product,
  ProductCategory,
  ProductsData,
} from "./products.types";

const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getProductsData(): Promise<ApiResultDTO<ProductsData>> {
  const result = await ApiResult.prepareApi(async () => {
    const products = mapProducts(
      await requestCatalogApi<ApiProductDTO[]>("/catalog/products"),
    );

    return {
      categories: getCategories(products),
      products,
      productSpecs,
      productHowItWorks,
      productHighlights,
    } satisfies ProductsData;
  }, {
    isEmptyCb: (data) => data.products.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<ProductsData>;
}

async function requestCatalogApi<T>(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as T;
}

function mapProducts(products: readonly ApiProductDTO[]): Product[] {
  return products.flatMap((product) => {
    if (!product.categoryId || !product.category) {
      return [];
    }

    const images = product.images.map((image) => image.url);
    const primaryImage = images[0] ?? product.category.image;

    if (!primaryImage) {
      return [];
    }

    return [
      {
        id: product.id,
        title: product.title,
        slug: product.slug,
        price: product.priceRub,
        category: product.category.title,
        categoryId: product.categoryId,
        categorySlug: product.category.slug,
        image: primaryImage,
        images: images.length > 0 ? images : [primaryImage],
        description: product.description ?? "",
        isHit: product.isHit,
      },
    ];
  });
}

function getCategories(products: readonly Product[]): ProductCategory[] {
  const categories = new Map<string, ProductCategory>();

  for (const product of products) {
    if (!categories.has(product.categoryId)) {
      categories.set(product.categoryId, {
        id: product.categoryId,
        title: product.category,
        slug: product.categorySlug,
        image: product.image,
      });
    }
  }

  return [...categories.values()].sort((a, b) => a.title.localeCompare(b.title, "ru-RU"));
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
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
