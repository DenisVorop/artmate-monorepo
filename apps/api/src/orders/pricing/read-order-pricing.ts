import { rublesToKopecks } from "../../promocodes/promocodes.service";

import {
  assertOrderPricingMatches,
  parseOrderPricingSnapshot,
} from "./pricing-snapshot";

type StoredMoney = { toString(): string };

type PricedOrder = {
  pricingSnapshot: unknown;
  currency: string;
  subtotal: StoredMoney;
  discount: StoredMoney;
  deliveryPrice: StoredMoney;
  total: StoredMoney;
  items: Array<{
    productId: string;
    price: StoredMoney;
    quantity: number;
    lineTotal: StoredMoney;
  }>;
};

export function readOrderPricing(order: PricedOrder) {
  const snapshot = parseOrderPricingSnapshot(order.pricingSnapshot);
  if (order.currency !== snapshot.currency) {
    throw new TypeError("Order pricing currency does not match order");
  }
  assertOrderPricingMatches(snapshot, {
    subtotalKopecks: rublesToKopecks(order.subtotal),
    discountKopecks: rublesToKopecks(order.discount),
    deliveryKopecks: rublesToKopecks(order.deliveryPrice),
    totalKopecks: rublesToKopecks(order.total),
    items: order.items.map((item) => ({
      id: item.productId,
      unitPriceKopecks: rublesToKopecks(item.price),
      quantity: item.quantity,
      lineTotalKopecks: rublesToKopecks(item.lineTotal),
    })),
  });
  return snapshot;
}
