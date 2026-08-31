"use server";

import { cookies, headers } from "next/headers";

import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";

import type {
  PromoCodeAdminDTO,
  PromoCodeInputDTO,
  PromoCodeMutationResultDTO,
  ReleasePromoCodeRedemptionInputDTO,
  UpdatePromoCodeInputDTO,
} from "./promocodes.types";
import { PromoCodeApiError } from "./promocode-api-error";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

export async function getAdminPromoCodes() {
  return requestAdminApi<PromoCodeAdminDTO[]>("/promocodes/admin");
}

export async function getAdminPromoCode(promoCodeId: string) {
  return requestAdminApi<PromoCodeAdminDTO>(
    `/promocodes/admin/${encodeURIComponent(promoCodeId)}`,
  );
}

export async function createAdminPromoCode(input: PromoCodeInputDTO) {
  return requestAdminApi<PromoCodeAdminDTO>("/promocodes/admin", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminPromoCode(
  promoCodeId: string,
  input: UpdatePromoCodeInputDTO,
) {
  return requestAdminApi<PromoCodeAdminDTO>(
    `/promocodes/admin/${encodeURIComponent(promoCodeId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function releaseAdminPromoCodeRedemption(
  promoCodeId: string,
  orderId: string,
  input: ReleasePromoCodeRedemptionInputDTO,
): Promise<PromoCodeMutationResultDTO> {
  try {
    return {
      ok: true,
      data: await requestAdminApi<PromoCodeAdminDTO>(
        `/promocodes/admin/${encodeURIComponent(promoCodeId)}/redemptions/${encodeURIComponent(orderId)}/release`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось снять резерв промокода",
      ...(error instanceof PromoCodeApiError ? { status: error.status } : {}),
    };
  }
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
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
      "content-type": "application/json",
      ...getForwardedIpHeaders(headerStore),
      ...init.headers,
      ...apiCsrfHeader,
    },
  });

  if (!response.ok) {
    throw new PromoCodeApiError(
      await getResponseErrorMessage(response),
      response.status,
    );
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Promocodes API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { message?: unknown };

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
