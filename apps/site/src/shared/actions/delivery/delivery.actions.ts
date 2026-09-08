"use server";

import { cookies, headers } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type { CdekCityDetailsDTO, DeliveryCityDTO, DeliveryPickupPointDTO } from "./delivery.types";

const defaultApiBaseUrl = "http://localhost:3002";
const cartCookieName = "cart_id";
const cdekCitiesErrorMessage = "Не удалось загрузить города. Попробуйте еще раз.";
const cdekCityErrorMessage = "Не удалось загрузить данные города. Попробуйте еще раз.";
const ozonPickupPointsErrorMessage = "Не удалось загрузить пункты Ozon. Попробуйте еще раз.";
const boundaryErrorCodes = new Set(["DELIVERY_BOUNDARY_AMBIGUOUS", "DELIVERY_BOUNDARY_MISSING"]);

export async function searchCdekCities(query: string): Promise<ApiResultDTO<DeliveryCityDTO[]>> {
  const result = await ApiResult.prepareApi(async () =>
    requestDelivery<DeliveryCityDTO[]>(
      `/delivery/cdek/cities?query=${encodeURIComponent(query)}&countryCode=RU`,
      {},
      cdekCitiesErrorMessage,
    ),
  )();

  return result.toDTO() as ApiResultDTO<DeliveryCityDTO[]>;
}

export async function getCdekPickupPoints(
  cityCode: number,
): Promise<ApiResultDTO<DeliveryPickupPointDTO[]>> {
  const result = await ApiResult.prepareApi(async () =>
    requestDelivery<DeliveryPickupPointDTO[]>(
      `/delivery/cdek/pickup-points?cityCode=${encodeURIComponent(cityCode)}`,
    ),
  )();

  return result.toDTO() as ApiResultDTO<DeliveryPickupPointDTO[]>;
}

export async function getCdekCity(cityCode: number): Promise<ApiResultDTO<CdekCityDetailsDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestDelivery<CdekCityDetailsDTO>(
      `/delivery/cdek/city?cityCode=${encodeURIComponent(cityCode)}`,
      {},
      cdekCityErrorMessage,
    ),
  )();

  return result.toDTO() as ApiResultDTO<CdekCityDetailsDTO>;
}

export async function getOzonPickupPoints(
  cityCode: number,
): Promise<ApiResultDTO<DeliveryPickupPointDTO[]>> {
  const result = await ApiResult.prepareApi(async () =>
    requestDelivery<DeliveryPickupPointDTO[]>(
      `/delivery/ozon/pickup-points?cityCode=${encodeURIComponent(cityCode)}`,
      {},
      ozonPickupPointsErrorMessage,
      boundaryErrorCodes,
    ),
  )();

  return result.toDTO() as ApiResultDTO<DeliveryPickupPointDTO[]>;
}

async function requestDelivery<T>(
  path: string,
  init: RequestInit = {},
  serverErrorMessage?: string,
  safeServerErrorCodes?: ReadonlySet<string>,
) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cartId = cookieStore.get(cartCookieName)?.value;
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(cartId ? { cookie: `${cartCookieName}=${encodeURIComponent(cartId)}` } : {}),
        ...getForwardedIpHeaders(headerStore),
        ...init.headers,
        ...apiCsrfHeader,
      },
    });
  } catch (error) {
    if (serverErrorMessage) {
      throw new Error(serverErrorMessage);
    }

    throw error;
  }

  if (!response.ok) {
    const error = await getError(response);
    throw new Error(
      response.status >= 500 && serverErrorMessage && !safeServerErrorCodes?.has(error.code ?? "")
        ? serverErrorMessage
        : error.message,
    );
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getError(response: Response) {
  const fallback = `Delivery API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { code?: unknown; message?: unknown };

    if (typeof body.message === "string") {
      return { code: typeof body.code === "string" ? body.code : undefined, message: body.message };
    }

    if (Array.isArray(body.message)) {
      return { code: undefined, message: body.message.join(", ") };
    }
  } catch {
    return { code: undefined, message: fallback };
  }

  return { code: undefined, message: fallback };
}
