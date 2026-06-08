"use server";

import { cookies, headers } from "next/headers";

import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  CatalogLandingPageDTO,
  CreateCatalogLandingPageInputDTO,
  UpdateCatalogLandingPageInputDTO,
} from "./catalog-landings.types";

const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getCatalogLandingPages(): Promise<CatalogLandingPageDTO[]> {
  return requestAdminApi<CatalogLandingPageDTO[]>("/catalog/admin/landings");
}

export async function getCatalogLandingPage(landingId: string): Promise<CatalogLandingPageDTO> {
  return requestAdminApi<CatalogLandingPageDTO>(
    `/catalog/admin/landings/${encodeURIComponent(landingId)}`,
  );
}

export async function createCatalogLandingPage(input: CreateCatalogLandingPageInputDTO) {
  return requestAdminApi<CatalogLandingPageDTO>("/catalog/admin/landings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCatalogLandingPage(
  landingId: string,
  input: UpdateCatalogLandingPageInputDTO,
) {
  return requestAdminApi<CatalogLandingPageDTO>(
    `/catalog/admin/landings/${encodeURIComponent(landingId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function publishCatalogLandingPage(landingId: string) {
  return requestAdminApi<CatalogLandingPageDTO>(
    `/catalog/admin/landings/${encodeURIComponent(landingId)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function deleteCatalogLandingPage(landingId: string) {
  return requestAdminApi<CatalogLandingPageDTO>(
    `/catalog/admin/landings/${encodeURIComponent(landingId)}`,
    {
      method: "DELETE",
    },
  );
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
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
      "content-type": "application/json",
      ...getForwardedIpHeaders(headerStore),
      ...init.headers,
      ...apiCsrfHeader,
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
