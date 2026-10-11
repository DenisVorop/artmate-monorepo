"use client";

import { useLoyaltyDashboard, useLoyaltyData } from "@/entities/loyalty";
import type { Product } from "@/entities/products";
import { useSession } from "@/entities/session";

export function useProductCashback(product: Product) {
  const { user, isPending } = useSession();
  const overview = useLoyaltyData(user?.id ?? "guest", !!user);
  const member = overview.data?.member;
  const ready = member?.status === "active" && member.historyState === "ready";
  const dashboard = useLoyaltyDashboard(user?.id ?? "guest", !!user && ready);

  if (
    product.isOutOfStock ||
    isPending ||
    (user && (overview.isPending || overview.isError)) ||
    (member && (!ready || dashboard.isPending || dashboard.isError))
  ) {
    return undefined;
  }

  const reward = member
    ? product.loyaltyRewards?.find((item) => item.ratePercent === dashboard.data?.tier?.ratePercent)
    : product.loyaltyRewards?.[0];

  return reward && reward.points > 0 ? { ...reward, enrolled: !!member } : undefined;
}
