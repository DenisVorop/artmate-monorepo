"use server";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type {
  OzonDeliveryMapRequestDTO,
  OzonDeliveryMapResponseDTO,
  OzonDeliveryPointInfoRequestDTO,
  OzonDeliveryPointInfoResponseDTO,
} from "./ozon.types";

const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getOzonDeliveryMap(
  input: OzonDeliveryMapRequestDTO,
): Promise<ApiResultDTO<OzonDeliveryMapResponseDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOzon<OzonDeliveryMapResponseDTO>("/ozon/logistics/map", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  )();

  return result.toDTO() as ApiResultDTO<OzonDeliveryMapResponseDTO>;
}

export async function getOzonDeliveryPointInfo(
  input: OzonDeliveryPointInfoRequestDTO,
): Promise<ApiResultDTO<OzonDeliveryPointInfoResponseDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOzon<OzonDeliveryPointInfoResponseDTO>("/ozon/logistics/point-info", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  )();

  return result.toDTO() as ApiResultDTO<OzonDeliveryPointInfoResponseDTO>;
}

async function requestOzon<T>(path: string, init: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...init.headers,
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
  const fallback = `Ozon Logistics API request failed with status ${response.status}`;

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
