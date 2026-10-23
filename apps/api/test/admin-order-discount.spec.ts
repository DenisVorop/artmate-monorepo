import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { getAdminOrderDiscount } from "../src/orders/admin-order-discount";
import { AdminOrderDiscountDTO } from "../src/orders/dto/admin-order-discount.dto";
import { applyLoyaltyPoints } from "../src/orders/pricing/apply-loyalty-points";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { calculatePromoPricing } from "../src/promocodes/pricing";

function order(promo: boolean, points: number, quantity = 1) {
  const pricingSnapshot = applyLoyaltyPoints(
    createOrderPricingSnapshot(
      calculatePromoPricing(
        [{ id: "album", unitPriceKopecks: 70000, quantity }],
        promo
          ? { type: "percentage", basisPoints: 2000 }
          : { type: "fixed", amountKopecks: 0 },
      ),
      10000,
    ),
    points,
  );
  return {
    pricingSnapshot,
    currency: "RUB",
    subtotal: String(700 * quantity),
    discount: String(pricingSnapshot.discountKopecks / 100),
    deliveryPrice: "100",
    total: String(pricingSnapshot.totalKopecks / 100),
    items: [
      {
        productId: "album",
        price: "700",
        quantity,
        lineTotal: String(700 * quantity),
      },
    ],
  };
}

for (const [name, input, expected] of [
  [
    "mixed promo and points",
    order(true, 525),
    { promoDiscount: 140, loyaltyDiscount: 105, loyaltyPoints: 525 },
  ],
  [
    "points only, including kopecks",
    order(false, 1151, 2),
    { promoDiscount: 0, loyaltyDiscount: 230.2, loyaltyPoints: 1151 },
  ],
  [
    "promo only",
    order(true, 0),
    { promoDiscount: 140, loyaltyDiscount: 0, loyaltyPoints: 0 },
  ],
  [
    "no discount",
    order(false, 0),
    { promoDiscount: 0, loyaltyDiscount: 0, loyaltyPoints: 0 },
  ],
] as const) {
  test(`admin discount reads the saved ${name} without modifying the order`, () => {
    const before = structuredClone(input);
    assert.deepEqual(getAdminOrderDiscount(input), expected);
    assert.deepEqual(input, before);
  });
}

test("missing saved pricing is explicit, never inferred from total discount", () => {
  assert.equal(
    getAdminOrderDiscount({ ...order(true, 525), pricingSnapshot: null }),
    null,
  );
});

test("invalid or inconsistent saved pricing is not displayed as a valid breakdown", () => {
  assert.throws(() =>
    getAdminOrderDiscount({ ...order(true, 525), pricingSnapshot: {} }),
  );
  assert.throws(() =>
    getAdminOrderDiscount({ ...order(true, 525), discount: "999" }),
  );
});

test("admin discount DTO validates amounts and integral nonnegative points", async () => {
  assert.equal(
    (
      await validate(
        plainToInstance(
          AdminOrderDiscountDTO,
          getAdminOrderDiscount(order(true, 525)),
        ),
      )
    ).length,
    0,
  );
  for (const patch of [
    { promoDiscount: -1 },
    { loyaltyDiscount: NaN },
    { loyaltyPoints: -1 },
    { loyaltyPoints: 1.5 },
  ]) {
    assert.ok(
      (
        await validate(
          plainToInstance(AdminOrderDiscountDTO, {
            promoDiscount: 140,
            loyaltyDiscount: 105,
            loyaltyPoints: 525,
            ...patch,
          }),
        )
      ).length > 0,
    );
  }
});
