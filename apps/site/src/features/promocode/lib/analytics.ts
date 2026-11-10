import type { PromoPreview } from "@/entities/promocode";
import {
  createAnalytics,
  createGoalCommand,
  createInteractionCommand,
} from "@/shared/lib/analytics";

export type PromoApplyAttempt = {
  attemptKey: string;
  cartId: string;
  code: string;
};

const analytics = createAnalytics({
  applyFailed: () => createInteractionCommand("promo_apply_error", {}),
  opened: () => createInteractionCommand("promo_open", {}),
  closed: () => createInteractionCommand("promo_close", {}),
  edited: () => createInteractionCommand("promo_edit", {}),
  removed: () => createInteractionCommand("promo_remove", {}),
  submitted: () => createInteractionCommand("promo_apply_request", {}),
  replaced: () => createInteractionCommand("promo_replace_request", {}),
  loginRequested: () => createInteractionCommand("promo_login_request", {}),
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
  applyFailed: () => analytics.send("applyFailed"),
  opened: () => analytics.send("opened"),
  closed: () => analytics.send("closed"),
  edited: () => analytics.send("edited"),
  removed: () => analytics.send("removed"),
  submitted: () => analytics.send("submitted"),
  replaced: () => analytics.send("replaced"),
  loginRequested: () => analytics.send("loginRequested"),
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
