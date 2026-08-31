export type QueryKeyPart = string | number | boolean | null | undefined;

export function createQueryKey(...parts: QueryKeyPart[]) {
  return parts.filter((part) => part !== null && part !== undefined);
}

export const cartPricingQueryKey = ["cart-pricing"] as const;
export const featureBannersQueryKey = ["feature-banners"] as const;
export const welcomeOfferQueryKey = [...cartPricingQueryKey, "welcome-offer"] as const;
export const guestQueryOwner = "guest";

export function getQueryOwner(userId: string | null | undefined) {
  return userId ?? guestQueryOwner;
}
