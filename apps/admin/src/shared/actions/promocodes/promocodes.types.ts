export const promoCodeTypes = ["percentage", "fixed"] as const;
export type PromoCodeTypeDTO = (typeof promoCodeTypes)[number];

export type PromoCodeKindDTO = "standard" | "welcome";

export const promoCodeUsageStatuses = ["reserved", "used", "released"] as const;
export type PromoCodeUsageStatusDTO = (typeof promoCodeUsageStatuses)[number];

export type PromoCodeInputDTO = {
  code: string;
  name: string;
  description?: string | null;
  type: PromoCodeTypeDTO;
  basisPoints?: number | null;
  amountKopecks?: number | null;
  maxDiscountKopecks?: number | null;
  minSubtotalKopecks?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  isActive: boolean;
};

export type UpdatePromoCodeInputDTO = Omit<PromoCodeInputDTO, "code"> & {
  code?: string;
};

export type ReleasePromoCodeRedemptionInputDTO = {
  confirmation: "payment_closed_without_charge";
  reason: string;
};

export type PromoCodeMutationResultDTO =
  | { ok: true; data: PromoCodeAdminDTO }
  | { ok: false; error: string; status?: number };

export type PromoCodeUsageDTO = {
  orderId: string;
  status: PromoCodeUsageStatusDTO;
  createdAt: string;
  usedAt: string | null;
};

export type PromoCodeAdminDTO = PromoCodeInputDTO & {
  id: string;
  kind: PromoCodeKindDTO;
  usedCount: number;
  reservedCount: number;
  createdAt: string;
  updatedAt: string;
  usages?: PromoCodeUsageDTO[];
};
