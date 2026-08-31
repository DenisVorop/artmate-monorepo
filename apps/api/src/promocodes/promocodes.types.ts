export const promoCodeTypes = ["percentage", "fixed"] as const;
export type PromoCodeType = (typeof promoCodeTypes)[number];

export const promoCodeKinds = ["standard", "welcome"] as const;
export type PromoCodeKind = (typeof promoCodeKinds)[number];

export const promoRedemptionStatuses = [
  "reserved",
  "used",
  "released",
] as const;
export type PromoRedemptionStatus = (typeof promoRedemptionStatuses)[number];

export type PromoTerms = {
  code: string;
  kind: PromoCodeKind;
  type: PromoCodeType;
  basisPoints: number | null;
  amountKopecks: number | null;
  maxDiscountKopecks: number | null;
  minSubtotalKopecks: number;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  isActive: boolean;
};
