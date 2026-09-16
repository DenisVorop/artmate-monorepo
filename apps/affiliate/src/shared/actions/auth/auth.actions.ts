"use server";

import { cookies } from "next/headers";

import {
  authAccessTokenCookieName,
  authAccessTokenMaxAgeSeconds,
  parseAuthCookie,
} from "@/shared/lib/auth-cookie";
import { isApiError } from "@/shared/lib/api-error";
import { toActionError, type ActionResult } from "@/shared/lib/action-result";
import { requestApi } from "@/shared/lib/server-api";

import type { AuthSessionDTO, LoginInputDTO, LogoutDTO } from "./auth.types";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function getAuthSession(): Promise<AuthSessionDTO> {
  try {
    return (await requestApi<AuthSessionDTO>("/auth/session")).data;
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      return { user: null };
    }

    throw error;
  }
}

export async function login(
  input: LoginInputDTO,
): Promise<ActionResult<AuthSessionDTO>> {
  try {
    const { data, response } = await requestApi<AuthSessionDTO>("/auth/login", {
      body: JSON.stringify(input),
      method: "POST",
    });
    const cookieStore = await cookies();
    const cookie = parseAuthCookie(response.headers.get("set-cookie"));

    if (cookie) {
      if (!cookie.value || cookie.maxAge === 0) {
        clearAccessTokenCookie(cookieStore);
      } else {
        const domain = cookie.domain ?? getCookieDomain();

        cookieStore.set(authAccessTokenCookieName, cookie.value, {
          ...(domain ? { domain } : {}),
          httpOnly: true,
          maxAge: cookie.maxAge ?? authAccessTokenMaxAgeSeconds,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
    }

    return { data, ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function logout(): Promise<LogoutDTO> {
  const cookieStore = await cookies();

  try {
    return (await requestApi<LogoutDTO>("/auth/logout", { method: "POST" }))
      .data;
  } finally {
    clearAccessTokenCookie(cookieStore);
  }
}

function clearAccessTokenCookie(cookieStore: CookieStore) {
  const domain = getCookieDomain();

  cookieStore.set(authAccessTokenCookieName, "", {
    ...(domain ? { domain } : {}),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function getCookieDomain() {
  return process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
}
