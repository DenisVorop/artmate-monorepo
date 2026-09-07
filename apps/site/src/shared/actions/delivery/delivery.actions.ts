"use server";

import { cookies, headers } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  DeliveryCityDTO,
  DeliveryPickupPointDTO,
  OzonDeliveryCityDTO,
} from "./delivery.types";

const defaultApiBaseUrl = "http://localhost:3002";
const cartCookieName = "cart_id";
const ozonCitiesErrorMessage = "Не удалось загрузить города Ozon. Попробуйте еще раз.";
const ozonPointsErrorMessage = "Не удалось загрузить пункты выдачи Ozon. Попробуйте еще раз.";

export async function searchCdekCities(query: string): Promise<ApiResultDTO<DeliveryCityDTO[]>> {
  const result = await ApiResult.prepareApi(async () =>
    requestDelivery<DeliveryCityDTO[]>(
      `/delivery/cdek/cities?query=${encodeURIComponent(query)}&countryCode=RU`,
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

export async function searchOzonCities(
  query: string,
): Promise<ApiResultDTO<OzonDeliveryCityDTO[]>> {
  const result = await ApiResult.prepareApi(async () =>
    requestDelivery<OzonDeliveryCityDTO[]>(
      `/delivery/ozon/cities?query=${encodeURIComponent(query)}`,
      {},
      ozonCitiesErrorMessage,
    ),
  )();

  return result.toDTO() as ApiResultDTO<OzonDeliveryCityDTO[]>;
}

export async function getOzonPickupPoints(
  localityId: string,
): Promise<ApiResultDTO<DeliveryPickupPointDTO[]>> {
  const result = await ApiResult.prepareApi(async () =>
    requestDelivery<DeliveryPickupPointDTO[]>(
      `/delivery/ozon/pickup-points?localityId=${encodeURIComponent(localityId)}`,
      {},
      ozonPointsErrorMessage,
    ),
  )();

  return result.toDTO() as ApiResultDTO<DeliveryPickupPointDTO[]>;
}

async function requestDelivery<T>(
  path: string,
  init: RequestInit = {},
  serverErrorMessage?: string,
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
    throw new Error(
      response.status >= 500 && serverErrorMessage
        ? serverErrorMessage
        : await getErrorMessage(response),
    );
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getErrorMessage(response: Response) {
  const fallback = `Delivery API request failed with status ${response.status}`;

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
