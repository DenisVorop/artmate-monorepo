export type PromoEligibilityInput = {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  minSubtotalKopecks: number;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  usedCount: number;
  reservedCount: number;
};

export function getPromoIneligibilityMessage(
  promo: PromoEligibilityInput,
  input: {
    now: Date;
    subtotalKopecks: number;
    userId?: string;
    userRedemptionCount?: number;
  },
) {
  const campaignMessage = getPromoCampaignIneligibilityMessage(promo, input.now);
  if (campaignMessage) return campaignMessage;
  if (input.subtotalKopecks < promo.minSubtotalKopecks) {
    return "Сумма заказа меньше минимальной для этого промокода";
  }
  if (
    promo.maxUses !== null &&
    promo.usedCount + promo.reservedCount >= promo.maxUses
  ) {
    return "Лимит применений промокода исчерпан";
  }
  if (promo.maxUsesPerUser !== null) {
    if (!input.userId) return "Для применения этого промокода необходимо войти";
    if ((input.userRedemptionCount ?? 0) >= promo.maxUsesPerUser) {
      return "Ваш лимит применений промокода исчерпан";
    }
  }
  return undefined;
}

export function getPromoCampaignIneligibilityMessage(
  promo: Pick<
    PromoEligibilityInput,
    | "endsAt"
    | "isActive"
    | "maxUses"
    | "reservedCount"
    | "startsAt"
    | "usedCount"
  >,
  now: Date,
) {
  if (!promo.isActive) return "Промокод неактивен";
  if (promo.startsAt && now < promo.startsAt)
    return "Срок действия промокода еще не начался";
  if (promo.endsAt && now >= promo.endsAt)
    return "Срок действия промокода истек";
  if (
    promo.maxUses !== null &&
    promo.usedCount + promo.reservedCount >= promo.maxUses
  ) {
    return "Лимит применений промокода исчерпан";
  }
  return undefined;
}
