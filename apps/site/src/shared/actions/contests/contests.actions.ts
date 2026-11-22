"use server";
import { cookies, headers } from "next/headers";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";
import { RequestEvidenceProxyHeaders } from "@/shared/lib/request-evidence-proxy-headers";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import type {
  Contest,
  ContestEntry,
  SubmitContestEntryInput,
  ContestConsentOffer,
} from "./contests.types";
export async function getContests(): Promise<ApiResultDTO<Contest[]>> {
  return (
    await ApiResult.prepareApi(() => request<Contest[]>("/contests"))()
  ).toDTO() as ApiResultDTO<Contest[]>;
}
export async function getContest(slug: string): Promise<ApiResultDTO<Contest>> {
  return (
    await ApiResult.prepareApi(() => request<Contest>(`/contests/${encodeURIComponent(slug)}`))()
  ).toDTO() as ApiResultDTO<Contest>;
}
export async function prepareContestEntryConsent(
  slug: string,
): Promise<ApiResultDTO<ContestConsentOffer>> {
  return (
    await ApiResult.prepareApi(() =>
      request<ContestConsentOffer>(`/contests/${encodeURIComponent(slug)}/entry-consent`, {
        method: "POST",
      }),
    )()
  ).toDTO() as ApiResultDTO<ContestConsentOffer>;
}
export async function getMyContestEntry(slug: string): Promise<ApiResultDTO<ContestEntry | null>> {
  return (
    await ApiResult.prepareApi(
      async () =>
        (
          await request<{ entry: ContestEntry | null }>(
            `/contests/${encodeURIComponent(slug)}/entry`,
          )
        ).entry,
      { isEmptyCb: () => false },
    )()
  ).toDTO() as ApiResultDTO<ContestEntry | null>;
}
export async function submitContestEntry(
  slug: string,
  input: SubmitContestEntryInput,
): Promise<ApiResultDTO<ContestEntry>> {
  const form = new FormData();
  if (input.photo) form.append("photo", input.photo);
  form.append(
    "payload",
    JSON.stringify({
      consentOfferId: input.consentOfferId,
      personalDataAccepted: input.personalDataAccepted,
      publicationAccepted: input.publicationAccepted,
      albumId: input.albumId,
      number: input.number,
      caption: input.caption,
      version: input.version,
    }),
  );
  return (
    await ApiResult.prepareApi(() =>
      request<ContestEntry>(`/contests/${encodeURIComponent(slug)}/entry`, {
        method: "POST",
        body: form,
      }),
    )()
  ).toDTO() as ApiResultDTO<ContestEntry>;
}
export async function getMyContestPhoto(
  id: string,
  revisionId: string,
): Promise<ApiResultDTO<string>> {
  return (
    await ApiResult.prepareApi(async () => {
      const response = await requestResponse(
        `/contest-entries/me/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/photo`,
      );
      if (response.headers.get("content-type")?.split(";")[0] !== "image/webp")
        throw new Error("Не удалось загрузить фотографию");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Не удалось загрузить фотографию");
      return `data:image/webp;base64,${Buffer.from(bytes).toString("base64")}`;
    })()
  ).toDTO() as ApiResultDTO<string>;
}
async function request<T>(path: string, init: RequestInit = {}) {
  return (await (await requestResponse(path, init)).json()) as T;
}
async function requestResponse(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get("artmate_access_token")?.value;
  const headerStore = await headers();
  // Multer exposes this exact fields object to the API evidence verifier.
  // The normalized photo's checksum is bound to the acceptance on the API.
  const evidenceHeaders =
    init.body instanceof FormData
      ? RequestEvidenceProxyHeaders.create(
          headerStore,
          init.method ?? "POST",
          path,
          JSON.stringify({ payload: init.body.get("payload") }),
          { required: false },
        )
      : {};
  const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:3002"}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(token ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` } : {}),
      ...getForwardedIpHeaders(headerStore),
      ...evidenceHeaders,
      ...(init.method ? apiCsrfHeader : {}),
    },
  });
  if (!response.ok) {
    let message =
      response.status === 401
        ? "Войдите в аккаунт и отправьте работу ещё раз"
        : response.status === 403
          ? "Для отправки работы завершите вход в аккаунт"
          : response.status === 413
            ? "Выберите фотографию до 10 МБ"
            : response.status === 404
              ? "Конкурс или заявка не найдены"
              : init.method
                ? "Не удалось отправить работу. Попробуйте ещё раз"
                : "Не удалось загрузить данные конкурса";
    const body = (await response.json().catch(() => ({}))) as { message?: unknown };
    if (
      [400, 409, 503].includes(response.status) &&
      typeof body.message === "string" &&
      /[а-яА-ЯёЁ]/.test(body.message)
    )
      message = body.message;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return response;
}
