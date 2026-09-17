export const affiliatePartnerStatuses = ["active", "suspended"] as const;

export type AffiliatePartnerStatus = (typeof affiliatePartnerStatuses)[number];

export const defaultMinimumPayoutKopecks = 500_000;
export const affiliateCodeLimit = 3;

export const strictIsoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
