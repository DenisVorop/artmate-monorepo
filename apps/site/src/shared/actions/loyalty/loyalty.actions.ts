"use server";

import { cookies, headers } from "next/headers";

import { getAuthSession } from "@/shared/actions/auth";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

export async function getMyLoyalty(userId: string) {
  return requestResult(userId, "/loyalty/me");
}

export async function getMyLoyaltyDashboard(userId: string) {
  return requestResult(userId, "/loyalty/me/dashboard");
}

export async function getMyLoyaltyOperations(userId: string, cursor?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  return requestResult(userId, `/loyalty/me/operations?${params}`);
}

export async function enrollInLoyalty(
  userId: string,
  input: { acceptedTerms: true; termsVersion: string },
) {
  return requestResult(userId, "/loyalty/enroll", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function requestResult(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResultDTO<unknown>> {
  const result = await ApiResult.prepareApi(
    async () => {
      const session = ApiResult.fromDTO(await getAuthSession()).data;
      if (!userId || session?.user?.id !== userId) {
        throw Object.assign(new Error("Войдите в аккаунт, чтобы открыть клуб."), { status: 401 });
      }

      const cookieStore = await cookies();
      const headerStore = await headers();
      const token = cookieStore.get("artmate_access_token")?.value;
      const response = await fetch(
        `${process.env.API_BASE_URL ?? "http://localhost:3002"}${path}`,
        {
          ...init,
          cache: "no-store",
          headers: {
            ...(token ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` } : {}),
            ...getForwardedIpHeaders(headerStore),
            ...(init.method === "POST"
              ? { ...apiCsrfHeader, "content-type": "application/json" }
              : {}),
          },
        },
      );

      if (!response.ok) {
        throw Object.assign(new Error("Не удалось загрузить данные клуба. Попробуйте позже."), {
          status: response.status,
        });
      }
      return response.json();
    },
    { isEmptyCb: () => false },
  )();

  const dto = result.toDTO();
  if (dto.error) {
    const error = { ...dto.error };
    delete (error as { stack?: unknown }).stack;
    return { ...dto, error };
  }
  return dto;
}
