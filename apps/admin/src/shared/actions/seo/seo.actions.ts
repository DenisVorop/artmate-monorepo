"use server";

import { cookies, headers } from "next/headers";

import type {
  CreateSeoEntryInputDTO,
  PublishSeoEntryInputDTO,
  RollbackSeoEntryInputDTO,
  SeoEntryDTO,
  SeoSnapshotDTO,
  UpdateSeoEntryInputDTO,
} from "./seo.types";

const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getSeoEntries(): Promise<SeoEntryDTO[]> {
  return requestAdminApi<SeoEntryDTO[]>("/seo/admin/entries");
}

export async function getSeoSnapshots(entryId: string): Promise<SeoSnapshotDTO[]> {
  return requestAdminApi<SeoSnapshotDTO[]>(
    `/seo/admin/entries/${encodeURIComponent(entryId)}/snapshots`,
  );
}

export async function createSeoEntry(input: CreateSeoEntryInputDTO) {
  return requestAdminApi<SeoEntryDTO>("/seo/admin/entries", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateSeoEntry(entryId: string, input: UpdateSeoEntryInputDTO) {
  return requestAdminApi<SeoEntryDTO>(
    `/seo/admin/entries/${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function publishSeoEntry(entryId: string, input: PublishSeoEntryInputDTO) {
  return requestAdminApi<SeoEntryDTO>(
    `/seo/admin/entries/${encodeURIComponent(entryId)}/publish`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function rollbackSeoEntry(entryId: string, input: RollbackSeoEntryInputDTO) {
  return requestAdminApi<SeoEntryDTO>(
    `/seo/admin/entries/${encodeURIComponent(entryId)}/rollback`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteSeoEntry(entryId: string) {
  return requestAdminApi<SeoEntryDTO>(
    `/seo/admin/entries/${encodeURIComponent(entryId)}`,
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
      "content-type": "application/json",
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
  const fallback = `SEO API request failed with status ${response.status}`;

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
