"use server";

import { cookies, headers } from "next/headers";

import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";
import type { ActionResult } from "@/shared/lib/action-result";

import type {
  AffiliateCodeDTO,
  AffiliateCodesListParamsDTO,
  AffiliateCodesPageDTO,
  AffiliateContractRevisionDTO,
  AffiliatePartnerDTO,
  AffiliatePartnerAnalyticsDTO,
  AffiliatePartnerAnalyticsParamsDTO,
  AffiliatePartnerLedgerDTO,
  AffiliatePartnerLedgerParamsDTO,
  AffiliatePayoutDTO,
  AffiliatePayoutListDTO,
  AffiliatePartnerPayoutsParamsDTO,
  AffiliatePartnersListParamsDTO,
  AffiliatePartnersPageDTO,
  UpdateAffiliatePartnerInputDTO,
  UpdateAffiliateCodeInputDTO,
  RecordAffiliatePayoutInputDTO,
  RejectAffiliatePayoutInputDTO,
} from "./affiliate-partners.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export async function getAffiliatePartners(
  params: AffiliatePartnersListParamsDTO,
): Promise<AffiliatePartnersPageDTO> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  return requestAdminApi(`/affiliate/admin/partners?${searchParams}`);
}

export async function getAffiliatePartner(userId: string) {
  return requestAdminApi<AffiliatePartnerDTO>(
    `/affiliate/admin/partners/${encodeURIComponent(userId)}`,
  );
}

export async function getAffiliatePartnerHistory(userId: string) {
  return requestAdminApi<AffiliateContractRevisionDTO[]>(
    `/affiliate/admin/partners/${encodeURIComponent(userId)}/history`,
  );
}

export async function getAffiliatePartnerCodes(
  userId: string,
  params: AffiliateCodesListParamsDTO,
) {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  return requestAdminApi<AffiliateCodesPageDTO>(
    `/affiliate/admin/partners/${encodeURIComponent(userId)}/codes?${searchParams}`,
  );
}

export async function getAffiliatePartnerAnalytics(
  userId: string,
  params: AffiliatePartnerAnalyticsParamsDTO,
) {
  const searchParams = new URLSearchParams({
    days: String(params.days),
    codePage: String(params.codePage),
    codePageSize: String(params.codePageSize),
  });

  return requestAdminApi<AffiliatePartnerAnalyticsDTO>(
    `/affiliate/admin/partners/${encodeURIComponent(userId)}/analytics?${searchParams}`,
  );
}

export async function getAffiliatePartnerLedger(
  userId: string,
  params: AffiliatePartnerLedgerParamsDTO,
) {
  const searchParams = new URLSearchParams({
    days: String(params.days),
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  return requestAdminApi<AffiliatePartnerLedgerDTO>(
    `/affiliate/admin/partners/${encodeURIComponent(userId)}/ledger?${searchParams}`,
  );
}

export async function getAffiliatePartnerPayouts(
  userId: string,
  params: AffiliatePartnerPayoutsParamsDTO,
) {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  return requestAdminApi<AffiliatePayoutListDTO>(
    `/affiliate/admin/partners/${encodeURIComponent(userId)}/payouts?${searchParams}`,
  );
}

export async function markAffiliatePartnerPayoutPaid(
  userId: string,
  payoutId: string,
  input: RecordAffiliatePayoutInputDTO,
): Promise<ActionResult<AffiliatePayoutDTO>> {
  return payoutMutation(
    `/affiliate/admin/partners/${encodeURIComponent(userId)}/payouts/${encodeURIComponent(payoutId)}/paid`,
    input,
  );
}

export async function rejectAffiliatePartnerPayout(
  userId: string,
  payoutId: string,
  input: RejectAffiliatePayoutInputDTO,
): Promise<ActionResult<AffiliatePayoutDTO>> {
  return payoutMutation(
    `/affiliate/admin/partners/${encodeURIComponent(userId)}/payouts/${encodeURIComponent(payoutId)}/reject`,
    input,
  );
}

async function payoutMutation(
  path: string,
  input: RecordAffiliatePayoutInputDTO | RejectAffiliatePayoutInputDTO,
): Promise<ActionResult<AffiliatePayoutDTO>> {
  try {
    return {
      ok: true,
      data: await requestAdminApi<AffiliatePayoutDTO>(path, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Request failed",
      status: error instanceof AdminApiError ? error.status : undefined,
      code: error instanceof AdminApiError ? error.code : undefined,
    };
  }
}

export async function updateAffiliatePartnerCode(
  userId: string,
  codeId: string,
  input: UpdateAffiliateCodeInputDTO,
): Promise<ActionResult<AffiliateCodeDTO>> {
  try {
    return {
      ok: true,
      data: await requestAdminApi<AffiliateCodeDTO>(
        `/affiliate/admin/partners/${encodeURIComponent(userId)}/codes/${encodeURIComponent(codeId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Request failed",
      status: error instanceof AdminApiError ? error.status : undefined,
    };
  }
}

export async function updateAffiliatePartner(
  userId: string,
  input: UpdateAffiliatePartnerInputDTO,
): Promise<ActionResult<AffiliatePartnerDTO>> {
  try {
    return {
      ok: true,
      data: await requestAdminApi<AffiliatePartnerDTO>(
        `/affiliate/admin/partners/${encodeURIComponent(userId)}`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Request failed",
      status: error instanceof AdminApiError ? error.status : undefined,
    };
  }
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const response = await fetch(
    `${process.env.API_BASE_URL ?? defaultApiBaseUrl}${path}`,
    {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(accessToken
          ? {
              cookie: `${authAccessTokenCookieName}=${encodeURIComponent(accessToken)}`,
            }
          : {}),
        ...getForwardedIpHeaders(headerStore),
        ...init.headers,
        ...apiCsrfHeader,
      },
    },
  );

  if (!response.ok) {
    const error = await getResponseError(response);
    throw new AdminApiError(error.message, response.status, error.code);
  }

  return (await response.json()) as T;
}

async function getResponseError(response: Response) {
  const fallback = `Affiliate partners API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { code?: unknown; message?: unknown };
    return {
      code: typeof body.code === "string" ? body.code : undefined,
      message:
        typeof body.message === "string"
          ? body.message
          : Array.isArray(body.message)
            ? body.message.join(", ")
            : fallback,
    };
  } catch {
    return { message: fallback };
  }
}
