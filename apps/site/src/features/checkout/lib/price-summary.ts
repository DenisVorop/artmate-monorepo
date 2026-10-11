import { getCartPriceBreakdown, type Cart } from "@/entities/cart";
import type { PromoPreview } from "@/entities/promocode";

import type { CheckoutCalculationState } from "./calculation-state";

export function getCheckoutPriceSummary(
  cart: Cart,
  state: CheckoutCalculationState,
  promoPreview?: PromoPreview,
) {
  const { originalSubtotal, saleDiscount } = getCartPriceBreakdown(cart);
  const calculation = state.status === "ready" ? state.calculation : undefined;
  const loyaltyDiscount = calculation ? calculation.loyalty.discountKopecks / 100 : 0;
  const promoDiscount = calculation
    ? Math.max(0, Math.round(calculation.discount * 100) - calculation.loyalty.discountKopecks) /
      100
    : (promoPreview?.discount ?? 0);

  return {
    originalSubtotal: calculation
      ? (Math.round(calculation.subtotal * 100) + Math.round(saleDiscount * 100)) / 100
      : originalSubtotal,
    saleDiscount,
    promoDiscount,
    promoCode: calculation?.promoCode ?? promoPreview?.code,
    loyaltyDiscount,
    pointsToSpend: calculation?.loyalty.pointsToSpend ?? 0,
    totalDiscount:
      (Math.round((saleDiscount + promoDiscount) * 100) + Math.round(loyaltyDiscount * 100)) / 100,
    amount: calculation?.total ?? promoPreview?.total ?? cart.subtotal,
    includesDelivery: Boolean(calculation),
  };
}
