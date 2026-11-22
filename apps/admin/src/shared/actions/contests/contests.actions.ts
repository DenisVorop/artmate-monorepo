"use server";
import { cookies, headers } from "next/headers";
import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";
import type {
  Contest,
  ContestInput,
  ContestDrawData,
  ManualContestDrawInput,
} from "./contests.types";
export async function getContestDraw(id: string) {
  return request<ContestDrawData>(
    `/admin/contests/${encodeURIComponent(id)}/draw`,
  );
}
export async function selectContestWinners(
  id: string,
  input: ManualContestDrawInput,
) {
  return request<ContestDrawData>(
    `/admin/contests/${encodeURIComponent(id)}/draw`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
export async function getContests() {
  return request<Contest[]>("/admin/contests");
}
export async function getContest(id: string) {
  return request<Contest>(`/admin/contests/${encodeURIComponent(id)}`);
}
export async function createContest(input: ContestInput) {
  return request<Contest>("/admin/contests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function updateContest(
  id: string,
  input: ContestInput & { version: number },
) {
  return request<Contest>(`/admin/contests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
async function request<T>(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get("artmate_access_token")?.value;
  const response = await fetch(
    `${process.env.API_BASE_URL ?? "http://localhost:3002"}${path}`,
    {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(token
          ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` }
          : {}),
        ...getForwardedIpHeaders(await headers()),
        ...apiCsrfHeader,
      },
    },
  );
  if (!response.ok) {
    let message =
      response.status === 404
        ? "Конкурс не найден"
        : response.status === 403
          ? "Недостаточно прав для изменения конкурсов"
          : init.method
            ? "Не удалось сохранить конкурс. Попробуйте ещё раз"
            : "Не удалось загрузить конкурсы. Обновите страницу";
    const body: { message?: unknown } = await response.json().catch(() => ({}));
    if (
      [400, 409].includes(response.status) &&
      typeof body.message === "string"
    )
      message = body.message;
    if (response.status === 400 && Array.isArray(body.message))
      message = "Проверьте поля конкурса и попробуйте ещё раз";
    throw new Error(message);
  }
  return (await response.json()) as T;
}
