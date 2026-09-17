"use server";

import { requestApi } from "@/shared/lib/server-api";
import { toActionError, type ActionResult } from "@/shared/lib/action-result";

import type {
  AffiliateAnalyticsDaysDTO,
  AffiliateAnalyticsDTO,
  AffiliateCodeDTO,
  AffiliateCodeListDTO,
  AffiliateLedgerDTO,
  AffiliatePartnerDTO,
  CreateAffiliateCodeInputDTO,
  UpdateAffiliateCodeInputDTO,
} from "./affiliate.types";

export async function getAffiliatePartner() {
  return (await requestApi<AffiliatePartnerDTO>("/affiliate/me")).data;
}

export async function getAffiliateCodes(page = 1, pageSize = 20) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return (
    await requestApi<AffiliateCodeListDTO>(
      `/affiliate/codes?${searchParams.toString()}`,
    )
  ).data;
}

export async function getAffiliateAnalytics(
  days: AffiliateAnalyticsDaysDTO = 30,
  codePage = 1,
  codePageSize = 10,
) {
  const searchParams = new URLSearchParams({
    days: String(days),
    codePage: String(codePage),
    codePageSize: String(codePageSize),
  });

  return (
    await requestApi<AffiliateAnalyticsDTO>(
      `/affiliate/analytics?${searchParams.toString()}`,
    )
  ).data;
}

export async function getAffiliateLedger(
  days: AffiliateAnalyticsDaysDTO = 30,
  page = 1,
  pageSize = 20,
) {
  const searchParams = new URLSearchParams({
    days: String(days),
    page: String(page),
    pageSize: String(pageSize),
  });

  return (
    await requestApi<AffiliateLedgerDTO>(
      `/affiliate/ledger?${searchParams.toString()}`,
    )
  ).data;
}

export async function createAffiliateCode(
  input: CreateAffiliateCodeInputDTO,
): Promise<ActionResult<AffiliateCodeDTO>> {
  try {
    const { data } = await requestApi<AffiliateCodeDTO>("/affiliate/codes", {
      body: JSON.stringify(input),
      method: "POST",
    });

    return { data, ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateAffiliateCode(
  codeId: string,
  input: UpdateAffiliateCodeInputDTO,
): Promise<ActionResult<AffiliateCodeDTO>> {
  try {
    const { data } = await requestApi<AffiliateCodeDTO>(
      `/affiliate/codes/${encodeURIComponent(codeId)}`,
      { body: JSON.stringify(input), method: "PATCH" },
    );

    return { data, ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
