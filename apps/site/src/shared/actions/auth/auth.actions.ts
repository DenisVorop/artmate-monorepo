"use server";

import { cookies, headers } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  AuthProvidersDTO,
  AuthSessionDTO,
  AuthTelegramLinkResponseDTO,
  AuthTelegramLinkStatusDTO,
  ConfirmTelegramLinkInputDTO,
  LogoutDTO,
} from "./auth.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function getAuthProviders(): Promise<ApiResultDTO<AuthProvidersDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    _requestAuth<AuthProvidersDTO>("/auth/providers"),
  )();

  return result.toDTO() as ApiResultDTO<AuthProvidersDTO>;
}

export async function getAuthSession(): Promise<ApiResultDTO<AuthSessionDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    _requestAuth<AuthSessionDTO>("/auth/session"),
  )();

  return result.toDTO() as ApiResultDTO<AuthSessionDTO>;
}

export async function logout(): Promise<ApiResultDTO<LogoutDTO>> {
  const result = await ApiResult.prepareApi(async () => {
    const response = await _requestAuth<LogoutDTO>("/auth/logout", {
      method: "POST",
    });
    const cookieStore = await cookies();

    _clearAccessTokenCookie(cookieStore);

    return response;
  })();

  return result.toDTO() as ApiResultDTO<LogoutDTO>;
}

export async function getTelegramLinkStatus(): Promise<ApiResultDTO<AuthTelegramLinkStatusDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    _requestAuth<AuthTelegramLinkStatusDTO>("/auth/telegram/link/status"),
  )();

  return result.toDTO() as ApiResultDTO<AuthTelegramLinkStatusDTO>;
}

export async function confirmTelegramLink(
  input: ConfirmTelegramLinkInputDTO,
): Promise<ApiResultDTO<AuthTelegramLinkResponseDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    _requestAuth<AuthTelegramLinkResponseDTO>("/auth/telegram/link/confirm", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  )();

  return result.toDTO() as ApiResultDTO<AuthTelegramLinkResponseDTO>;
}

export async function unlinkTelegram(): Promise<ApiResultDTO<AuthTelegramLinkStatusDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    _requestAuth<AuthTelegramLinkStatusDTO>("/auth/telegram/link", {
      method: "DELETE",
    }),
  )();

  return result.toDTO() as ApiResultDTO<AuthTelegramLinkStatusDTO>;
}

async function _requestAuth<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const response = await fetch(`${_getApiBaseUrl()}${path}`, {
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
  });

  if (!response.ok) {
    throw new Error(await _getErrorMessage(response));
  }

  return (await response.json()) as T;
}

function _clearAccessTokenCookie(cookieStore: CookieStore) {
  const domain = _getCookieDomain();

  cookieStore.set(authAccessTokenCookieName, "", {
    ...(domain ? { domain } : {}),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function _getCookieDomain() {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();

  return domain || undefined;
}

function _getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function _getErrorMessage(response: Response) {
  const fallback = `Auth API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: unknown;
      retryAfterSeconds?: unknown;
    };
    const retryAfterSeconds = _getRetryAfterSeconds(body.retryAfterSeconds);

    if (typeof body.message === "string") {
      return _formatErrorMessage(body.message, retryAfterSeconds);
    }

    if (Array.isArray(body.message)) {
      return _formatErrorMessage(body.message.join(", "), retryAfterSeconds);
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function _getRetryAfterSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.ceil(value))
    : undefined;
}

function _formatErrorMessage(message: string, retryAfterSeconds?: number) {
  if (!retryAfterSeconds) {
    return message;
  }

  return `${message}. Retry after ${retryAfterSeconds} seconds`;
}
