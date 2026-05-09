"use server";

import { cookies, headers } from "next/headers";

import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  AdminOrderMutationResultDTO,
  AdminOrderDTO,
  CreateAdminOrderCommentInputDTO,
  UpdateAdminOrderStatusInputDTO,
} from "./order.types";

const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const DEFAULT_API_BASE_URL = "http://localhost:3002";

class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export async function getAdminOrders(): Promise<AdminOrderDTO[]> {
  return requestAdminApi<AdminOrderDTO[]>("/orders/admin");
}

export async function getAdminOrder(orderId: string): Promise<AdminOrderDTO> {
  return requestAdminApi<AdminOrderDTO>(
    `/orders/admin/${encodeURIComponent(orderId)}`,
  );
}

export async function updateAdminOrderStatus(
  orderId: string,
  input: UpdateAdminOrderStatusInputDTO,
) {
  return requestAdminMutation(
    `/orders/admin/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function createAdminOrderComment(
  orderId: string,
  input: CreateAdminOrderCommentInputDTO,
) {
  return requestAdminMutation(
    `/orders/admin/${encodeURIComponent(orderId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

async function requestAdminMutation(
  path: string,
  init: RequestInit,
): Promise<AdminOrderMutationResultDTO> {
  try {
    return {
      ok: true,
      data: await requestAdminApi<AdminOrderDTO>(path, init),
    };
  } catch (error) {
    return {
      ok: false,
      error: getActionErrorMessage(error),
      status: getActionErrorStatus(error),
    };
  }
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(AUTH_ACCESS_TOKEN_COOKIE_NAME)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(accessToken
        ? {
            cookie: `${AUTH_ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
          }
        : {}),
      ...getForwardedIpHeaders(headerStore),
      ...init.headers,
      ...apiCsrfHeader,
    },
  });

  if (!response.ok) {
    throw new AdminApiError(
      await getResponseErrorMessage(response),
      response.status,
    );
  }

  return (await response.json()) as T;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Orders API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: unknown;
    };

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

function getActionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Orders API request failed";
}

function getActionErrorStatus(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.status;
  }

  return undefined;
}
