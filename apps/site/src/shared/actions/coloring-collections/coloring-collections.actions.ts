"use server";

import type { ZodType } from "zod";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import {
  publicColoringCollectionSchema,
  publicColoringCollectionsSchema,
} from "./coloring-collections.schemas";
import type {
  PublicColoringCollection,
  PublicColoringCollections,
} from "./coloring-collections.types";

const defaultApiBaseUrl = "http://localhost:3002";

class ColoringCollectionsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ColoringCollectionsApiError";
    this.status = status;
  }
}

export async function getPublicColoringCollections(): Promise<
  ApiResultDTO<PublicColoringCollections>
> {
  const result = await ApiResult.prepareApi(
    () => requestColoringCollectionsApi("/coloring-collections", publicColoringCollectionsSchema),
    { isEmptyCb: () => false },
  )();

  return withoutErrorStack(result.toDTO()) as ApiResultDTO<PublicColoringCollections>;
}

export async function getPublicColoringCollection(
  slug: string,
): Promise<ApiResultDTO<PublicColoringCollection>> {
  const result = await ApiResult.prepareApi(
    () =>
      requestColoringCollectionsApi(
        `/coloring-collections/${encodeURIComponent(slug)}`,
        publicColoringCollectionSchema,
      ),
    { isEmptyCb: () => false },
  )();

  return withoutErrorStack(result.toDTO()) as ApiResultDTO<PublicColoringCollection>;
}

async function requestColoringCollectionsApi<T>(path: string, schema: ZodType<T>) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { cache: "no-store" });

  if (!response.ok) {
    throw new ColoringCollectionsApiError(
      `Coloring collections API request failed with status ${response.status}`,
      response.status,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ColoringCollectionsApiError("Coloring collections API returned invalid JSON", 502);
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ColoringCollectionsApiError(
      "Coloring collections API returned an invalid response",
      502,
    );
  }

  return result.data;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

function withoutErrorStack<T>(dto: ApiResultDTO<T>): ApiResultDTO<T> {
  if (!dto.error) {
    return dto;
  }

  const error = { ...dto.error };
  delete error.stack;

  return { ...dto, error };
}
