import type { PromoPreview } from "@/entities/promocode";
import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

export type PromoApplyAttempt = {
  attemptKey: string;
  cartId: string;
  code: string;
};

const analytics = createAnalytics({
  promoApplied: (discount: number, attemptKey: string) =>
    createGoalCommand(
      "promo_apply_success",
      {
        discount,
        currency: "RUB",
      },
      { scope: "memory", entityKey: attemptKey },
    ),
});

const promocodeAnalytics = {
  promoApplied(preview: PromoPreview | undefined, attempt: PromoApplyAttempt | undefined) {
    if (!preview || !attempt) {
      return;
    }

    const attemptKey = attempt.attemptKey.trim();
    const cartId = attempt.cartId.trim();
    const code = attempt.code.trim();

    if (
      !attemptKey ||
      !cartId ||
      !code ||
      preview.cartId.trim() !== cartId ||
      preview.code.trim() !== code ||
      preview.currency !== "RUB" ||
      !Number.isFinite(preview.discount) ||
      preview.discount <= 0
    ) {
      return;
    }

    analytics.send("promoApplied", preview.discount, attemptKey);
  },
};

export function useAnalytics() {
  return promocodeAnalytics;
}
