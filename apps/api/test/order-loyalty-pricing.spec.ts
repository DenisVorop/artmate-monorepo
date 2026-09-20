import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculatePromoPricing } from "../src/promocodes/pricing";
import {
  createOrderPricingSnapshot,
  parseOrderPricingSnapshot,
  type OrderPricingSnapshot,
} from "../src/orders/pricing/pricing-snapshot";
import {
  applyLoyaltyPoints,
  getMaxLoyaltyPoints,
} from "../src/orders/pricing/apply-loyalty-points";

function basket(
  items: { id: string; unitPriceKopecks: number; quantity: number }[],
  promoKopecks = 0,
  deliveryKopecks = 0,
) {
  return createOrderPricingSnapshot(
    calculatePromoPricing(items, {
      type: "fixed",
      amountKopecks: promoKopecks,
    }),
    deliveryKopecks,
  );
}

describe("loyalty pricing", () => {
  it("uses capacity weighted allocation and splits quantities nearly equally", () => {
    const base = basket(
      [
        { id: "a", unitPriceKopecks: 200, quantity: 3 },
        { id: "b", unitPriceKopecks: 140, quantity: 2 },
      ],
      0,
      375,
    );
    assert.equal(getMaxLoyaltyPoints(base), 19);
    const result = applyLoyaltyPoints(base, 10);
    assert.deepEqual(
      result.items.map((item) => item.loyaltyPoints),
      [8, 2],
    );
    assert.deepEqual(result.items[0]!.priceGroups, [
      {
        quantity: 2,
        unitPriceKopecks: 140,
        promoDiscountPerUnitKopecks: 0,
        loyaltyPointsPerUnit: 3,
        totalKopecks: 280,
      },
      {
        quantity: 1,
        unitPriceKopecks: 160,
        promoDiscountPerUnitKopecks: 0,
        loyaltyPointsPerUnit: 2,
        totalKopecks: 160,
      },
    ]);
    assert.equal(result.deliveryKopecks, 375);
    assert.equal(result.loyaltyDiscountKopecks, 200);
    assert.equal(result.discountKopecks, 200);
    assert.equal(result.itemsTotalKopecks, 680);
    assert.equal(result.totalKopecks, 1_055);
    assert.deepEqual(
      parseOrderPricingSnapshot(JSON.parse(JSON.stringify(result))),
      result,
    );
  });

  it("preserves odd cents and promo groups while combining discounts", () => {
    const base = basket(
      [{ id: "a", unitPriceKopecks: 203, quantity: 3 }],
      1,
      99,
    );
    assert.deepEqual(
      base.items[0]!.priceGroups.map((g) => g.unitPriceKopecks),
      [203, 202],
    );
    const result = applyLoyaltyPoints(base, 4);
    assert.deepEqual(result.items[0]!.priceGroups, [
      {
        quantity: 1,
        unitPriceKopecks: 163,
        promoDiscountPerUnitKopecks: 0,
        loyaltyPointsPerUnit: 2,
        totalKopecks: 163,
      },
      {
        quantity: 1,
        unitPriceKopecks: 183,
        promoDiscountPerUnitKopecks: 0,
        loyaltyPointsPerUnit: 1,
        totalKopecks: 183,
      },
      {
        quantity: 1,
        unitPriceKopecks: 182,
        promoDiscountPerUnitKopecks: 1,
        loyaltyPointsPerUnit: 1,
        totalKopecks: 182,
      },
    ]);
    assert.equal(result.subtotalKopecks, 609);
    assert.equal(result.promoDiscountKopecks, 1);
    assert.equal(result.discountKopecks, 81);
    assert.equal(result.itemsTotalKopecks, 528);
    assert.equal(result.totalKopecks, 627);
    assert.equal(result.items[0]!.unitPriceKopecks, 203);
    assert.equal(result.items[0]!.promoDiscountKopecks, 1);
  });

  it("breaks remainder ties by product id while retaining original product order", () => {
    const base = basket(
      ["z", "a", "m"].map((id) => ({ id, unitPriceKopecks: 120, quantity: 1 })),
    );
    const result = applyLoyaltyPoints(base, 2);
    assert.deepEqual(
      result.items.map((item) => [item.id, item.loyaltyPoints]),
      [
        ["z", 0],
        ["a", 1],
        ["m", 1],
      ],
    );
    const reordered = structuredClone(base);
    reordered.items.reverse();
    const reversedResult = applyLoyaltyPoints(reordered, 2);
    assert.deepEqual(
      reversedResult.items.map((item) => [item.id, item.loyaltyPoints]),
      [
        ["m", 1],
        ["a", 1],
        ["z", 0],
      ],
    );
  });

  it("breaks same-product group ties by original index without reordering or merging", () => {
    const base = basket([{ id: "a", unitPriceKopecks: 121, quantity: 2 }], 1);
    base.items[0]!.priceGroups.reverse();
    assert.deepEqual(
      base.items[0]!.priceGroups.map((g) => g.unitPriceKopecks),
      [120, 121],
    );
    const result = applyLoyaltyPoints(base, 1);
    assert.deepEqual(
      result.items[0]!.priceGroups.map((g) => [
        g.unitPriceKopecks,
        g.loyaltyPointsPerUnit,
        g.promoDiscountPerUnitKopecks,
      ]),
      [
        [100, 1, 1],
        [121, 0, 0],
      ],
    );
  });

  it("caps each unit separately at one ruble and never spends on delivery", () => {
    const base = basket(
      [
        { id: "floor", unitPriceKopecks: 100, quantity: 2 },
        { id: "odd", unitPriceKopecks: 119, quantity: 10 },
        { id: "paid", unitPriceKopecks: 141, quantity: 3 },
      ],
      0,
      50_000,
    );
    assert.equal(getMaxLoyaltyPoints(base), 6);
    const result = applyLoyaltyPoints(base, 6);
    assert.deepEqual(
      result.items.map((item) => item.totalKopecks),
      [200, 1_190, 303],
    );
    assert.equal(result.deliveryKopecks, 50_000);
    assert.throws(() => applyLoyaltyPoints(base, 7), /exceed order capacity/);
    const floorOnly = basket(
      [{ id: "floor", unitPriceKopecks: 100, quantity: 1 }],
      0,
      50_000,
    );
    assert.equal(getMaxLoyaltyPoints(floorOnly), 0);
    assert.throws(
      () => applyLoyaltyPoints(floorOnly, 1),
      /exceed order capacity/,
    );
  });

  it("preserves historical sub-ruble semantics for zero points but explicitly rejects redemption", () => {
    for (const price of [0, 1, 99]) {
      const base = basket([
        { id: "low", unitPriceKopecks: price, quantity: 1 },
        { id: "paid", unitPriceKopecks: 500, quantity: 1 },
      ]);
      assert.deepEqual(applyLoyaltyPoints(base, 0), base);
      assert.throws(
        () => getMaxLoyaltyPoints(base),
        /every unit must cost at least 100 kopecks/,
      );
      assert.throws(
        () => applyLoyaltyPoints(base, 1),
        /every unit must cost at least 100 kopecks/,
      );
    }
  });

  it("validates safe, nonnegative, integer points and rejects applying twice", () => {
    const base = basket([{ id: "a", unitPriceKopecks: 500, quantity: 1 }]);
    for (const points of [
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      "1",
      null,
    ]) {
      assert.throws(
        () => applyLoyaltyPoints(base, points as number),
        /nonnegative safe integer/,
      );
    }
    const redeemed = applyLoyaltyPoints(base, 1);
    assert.throws(() => getMaxLoyaltyPoints(redeemed), /already been applied/);
    for (const points of [0, 1]) {
      assert.throws(
        () => applyLoyaltyPoints(redeemed, points),
        /already been applied/,
      );
    }
    const corrupt = structuredClone(base);
    corrupt.totalKopecks += 1;
    assert.throws(() => getMaxLoyaltyPoints(corrupt));
    assert.throws(() => applyLoyaltyPoints(corrupt, 0));
  });

  it("does not mutate frozen inputs, including zero redemption", () => {
    const base = basket([{ id: "a", unitPriceKopecks: 201, quantity: 3 }], 1);
    const before = structuredClone(base);
    for (const item of base.items) {
      item.priceGroups.forEach(Object.freeze);
      Object.freeze(item.priceGroups);
      Object.freeze(item);
    }
    Object.freeze(base.items);
    Object.freeze(base);
    for (const points of [0, 1, 4]) {
      const result = applyLoyaltyPoints(base, points);
      assert.notEqual(result, base);
      assert.notEqual(result.items[0], base.items[0]);
    }
    assert.deepEqual(base, before);
  });

  it("uses exact BigInt products near the safe-integer boundary", () => {
    const max = Number.MAX_SAFE_INTEGER;
    const base = basket([
      { id: "z", unitPriceKopecks: max - 1_000, quantity: 1 },
      { id: "a", unitPriceKopecks: 1_000, quantity: 1 },
    ]);
    const capacity = (BigInt(max - 1_000) - 100n) / 20n + 45n;
    assert.equal(getMaxLoyaltyPoints(base), Number(capacity));
    const result = applyLoyaltyPoints(base, Number(capacity));
    assert.equal(result.totalKopecks, Number(BigInt(max) - capacity * 20n));
    assert.deepEqual(
      result.items.map((item) => item.totalKopecks),
      [111, 100],
    );
    assert.throws(
      () => applyLoyaltyPoints(base, Number(capacity + 1n)),
      /exceed order capacity/,
    );
    const hugeQuantity = Number(BigInt(max) / 120n);
    const many = basket([
      { id: "many", unitPriceKopecks: 120, quantity: hugeQuantity },
    ]);
    assert.equal(getMaxLoyaltyPoints(many), hugeQuantity);
    assert.equal(
      applyLoyaltyPoints(many, hugeQuantity).items[0]!.priceGroups[0]!
        .unitPriceKopecks,
      100,
    );
  });

  it("maintains all invariants for every redemption amount over varied promo baskets", () => {
    for (const promo of [0, 1, 17, 59]) {
      const base = basket(
        [
          { id: "b", unitPriceKopecks: 281, quantity: 3 },
          { id: "a", unitPriceKopecks: 342, quantity: 4 },
        ],
        promo,
        123,
      );
      for (let points = 0; points <= getMaxLoyaltyPoints(base); points += 1) {
        const result: OrderPricingSnapshot = applyLoyaltyPoints(base, points);
        assert.equal(result.loyaltyDiscountKopecks, points * 20);
        assert.equal(result.totalKopecks, base.totalKopecks - points * 20);
        assert.equal(result.promoDiscountKopecks, promo);
        assert.deepEqual(parseOrderPricingSnapshot(result), result);
        for (let index = 0; index < result.items.length; index += 1) {
          const item = result.items[index]!;
          assert.equal(item.quantity, base.items[index]!.quantity);
          assert.equal(
            item.promoDiscountKopecks,
            base.items[index]!.promoDiscountKopecks,
          );
          assert.ok(
            item.priceGroups.length <=
              base.items[index]!.priceGroups.length * 2,
          );
          assert.ok(
            item.priceGroups.every((group) => group.unitPriceKopecks >= 100),
          );
        }
      }
    }
  });
});
