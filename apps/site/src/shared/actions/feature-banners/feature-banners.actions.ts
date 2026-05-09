"use server";

import { cookies, headers } from "next/headers";

import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type { FeatureBannerDTO } from "./feature-banners.types";

const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getFeatureBanners(): Promise<ApiResultDTO<FeatureBannerDTO[]>> {
  const result = await ApiResult.prepareApi(async () =>
    requestApi<FeatureBannerDTO[]>("/feature-banners"),
  )();

  return result.toDTO() as ApiResultDTO<FeatureBannerDTO[]>;
}

async function requestApi<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(AUTH_ACCESS_TOKEN_COOKIE_NAME)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(accessToken
        ? {
            cookie: `${AUTH_ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
          }
        : {}),
      ...getForwardedIpHeaders(headerStore),
      ...init.headers,
      ...apiCsrfHeader,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function getErrorMessage(response: Response) {
  const fallback = `Feature banners API request failed with status ${response.status}`;

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
