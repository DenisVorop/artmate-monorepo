"use server";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "./delivery.types";

const DEFAULT_API_BASE_URL = "http://localhost:3002";

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

async function requestDelivery<T>(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
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
