import "server-only";

import { cookies, headers } from "next/headers";

import { apiCsrfHeader, getForwardedIpHeaders } from "./api-security";
import { ApiError, getApiErrorDetails } from "./api-error";
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
    const { code, message } = await getApiErrorDetails(response);

    throw new ApiError(response.status, message, code);
  }

  return {
    data: (await response.json()) as T,
    response,
  };
}
