import type { Cart } from "@/entities/cart";

export const promoCodePattern = /^[A-Z0-9_-]{3,40}$/;

export function normalizePromoCode(value: string) {
  return value
    .trim()
    .replace(/[a-z]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 32));
}

export function parsePromoCode(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const code = normalizePromoCode(value);

  return promoCodePattern.test(code) ? code : undefined;
}

export function getCartPricingSignature(cart: Cart) {
  return JSON.stringify({
    cartId: cart.id,
    items: [...cart.items]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, price, quantity }) => [id, price, quantity]),
  });
}
