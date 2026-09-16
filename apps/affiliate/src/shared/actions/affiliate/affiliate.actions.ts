"use server";

import { requestApi } from "@/shared/lib/server-api";

import type { AffiliatePartnerDTO } from "./affiliate.types";

export async function getAffiliatePartner() {
  return (await requestApi<AffiliatePartnerDTO>("/affiliate/me")).data;
}
