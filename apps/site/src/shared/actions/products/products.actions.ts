"use server";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import { productHighlights, productHowItWorks, productSpecs } from "./products.data";
import type { ApiProductDTO, Product, ProductCategory, ProductsData } from "./products.types";

const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getProductsData(): Promise<ApiResultDTO<ProductsData>> {
  const result = await ApiResult.prepareApi(
    async () => {
      const apiProducts = await requestCatalogApi<ApiProductDTO[]>("/catalog/products");
      const products = mapProducts(apiProducts);

      return {
        categories: getCategories(apiProducts, products),
        products,
        productSpecs,
        productHowItWorks,
        productHighlights,
      } satisfies ProductsData;
    },
    {
      isEmptyCb: (data) => data.products.length === 0,
    },
  )();

  return result.toDTO() as ApiResultDTO<ProductsData>;
}

async function requestCatalogApi<T>(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    next: {
      revalidate: 300,
      tags: ["catalog-products"],
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as T;
}

function mapProducts(products: readonly ApiProductDTO[]): Product[] {
  return products.flatMap((product) => {
    const images = product.images.map((image) => image.url);
    const primaryImage = images[0] ?? product.category?.image;

    if (!primaryImage) {
      return [];
    }

    return [
      {
        id: product.id,
        title: product.title,
        slug: product.slug,
        price: product.priceRub,
        category: product.category?.title,
        categoryId: product.categoryId,
        categorySlug: product.category?.slug,
        image: primaryImage,
        images: images.length > 0 ? images : [primaryImage],
        description: product.description ?? "",
        isHit: product.isHit,
        isOutOfStock: product.isOutOfStock,
        digitalCollection: product.digitalCollection,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        tags: product.tags.map((tag) => ({
          id: tag.id,
          slug: tag.slug,
          title: tag.title,
          group: tag.group,
        })),
      },
    ];
  });
}

function getCategories(
  apiProducts: readonly ApiProductDTO[],
  products: readonly Product[],
): ProductCategory[] {
  const categories = new Map<string, ProductCategory>();
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const apiProduct of apiProducts) {
    const product = productsById.get(apiProduct.id);
    const category = apiProduct.category;

    if (!product || !category) {
      continue;
    }

    if (!categories.has(category.id)) {
      categories.set(category.id, {
        id: category.id,
        title: category.title,
        slug: category.slug,
        image: product.image,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
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
