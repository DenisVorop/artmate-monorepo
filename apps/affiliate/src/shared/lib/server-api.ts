import "server-only";

import { cookies, headers } from "next/headers";

import { apiCsrfHeader, getForwardedIpHeaders } from "./api-security";
import { ApiError } from "./api-error";
import { authAccessTokenCookieName } from "./auth-cookie";

const defaultApiBaseUrl = "http://localhost:3002";

export async function requestApi<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const response = await fetch(
    `${process.env.API_BASE_URL ?? defaultApiBaseUrl}${path}`,
    {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(accessToken
          ? {
              cookie: `${authAccessTokenCookieName}=${encodeURIComponent(accessToken)}`,
            }
          : {}),
        ...getForwardedIpHeaders(headerStore),
        ...init.headers,
        ...apiCsrfHeader,
      },
    },
  );

  if (!response.ok) {
    throw new ApiError(response.status, await getErrorMessage(response));
  }

  return {
    data: (await response.json()) as T,
    response,
  };
}

async function getErrorMessage(response: Response) {
  const fallback = `API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: unknown;
      retryAfterSeconds?: unknown;
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;

    if (typeof message !== "string") {
      return fallback;
    }

    const retryAfterSeconds =
      typeof body.retryAfterSeconds === "number" &&
      Number.isFinite(body.retryAfterSeconds)
        ? Math.max(1, Math.ceil(body.retryAfterSeconds))
        : undefined;

    return retryAfterSeconds
      ? `${message}. Retry after ${retryAfterSeconds} seconds`
      : message;
  } catch {
    return fallback;
  }
}
