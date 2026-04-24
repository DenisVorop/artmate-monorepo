"use server";

import { cookies } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type {
  ConfirmOrderPaymentInputDTO,
  CreateOrderInputDTO,
  OrderDTO,
  OzonPickupPointDTO,
} from "./order.types";

const CART_COOKIE_NAME = "cart_id";
const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getOzonPickupPoints(): Promise<ApiResultDTO<OzonPickupPointDTO[]>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<OzonPickupPointDTO[]>("/orders/pickup-points"),
  )();

  return result.toDTO() as ApiResultDTO<OzonPickupPointDTO[]>;
}

export async function createOrder(input: CreateOrderInputDTO): Promise<ApiResultDTO<OrderDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<OrderDTO>("/orders", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  )();

  return result.toDTO() as ApiResultDTO<OrderDTO>;
}

export async function confirmOrderPayment(
  input: ConfirmOrderPaymentInputDTO,
): Promise<ApiResultDTO<OrderDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<OrderDTO>(`/orders/${encodeURIComponent(input.orderId)}/confirm-payment`, {
      method: "POST",
    }),
  )();

  return result.toDTO() as ApiResultDTO<OrderDTO>;
}

export async function getOrder(orderId: string): Promise<ApiResultDTO<OrderDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<OrderDTO>(`/orders/${encodeURIComponent(orderId)}`),
  )();

  return result.toDTO() as ApiResultDTO<OrderDTO>;
}

async function requestOrders<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(cartId ? { cookie: `${CART_COOKIE_NAME}=${encodeURIComponent(cartId)}` } : {}),
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
  const fallback = `Orders API request failed with status ${response.status}`;

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
