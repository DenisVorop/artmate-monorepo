import type { Prisma } from "../../generated/prisma/client";

/** Contests reads and freezes these terms; only promocodes issues personal codes. */
export const promoPrizeTemplateSelect = {
  id: true,
  name: true,
  kind: true,
  isActive: true,
  type: true,
  basisPoints: true,
  amountKopecks: true,
  maxDiscountKopecks: true,
  minSubtotalKopecks: true,
  startsAt: true,
  endsAt: true,
} satisfies Prisma.PromoCodeSelect;

export type PromoPrizeTerms = {
  name: string;
  type: "PERCENTAGE" | "FIXED";
  basisPoints: number | null;
  amountKopecks: number | null;
  maxDiscountKopecks: number | null;
  minSubtotalKopecks: number;
  startsAt: string | null;
  endsAt: string | null;
};

export function mapPromoPrizeTerms(
  promo: Prisma.PromoCodeGetPayload<{
    select: typeof promoPrizeTemplateSelect;
  }>,
): PromoPrizeTerms {
  return {
    name: promo.name,
    type: promo.type,
    basisPoints: promo.basisPoints,
    amountKopecks:
      promo.amountKopecks === null ? null : Number(promo.amountKopecks),
    maxDiscountKopecks:
      promo.maxDiscountKopecks === null
        ? null
        : Number(promo.maxDiscountKopecks),
    minSubtotalKopecks: Number(promo.minSubtotalKopecks),
    startsAt: promo.startsAt?.toISOString() ?? null,
    endsAt: promo.endsAt?.toISOString() ?? null,
  };
}
