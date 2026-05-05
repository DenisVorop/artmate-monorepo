"use server";

import { cookies, headers } from "next/headers";

import type {
  AiBlogDraftRunDTO,
  StartAiBlogDraftRunInputDTO,
} from "./content-assistant.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

export async function getAiBlogDraftRuns(): Promise<AiBlogDraftRunDTO[]> {
  return requestAdminApi<AiBlogDraftRunDTO[]>(
    "/content-assistant/admin/blog-draft-runs",
  );
}

export async function startAiBlogDraftRun(
  input: StartAiBlogDraftRunInputDTO,
): Promise<AiBlogDraftRunDTO> {
  return requestAdminApi<AiBlogDraftRunDTO>(
    "/content-assistant/admin/blog-draft-runs",
    {
      body: JSON.stringify(input),
      method: "POST",
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

async function requestAdmin<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(accessToken
        ? {
            cookie: `${authAccessTokenCookieName}=${encodeURIComponent(accessToken)}`,
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
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
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
  const fallback = `Content assistant API request failed with status ${response.status}`;

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
