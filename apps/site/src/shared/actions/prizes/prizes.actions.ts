"use server";
import { cookies, headers } from "next/headers";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";
import type { OrderDTO } from "@/shared/actions/orders";
import type { ProductPrizeDTO, CreatePrizeOrderInput, MyPrizesDTO } from "./prizes.types";

export async function getMyPrizes(): Promise<ApiResultDTO<MyPrizesDTO>> {
  return (
    await ApiResult.prepareApi(() => request<MyPrizesDTO>("/orders/prizes"))()
  ).toDTO() as ApiResultDTO<MyPrizesDTO>;
}
export async function getMyPrize(id: string): Promise<ApiResultDTO<ProductPrizeDTO | null>> {
  return (
    await ApiResult.prepareApi(
      () => request<ProductPrizeDTO | null>(`/orders/prizes/${encodeURIComponent(id)}`, {}, true),
      { isEmptyCb: () => false },
    )()
  ).toDTO() as ApiResultDTO<ProductPrizeDTO | null>;
}
export async function createPrizeOrder(
  id: string,
  input: CreatePrizeOrderInput,
): Promise<ApiResultDTO<OrderDTO>> {
  return (
    await ApiResult.prepareApi(() =>
      request<OrderDTO>(`/orders/prizes/${encodeURIComponent(id)}/order`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    )()
  ).toDTO() as ApiResultDTO<OrderDTO>;
}
async function request<T>(path: string, init: RequestInit = {}, nullable = false): Promise<T> {
  const token = (await cookies()).get("artmate_access_token")?.value;
  let response: Response;
  try {
    response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:3002"}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(token ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` } : {}),
        ...getForwardedIpHeaders(await headers()),
        ...(init.method ? apiCsrfHeader : {}),
      },
    });
  } catch {
    throw new Error("Не удалось связаться с сервером. Попробуйте ещё раз");
  }
  if (nullable && response.status === 404) return null as T;
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: unknown };
    const fallback = init.method
      ? "Не удалось оформить приз. Попробуйте ещё раз"
      : "Не удалось загрузить призы. Попробуйте ещё раз";
    if (
      [400, 409, 503].includes(response.status) &&
      typeof body.message === "string" &&
      !/[<>\r\n]/.test(body.message) &&
      body.message.length <= 250
    )
      throw new Error(body.message);
    throw new Error(
      response.status === 401
        ? "Войдите в аккаунт ещё раз"
        : response.status === 404
          ? "Приз не найден"
          : fallback,
    );
  }
  return response.json() as Promise<T>;
}
