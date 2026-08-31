"use server";

import { cookies, headers } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  PromoCodeInputDTO,
  PromoPreviewDTO,
  WelcomeOfferResponseDTO,
  WelcomePromoResponseDTO,
} from "./promocode.types";

const cartCookieName = "cart_id";
const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

export async function previewPromoCode(
  input: PromoCodeInputDTO,
): Promise<ApiResultDTO<PromoPreviewDTO>> {
  const result = await ApiResult.prepareApi(async () => requestPromoCodePreview(input))();

  return result.toDTO() as ApiResultDTO<PromoPreviewDTO>;
}

export async function getWelcomePromoCode(): Promise<ApiResultDTO<WelcomePromoResponseDTO>> {
  const result = await ApiResult.prepareApi(requestWelcomePromoCode)();

  return result.toDTO() as ApiResultDTO<WelcomePromoResponseDTO>;
}

export async function getWelcomeOffer(): Promise<ApiResultDTO<WelcomeOfferResponseDTO>> {
  const result = await ApiResult.prepareApi(requestWelcomeOffer)();

  return result.toDTO() as ApiResultDTO<WelcomeOfferResponseDTO>;
}

async function requestWelcomeOffer() {
  const cookieStore = await cookies();
  const cookieHeader = getRequestCookieHeader([
    [authAccessTokenCookieName, cookieStore.get(authAccessTokenCookieName)?.value],
  ]);
  const response = await fetch(
    `${process.env.API_BASE_URL ?? defaultApiBaseUrl}/promocodes/welcome-offer`,
    {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    },
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as WelcomeOfferResponseDTO;
}

async function requestWelcomePromoCode() {
  const cookieStore = await cookies();
  const cookieHeader = getRequestCookieHeader([
    [authAccessTokenCookieName, cookieStore.get(authAccessTokenCookieName)?.value],
  ]);
  const response = await fetch(
    `${process.env.API_BASE_URL ?? defaultApiBaseUrl}/promocodes/welcome`,
    {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    },
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as WelcomePromoResponseDTO;
}

async function requestPromoCodePreview(input: PromoCodeInputDTO) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieHeader = getRequestCookieHeader([
    [cartCookieName, cookieStore.get(cartCookieName)?.value],
    [authAccessTokenCookieName, cookieStore.get(authAccessTokenCookieName)?.value],
  ]);
  const response = await fetch(
    `${process.env.API_BASE_URL ?? defaultApiBaseUrl}/promocodes/preview`,
    {
      method: "POST",
      body: JSON.stringify(input),
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...getForwardedIpHeaders(headerStore),
        ...apiCsrfHeader,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as PromoPreviewDTO;
}

function getRequestCookieHeader(values: Array<[string, string | undefined]>) {
  const requestCookies = values
    .filter((item): item is [string, string] => Boolean(item[1]))
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`);

  return requestCookies.length > 0 ? requestCookies.join("; ") : undefined;
}

async function getErrorMessage(response: Response) {
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
