"use server";

import { cookies } from "next/headers";

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader } from "@/shared/lib/api-security";

import type {
  AddCartItemInputDTO,
  CartDTO,
  RemoveCartItemInputDTO,
  UpdateCartItemInputDTO,
} from "./cart.types";

const CART_COOKIE_NAME = "cart_id";
const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getCart(): Promise<ApiResultDTO<CartDTO>> {
  const result = await ApiResult.prepareApi(async () => requestCart("/cart"))();

  return result.toDTO() as ApiResultDTO<CartDTO>;
}

export async function addCartItem(input: AddCartItemInputDTO): Promise<ApiResultDTO<CartDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestCart("/cart/items", {
      method: "POST",
      body: JSON.stringify({
        productId: input.productId,
        quantity: input.quantity,
      }),
    }),
  )();

  return result.toDTO() as ApiResultDTO<CartDTO>;
}

export async function updateCartItemQuantity(
  input: UpdateCartItemInputDTO,
): Promise<ApiResultDTO<CartDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestCart(`/cart/items/${encodeURIComponent(input.productId)}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: input.quantity }),
    }),
  )();

  return result.toDTO() as ApiResultDTO<CartDTO>;
}

export async function removeCartItem(
  input: RemoveCartItemInputDTO,
): Promise<ApiResultDTO<CartDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestCart(`/cart/items/${encodeURIComponent(input.productId)}`, {
      method: "DELETE",
    }),
  )();

  return result.toDTO() as ApiResultDTO<CartDTO>;
}

export async function clearCart(): Promise<ApiResultDTO<CartDTO>> {
  const result = await ApiResult.prepareApi(async () =>
    requestCart("/cart", {
      method: "DELETE",
    }),
  )();

  return result.toDTO() as ApiResultDTO<CartDTO>;
}

async function requestCart(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(cartId ? { cookie: `${CART_COOKIE_NAME}=${encodeURIComponent(cartId)}` } : {}),
      ...init.headers,
      ...apiCsrfHeader,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const cart = (await response.json()) as CartDTO;
  setCartCookie(cookieStore, cart.id);

  return cart;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function getErrorMessage(response: Response) {
  const fallback = `Cart API request failed with status ${response.status}`;

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

function setCartCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, cartId: string) {
  cookieStore.set(CART_COOKIE_NAME, cartId, {
    httpOnly: true,
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
