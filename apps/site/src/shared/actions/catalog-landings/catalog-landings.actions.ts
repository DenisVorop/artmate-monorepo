"use server";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type { ApiCatalogLandingPageDTO, CatalogLandingPage } from "./catalog-landings.types";

const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getCatalogLandingPages(): Promise<ApiResultDTO<CatalogLandingPage[]>> {
  const result = await ApiResult.prepareApi(async () => {
    const landings = await requestCatalogApi<ApiCatalogLandingPageDTO[]>("/catalog/landings");

    return landings.map(mapCatalogLanding);
  })();

  return result.toDTO() as ApiResultDTO<CatalogLandingPage[]>;
}

export async function getCatalogLandingPage(
  slug: string,
): Promise<ApiResultDTO<CatalogLandingPage>> {
  const result = await ApiResult.prepareApi(async () => {
    const landing = await requestCatalogApi<ApiCatalogLandingPageDTO>(
      `/catalog/landings/${encodeURIComponent(slug)}`,
    );

    return mapCatalogLanding(landing);
  })();

  return result.toDTO() as ApiResultDTO<CatalogLandingPage>;
}

async function requestCatalogApi<T>(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    next: {
      revalidate: 300,
      tags: ["catalog-landings"],
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as T;
}

function mapCatalogLanding(landing: ApiCatalogLandingPageDTO): CatalogLandingPage {
  return {
    id: landing.id,
    slug: landing.slug,
    status: landing.status,
    isIndexable: landing.isIndexable,
    h1: landing.h1,
    metaTitle: landing.metaTitle,
    metaDescription: landing.metaDescription,
    introHtml: landing.introHtml,
    seoTitle: landing.seoTitle,
    seoHtml: landing.seoHtml,
    productSource: landing.productSource,
    minProducts: landing.minProducts,
    faqItems: landing.faqItems.map((item) => ({
      id: item.id,
      question: item.question,
      answerHtml: item.answerHtml,
      sortOrder: item.sortOrder,
    })),
    products: landing.products.flatMap((product) => {
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
    }),
    createdAt: landing.createdAt,
    updatedAt: landing.updatedAt,
  };
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Catalog landings API request failed with status ${response.status}`;

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
