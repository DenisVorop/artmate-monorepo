"use server";

import { cookies, headers } from "next/headers";
import { RequestEvidenceProxyHeaders } from "@/shared/lib/request-evidence-proxy-headers";

import { getAuthSession } from "@/shared/actions/auth";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import type {
  EmailSubscriptionDTO,
  GrantEmailSubscriptionInputDTO,
  UnsubscribeEmailInputDTO,
  UnsubscribeEmailResultDTO,
} from "./consents.types";

const subscriptionPath = "/consents/email-advertising";

export async function getEmailSubscription(
  ownerId: string,
): Promise<ApiResultDTO<EmailSubscriptionDTO>> {
  return (
    await ApiResult.prepareApi(() => _requestSubscription(ownerId, "read"))()
  ).toDTO() as ApiResultDTO<EmailSubscriptionDTO>;
}

export async function revokeEmailSubscription(
  ownerId: string,
): Promise<ApiResultDTO<EmailSubscriptionDTO>> {
  return (
    await ApiResult.prepareApi(() => _requestSubscription(ownerId, "revoke"))()
  ).toDTO() as ApiResultDTO<EmailSubscriptionDTO>;
}

export async function grantEmailSubscription(
  ownerId: string,
  input: GrantEmailSubscriptionInputDTO,
): Promise<ApiResultDTO<EmailSubscriptionDTO>> {
  return (
    await ApiResult.prepareApi(() => _requestSubscription(ownerId, "grant", input))()
  ).toDTO() as ApiResultDTO<EmailSubscriptionDTO>;
}

/** Public revoke-only capability: never forward the browser session or its other cookies. */
export async function unsubscribeEmail(
  input: UnsubscribeEmailInputDTO,
): Promise<ApiResultDTO<UnsubscribeEmailResultDTO>> {
  return (
    await ApiResult.prepareApi(async () => {
      const headerStore = await headers();
      return _request<UnsubscribeEmailResultDTO>(`${subscriptionPath}/unsubscribe/confirm`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: getForwardedIpHeaders(headerStore),
      });
    })()
  ).toDTO() as ApiResultDTO<UnsubscribeEmailResultDTO>;
}

async function _requestSubscription(
  ownerId: string,
  action: "read" | "grant" | "revoke",
  input?: GrantEmailSubscriptionInputDTO,
) {
  const session = ApiResult.fromDTO(await getAuthSession()).data;
  if (!ownerId || session?.user?.id !== ownerId) {
    throw Object.assign(new Error("Войдите в аккаунт, чтобы изменить подписку."), { status: 401 });
  }
  const cookieStore = await cookies();
  const headerStore = await headers();
  const token = cookieStore.get("artmate_access_token")?.value;
  return _request<EmailSubscriptionDTO>(
    `${subscriptionPath}${action === "read" ? "" : `/${action}`}`,
    {
      method: action === "read" ? "GET" : "POST",
      ...(action === "grant"
        ? { body: JSON.stringify(input) }
        : action === "revoke"
          ? { body: "{}" }
          : {}),
      headers: {
        ...getForwardedIpHeaders(headerStore),
        ...(token ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` } : {}),
      },
    },
    action === "grant",
  );
}

async function _request<Result>(
  path: string,
  init: RequestInit,
  evidenceRequired = false,
): Promise<Result> {
  const evidenceHeaders =
    init.method === "POST"
      ? RequestEvidenceProxyHeaders.create(
          await headers(),
          "POST",
          path,
          typeof init.body === "string" ? init.body : "",
          { required: evidenceRequired ? true : false },
        )
      : {};
  const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:3002"}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...init.headers,
      ...apiCsrfHeader,
      ...evidenceHeaders,
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error("Не удалось обновить подписку. Попробуйте ещё раз."), {
      status: response.status,
    });
  }
  return response.json() as Promise<Result>;
}
