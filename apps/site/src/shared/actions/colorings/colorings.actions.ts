"use server";

import type { ZodType } from "zod";

import { formatColoringNumber } from "@/shared/constants";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import { publicColoringSchema, publicColoringsManifestSchema } from "./colorings.schemas";
import type { PublicColoring, PublicColoringManifest } from "./colorings.types";

const defaultApiBaseUrl = "http://localhost:3002";

class ColoringApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ColoringApiError";
    this.status = status;
  }
}

export async function getPublicColoring(
  collectionSlug: string,
  number: number,
): Promise<ApiResultDTO<PublicColoring>> {
  const result = await ApiResult.prepareApi(
    () =>
      requestColoringsApi(
        `/colorings/${encodeURIComponent(collectionSlug)}/${formatColoringNumber(number)}`,
        publicColoringSchema,
      ),
    { isEmptyCb: () => false },
  )();

  return withoutErrorStack(result.toDTO()) as ApiResultDTO<PublicColoring>;
}

export async function getPublicColoringsManifest(): Promise<ApiResultDTO<PublicColoringManifest>> {
  const result = await ApiResult.prepareApi(
    () => requestColoringsApi("/colorings", publicColoringsManifestSchema),
    { isEmptyCb: () => false },
  )();

  return withoutErrorStack(result.toDTO()) as ApiResultDTO<PublicColoringManifest>;
}

async function requestColoringsApi<T>(path: string, schema: ZodType<T>) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { cache: "no-store" });

  if (!response.ok) {
    throw new ColoringApiError(
      `Colorings API request failed with status ${response.status}`,
      response.status,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ColoringApiError("Colorings API returned invalid JSON", 502);
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ColoringApiError("Colorings API returned an invalid response", 502);
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
