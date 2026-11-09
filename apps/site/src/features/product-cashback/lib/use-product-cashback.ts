"use client";

import { useLoyaltyDashboard, useLoyaltyData } from "@/entities/loyalty";
import type { Product } from "@/entities/products";

export function useSignedInProductCashback(product: Product, userId: string) {
  const overview = useLoyaltyData(userId, true);
  const member = overview.data?.member;
  const ready = member?.status === "active" && member.historyState === "ready";
  const dashboard = useLoyaltyDashboard(userId, ready);

  if (
    overview.isPending ||
    overview.isError ||
    (member && (!ready || dashboard.isPending || dashboard.isError))
  ) {
    return undefined;
  }

  const reward = member
    ? product.loyaltyRewards?.find((item) => item.ratePercent === dashboard.data?.tier?.ratePercent)
    : product.loyaltyRewards?.[0];

  return reward?.points;
}
