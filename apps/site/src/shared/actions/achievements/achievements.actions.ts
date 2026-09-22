"use server";

import { cookies, headers } from "next/headers";

import { getAuthSession } from "@/shared/actions/auth";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { getForwardedIpHeaders } from "@/shared/lib/api-security";

export async function getMyAchievements(userId: string): Promise<ApiResultDTO<unknown>> {
  const result = await ApiResult.prepareApi(
    async () => {
      const session = ApiResult.fromDTO(await getAuthSession()).data;
      if (!userId || session?.user?.id !== userId) {
        throw Object.assign(new Error("Войдите в аккаунт, чтобы открыть достижения."), {
          status: 401,
        });
      }

      const cookieStore = await cookies();
      const headerStore = await headers();
      const token = cookieStore.get("artmate_access_token")?.value;
      const response = await fetch(
        `${process.env.API_BASE_URL ?? "http://localhost:3002"}/achievements/me`,
        {
          cache: "no-store",
          headers: {
            ...(token ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` } : {}),
            ...getForwardedIpHeaders(headerStore),
          },
        },
      );

      if (!response.ok) {
        throw Object.assign(new Error("Не удалось загрузить достижения. Попробуйте позже."), {
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
