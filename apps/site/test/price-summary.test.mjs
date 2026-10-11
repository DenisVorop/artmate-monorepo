import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPriceSummary } from "./helpers/price-summary.mjs";

const cart = {
  items: [
    { price: 699, originalPrice: 799, quantity: 2 },
    { price: 499, quantity: 1 },
  ],
  subtotal: 1897,
};
const promo = { code: "SAVE10", discount: 189.7, total: 1707.3 };

test("cart discount compares original prices by quantity and preserves kopecks", async () => {
  const { getCartPriceBreakdown } = await loadPriceSummary();
  assert.deepEqual(getCartPriceBreakdown(cart), { originalSubtotal: 2097, saleDiscount: 200 });
  assert.deepEqual(
    getCartPriceBreakdown({
      subtotal: 0.3,
      items: [{ price: 0.1, originalPrice: 0.2, quantity: 3 }],
    }),
    { originalSubtotal: 0.6, saleDiscount: 0.3 },
  );
  assert.deepEqual(getCartPriceBreakdown({ subtotal: 499, items: [{ price: 499, quantity: 1 }] }), {
    originalSubtotal: 499,
    saleDiscount: 0,
  });
});

test("before delivery and during errors the goods amount remains available", async () => {
  const { getCheckoutPriceSummary } = await loadPriceSummary();
  for (const status of ["idle", "pending", "offline", "error"]) {
    const base = getCheckoutPriceSummary(cart, { status });
    assert.equal(base.amount, 1897);
    assert.equal(base.includesDelivery, false);
    assert.equal(base.totalDiscount, 200);
    const discounted = getCheckoutPriceSummary(cart, { status }, promo);
    assert.equal(discounted.amount, 1707.3);
    assert.equal(discounted.totalDiscount, 389.7);
    assert.equal(discounted.loyaltyDiscount, 0);
    assert.equal(discounted.pointsToSpend, 0);
  }
});

test("confirmed total separates sale, promo and points without subtracting sale twice", async () => {
  const { getCheckoutPriceSummary } = await loadPriceSummary();
  const summary = getCheckoutPriceSummary(
    cart,
    {
      status: "ready",
      calculation: {
        subtotal: 1897,
        discount: 239.7,
        deliveryPrice: 200,
        total: 1857.3,
        promoCode: "SAVE10",
        loyalty: { discountKopecks: 5000, pointsToSpend: 250 },
      },
    },
    { code: "STALE", discount: 1000, total: 897 },
  );
  assert.equal(summary.originalSubtotal, 2097);
  assert.equal(summary.saleDiscount, 200);
  assert.equal(summary.promoDiscount, 189.7);
  assert.equal(summary.loyaltyDiscount, 50);
  assert.equal(summary.totalDiscount, 439.7);
  assert.equal(summary.amount, 1857.3);
  assert.equal(summary.promoCode, "SAVE10");
  assert.equal(summary.includesDelivery, true);
  assert.equal(summary.originalSubtotal - summary.totalDiscount + 200, summary.amount);
});
