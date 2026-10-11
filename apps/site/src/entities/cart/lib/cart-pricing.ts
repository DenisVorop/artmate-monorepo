import type { Cart } from "../model";

export function getCartPriceBreakdown(cart: Cart) {
  const saleDiscountKopecks = cart.items.reduce(
    (sum, item) =>
      sum +
      Math.max(
        0,
        Math.round((item.originalPrice ?? item.price) * 100) - Math.round(item.price * 100),
      ) *
        item.quantity,
    0,
  );

  return {
    originalSubtotal: (Math.round(cart.subtotal * 100) + saleDiscountKopecks) / 100,
    saleDiscount: saleDiscountKopecks / 100,
  };
}
