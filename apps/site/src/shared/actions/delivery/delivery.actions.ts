"use server";

import { cookies, headers } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  DeliveryCityDTO,
  DeliveryPickupPointDTO,
  OzonDeliveryMapRequestDTO,
  OzonDeliveryMapResponseDTO,
} from "./delivery.types";

const defaultApiBaseUrl = "http://localhost:3002";
const cartCookieName = "cart_id";
const maxOzonPointInfoIds = 1_000;
const maxOzonPointInfoIdLength = 160;
const ozonPointInfoConcurrency = 4;
const ozonMapErrorMessage = "Не удалось загрузить карту пунктов Ozon. Попробуйте еще раз.";
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

export async function getOzonDeliveryMap(
  input: OzonDeliveryMapRequestDTO,
): Promise<ApiResultDTO<OzonDeliveryMapResponseDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestDelivery<OzonDeliveryMapResponseDTO>("/delivery/ozon/map", {
      method: "POST",
      body: JSON.stringify(input),
    }, ozonMapErrorMessage),
  )();

  return result.toDTO() as ApiResultDTO<OzonDeliveryMapResponseDTO>;
}

export async function getOzonDeliveryPoints(
  mapPointIds: string[],
): Promise<ApiResultDTO<DeliveryPickupPointDTO[]>> {
  const result = await ApiResult.prepareApi(async () => {
    assertValidOzonMapPointIds(mapPointIds);

    const batches = chunk([...new Set(mapPointIds)], 100);
    const responses = new Array<DeliveryPickupPointDTO[]>(batches.length);
    let nextBatchIndex = 0;
    const workers = Array.from(
      { length: Math.min(ozonPointInfoConcurrency, batches.length) },
      async () => {
        while (nextBatchIndex < batches.length) {
          const batchIndex = nextBatchIndex;

          nextBatchIndex += 1;
          responses[batchIndex] = await requestDelivery<DeliveryPickupPointDTO[]>(
            "/delivery/ozon/points/info",
            {
              method: "POST",
              body: JSON.stringify({ mapPointIds: batches[batchIndex] }),
            },
            ozonPointsErrorMessage,
          );
        }
      },
    );

    await Promise.all(workers);

    return responses.flat();
  })();

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

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_unused, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

function assertValidOzonMapPointIds(mapPointIds: unknown): asserts mapPointIds is string[] {
  if (!Array.isArray(mapPointIds)) {
    throw new Error("mapPointIds must be an array of Ozon identifiers");
  }

  if (mapPointIds.length > maxOzonPointInfoIds) {
    throw new Error(`Ozon point info request cannot contain more than ${maxOzonPointInfoIds} IDs`);
  }

  mapPointIds.forEach((id, index) => {
    if (typeof id !== "string" || !id.trim() || id.length > maxOzonPointInfoIdLength) {
      throw new Error(
        `mapPointIds[${index}] must be a non-empty Ozon identifier up to ${maxOzonPointInfoIdLength} characters`,
      );
    }
  });
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
