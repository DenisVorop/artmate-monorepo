"use server";

import { cookies, headers } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  CalculateCheckoutInputDTO,
  CheckoutCalculationDTO,
  CreateOrderInputDTO,
  CreateOrderResponseDTO,
  OrderDTO,
  OrderStateDTO,
  PaymentRecoveryResponseDTO,
} from "./order.types";

const CART_COOKIE_NAME = "cart_id";
const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const DEFAULT_API_BASE_URL = "http://localhost:3002";
const calculateCheckoutErrorMessage = "Не удалось рассчитать заказ. Попробуйте еще раз.";
const createOrderErrorMessage = "Не удалось оформить заказ. Попробуйте еще раз.";
const yandexAttributionIdPattern = /^\d{1,128}$/;

type CreateOrderAttribution = {
  clientId?: string;
  yclid?: string;
};

export async function getMyOrders(): Promise<ApiResultDTO<OrderDTO[]>> {
  const result = await ApiResult.prepareApi(async () => requestOrders<OrderDTO[]>("/orders/my"))();

  return result.toDTO() as ApiResultDTO<OrderDTO[]>;
}

export async function createOrder(
  input: CreateOrderInputDTO,
  attribution: CreateOrderAttribution = {},
): Promise<ApiResultDTO<CreateOrderResponseDTO>> {
  const requestInput = { ...input } as Record<string, unknown>;
  delete requestInput.attribution;
  const allowedAttribution = {
    ...(isValidYandexAttributionId(attribution.clientId)
      ? { clientId: attribution.clientId }
      : {}),
    ...(isValidYandexAttributionId(attribution.yclid) ? { yclid: attribution.yclid } : {}),
  };
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<CreateOrderResponseDTO>("/orders", {
      method: "POST",
      body: JSON.stringify({
        ...requestInput,
        ...(Object.keys(allowedAttribution).length > 0
          ? { attribution: allowedAttribution }
          : {}),
      }),
    }, createOrderErrorMessage),
  )();

  return result.toDTO() as ApiResultDTO<CreateOrderResponseDTO>;
}

function isValidYandexAttributionId(value: unknown): value is string {
  return typeof value === "string" && yandexAttributionIdPattern.test(value);
}

export async function calculateCheckout(
  input: CalculateCheckoutInputDTO,
): Promise<ApiResultDTO<CheckoutCalculationDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<CheckoutCalculationDTO>("/orders/checkout/calculate", {
      method: "POST",
      body: JSON.stringify(input),
    }, calculateCheckoutErrorMessage),
  )();

  return result.toDTO() as ApiResultDTO<CheckoutCalculationDTO>;
}

export async function getOrderStatus(orderId: string): Promise<ApiResultDTO<OrderStateDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<OrderStateDTO>(`/orders/${encodeURIComponent(orderId)}/status`),
  )();

  return result.toDTO() as ApiResultDTO<OrderStateDTO>;
}

export async function getOrder(orderId: string): Promise<ApiResultDTO<OrderDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<OrderDTO>(`/orders/${encodeURIComponent(orderId)}`),
  )();

  return result.toDTO() as ApiResultDTO<OrderDTO>;
}

export async function recoverOrderPayment(
  orderId: string,
): Promise<ApiResultDTO<PaymentRecoveryResponseDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestOrders<PaymentRecoveryResponseDTO>(
      `/orders/${encodeURIComponent(orderId)}/payment-recovery`,
      { method: "POST" },
    ),
  )();

  return result.toDTO() as ApiResultDTO<PaymentRecoveryResponseDTO>;
}

async function requestOrders<T>(
  path: string,
  init: RequestInit = {},
  serverErrorMessage?: string,
) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  const accessToken = cookieStore.get(AUTH_ACCESS_TOKEN_COOKIE_NAME)?.value;
  const cookieHeader = getRequestCookieHeader([
    [CART_COOKIE_NAME, cartId],
    [AUTH_ACCESS_TOKEN_COOKIE_NAME, accessToken],
  ]);
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...init.headers,
        ...getForwardedIpHeaders(headerStore),
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

function getRequestCookieHeader(cookies: Array<[string, string | undefined]>) {
  const values = cookies
    .filter((item): item is [string, string] => Boolean(item[1]))
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`);

  return values.length > 0 ? values.join("; ") : undefined;
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
