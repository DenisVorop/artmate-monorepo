import { kopecksToRubles } from "../promocodes/promocodes.service";

import type { AdminOrderDiscountDTO } from "./dto/admin-order-discount.dto";
import { readOrderPricing } from "./pricing/read-order-pricing";

export function getAdminOrderDiscount(
  order: Parameters<typeof readOrderPricing>[0],
): AdminOrderDiscountDTO | null {
  if (order.pricingSnapshot == null) return null;

  const snapshot = readOrderPricing(order);
  return {
    promoDiscount: Number(kopecksToRubles(snapshot.promoDiscountKopecks)),
    loyaltyDiscount: Number(kopecksToRubles(snapshot.loyaltyDiscountKopecks)),
    loyaltyPoints: snapshot.items.reduce(
      (total, item) => total + item.loyaltyPoints,
      0,
    ),
  };
}
