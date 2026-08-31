import type { WelcomeOffer } from "../model/types";

export function isWelcomeOfferActive(offer: WelcomeOffer, now = Date.now()) {
  if (!offer.endsAt) {
    return true;
  }

  const endsAt = Date.parse(offer.endsAt);
  return Number.isFinite(endsAt) && endsAt > now;
}
