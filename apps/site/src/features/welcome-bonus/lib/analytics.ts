import { isWelcomeOfferActive, type WelcomeOffer } from "@/entities/promocode";
import {
  createAnalytics,
  createEcommerceCommand,
  createGoalCommand,
  type AnalyticsPromotion,
} from "@/shared/lib/analytics";

type WelcomePromotionPayload = {
  dayKey: string;
  offer: WelcomeOffer;
};

const promotionId = "welcome-bonus";
const promotionName = "Приветственный бонус";
const promotionPosition = "floating-card";
const moscowDayKeyPattern = /^\d{4}-\d{2}-\d{2}$/u;

const analytics = createAnalytics({
  promotionPresented: (promotion: AnalyticsPromotion, presentationKey: string) =>
    createEcommerceCommand(
      "promoView",
      { promotions: [promotion] },
      { scope: "session", entityKey: presentationKey },
    ),
  promotionClicked: (promotion: AnalyticsPromotion, presentationKey: string) => [
    createEcommerceCommand(
      "promoClick",
      { promotions: [promotion] },
      { scope: "session", entityKey: presentationKey },
    ),
    createGoalCommand("welcome_promo_click", {}, { scope: "session", entityKey: presentationKey }),
  ],
});

const welcomeBonusAnalytics = {
  promotionPresented(payload: WelcomePromotionPayload) {
    const context = getPromotionContext(payload);

    if (context) {
      analytics.send("promotionPresented", context.promotion, context.presentationKey);
    }
  },

  promotionClicked(payload: WelcomePromotionPayload) {
    const context = getPromotionContext(payload);

    if (context) {
      analytics.send("promotionClicked", context.promotion, context.presentationKey);
    }
  },
};

export function useAnalytics() {
  return welcomeBonusAnalytics;
}

function getPromotionContext({ dayKey, offer }: WelcomePromotionPayload) {
  const normalizedDayKey = dayKey.trim();

  if (!moscowDayKeyPattern.test(normalizedDayKey) || !isWelcomeOfferActive(offer)) {
    return null;
  }

  return {
    presentationKey: `${promotionId}:${normalizedDayKey}`,
    promotion: {
      id: promotionId,
      name: promotionName,
      creative: offer.action,
      position: promotionPosition,
    } satisfies AnalyticsPromotion,
  };
}
