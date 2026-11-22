"use server";
import { cookies, headers } from "next/headers";
import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";
import type {
  ContestEntriesPage,
  ContestEntry,
  ContestEntryDecision,
  ContestEntryStatus,
} from "./contest-entries.types";
export async function getContestEntries(
  contestId: string,
  status: ContestEntryStatus | "all",
  cursor?: string,
) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  return (await (
    await request(
      `/admin/contests/${encodeURIComponent(contestId)}/entries?${params}`,
    )
  ).json()) as ContestEntriesPage;
}
export async function getContestEntry(id: string) {
  return (await (
    await request(`/admin/contest-entries/${encodeURIComponent(id)}`)
  ).json()) as ContestEntry;
}
export async function decideContestEntry(
  id: string,
  input: ContestEntryDecision,
) {
  return (await (
    await request(`/admin/contest-entries/${encodeURIComponent(id)}/decision`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).json()) as ContestEntry;
}
export async function getContestEntryPhoto(id: string, revisionId: string) {
  const response = await request(
    `/admin/contest-entries/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/photo`,
  );
  if (response.headers.get("content-type")?.split(";")[0] !== "image/webp")
    throw new Error("Не удалось загрузить фотографию");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024)
    throw new Error("Не удалось загрузить фотографию");
  return `data:image/webp;base64,${Buffer.from(bytes).toString("base64")}`;
}
async function request(path: string, init: RequestInit = {}) {
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
    const body = (await response.json().catch(() => ({}))) as {
      message?: unknown;
    };
    let message =
      response.status === 401
        ? "Войдите в админку ещё раз"
        : response.status === 403
          ? "Недостаточно прав"
          : response.status === 404
            ? "Заявка не найдена"
            : init.method
              ? "Не удалось сохранить решение. Попробуйте ещё раз"
              : "Не удалось загрузить заявки. Попробуйте ещё раз";
    if (
      [400, 409].includes(response.status) &&
      typeof body.message === "string" &&
      /[а-яА-ЯёЁ]/.test(body.message)
    )
      message = body.message;
    throw new Error(message);
  }
  return response;
}
