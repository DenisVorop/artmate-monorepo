"use server";

import { cookies, headers } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type {
  AuthProvidersDTO,
  AuthSessionDTO,
  LoginInputDTO,
  LogoutDTO,
  RegisterInputDTO,
} from "./auth.types";

const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const AUTH_ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_API_BASE_URL = "http://localhost:3002";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type RequestAuthOptions = {
  syncAccessTokenCookie?: boolean;
};

export async function getAuthProviders(): Promise<ApiResultDTO<AuthProvidersDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestAuth<AuthProvidersDTO>("/auth/providers"),
  )();

  return result.toDTO() as ApiResultDTO<AuthProvidersDTO>;
}

export async function getAuthSession(): Promise<ApiResultDTO<AuthSessionDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestAuth<AuthSessionDTO>("/auth/session"),
  )();

  return result.toDTO() as ApiResultDTO<AuthSessionDTO>;
}

export async function login(input: LoginInputDTO): Promise<ApiResultDTO<AuthSessionDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestAuth<AuthSessionDTO>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { syncAccessTokenCookie: true },
    ),
  )();

  return result.toDTO() as ApiResultDTO<AuthSessionDTO>;
}

export async function register(input: RegisterInputDTO): Promise<ApiResultDTO<AuthSessionDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestAuth<AuthSessionDTO>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { syncAccessTokenCookie: true },
    ),
  )();

  return result.toDTO() as ApiResultDTO<AuthSessionDTO>;
}

export async function logout(): Promise<ApiResultDTO<LogoutDTO>> {
  const result = await ApiResult.prepareApi(async () => {
    const response = await requestAuth<LogoutDTO>("/auth/logout", {
      method: "POST",
    });
    const cookieStore = await cookies();

    clearAccessTokenCookie(cookieStore);

    return response;
  })();

  return result.toDTO() as ApiResultDTO<LogoutDTO>;
}

async function requestAuth<T>(
  path: string,
  init: RequestInit = {},
  options: RequestAuthOptions = {},
) {
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
    throw new Error(await getErrorMessage(response));
  }

  if (options.syncAccessTokenCookie) {
    syncAccessTokenCookie(cookieStore, response);
  }

  return (await response.json()) as T;
}

function syncAccessTokenCookie(cookieStore: CookieStore, response: Response) {
  const setCookieHeader = response.headers.get("set-cookie");
  const cookie = parseSetCookie(setCookieHeader, AUTH_ACCESS_TOKEN_COOKIE_NAME);

  if (!cookie) {
    return;
  }

  if (!cookie.value || cookie.maxAge === 0) {
    clearAccessTokenCookie(cookieStore);
    return;
  }

  cookieStore.set(AUTH_ACCESS_TOKEN_COOKIE_NAME, cookie.value, {
    httpOnly: true,
    maxAge: cookie.maxAge ?? AUTH_ACCESS_TOKEN_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function clearAccessTokenCookie(cookieStore: CookieStore) {
  cookieStore.set(AUTH_ACCESS_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function parseSetCookie(header: string | null, name: string) {
  if (!header) {
    return undefined;
  }

  const cookieHeader = header
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  if (!cookieHeader) {
    return undefined;
  }

  const [nameValue = "", ...attributes] = cookieHeader.split(";").map((part) => part.trim());
  const separatorIndex = nameValue.indexOf("=");

  if (separatorIndex < 0) {
    return undefined;
  }

  const value = nameValue.slice(separatorIndex + 1);
  const maxAgeAttribute = attributes.find((attribute) =>
    attribute.toLowerCase().startsWith("max-age="),
  );
  const maxAge = maxAgeAttribute
    ? Number(maxAgeAttribute.slice("max-age=".length))
    : undefined;

  return {
    value,
    maxAge: typeof maxAge === "number" && Number.isFinite(maxAge) ? maxAge : undefined,
  };
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

async function getErrorMessage(response: Response) {
  const fallback = `Auth API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: unknown;
      retryAfterSeconds?: unknown;
    };
    const retryAfterSeconds = getRetryAfterSeconds(body.retryAfterSeconds);

    if (typeof body.message === "string") {
      return formatErrorMessage(body.message, retryAfterSeconds);
    }

    if (Array.isArray(body.message)) {
      return formatErrorMessage(body.message.join(", "), retryAfterSeconds);
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function getRetryAfterSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.ceil(value))
    : undefined;
}

function formatErrorMessage(message: string, retryAfterSeconds?: number) {
  if (!retryAfterSeconds) {
    return message;
  }

  return `${message}. Retry after ${retryAfterSeconds} seconds`;
}
