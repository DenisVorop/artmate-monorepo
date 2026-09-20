import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyLoyaltyPoints,
  getMaxLoyaltyPoints,
} from "../src/orders/pricing/apply-loyalty-points";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import { calculatePromoPricing } from "../src/promocodes/pricing";

import {
  allocateIncrementalRefund,
  getAffiliateCommissionStatus,
} from "../src/orders/refunds/refund-accounting";

describe("allocateIncrementalRefund", () => {
  const groups = [
    { unitPriceKopecks: 34, quantity: 1, loyaltyPointsPerUnit: 0 },
    { unitPriceKopecks: 33, quantity: 2, loyaltyPointsPerUnit: 0 },
  ];

  it("uses persisted receipt group order without rounding drift", () => {
    assert.deepEqual(allocateIncrementalRefund(groups, 0, 1), {
      amountKopecks: 34,
      loyaltyPoints: 0,
      remainingPriceGroups: [
        { unitPriceKopecks: 33, quantity: 2, loyaltyPointsPerUnit: 0 },
      ],
    });
    assert.deepEqual(allocateIncrementalRefund(groups, 1, 1), {
      amountKopecks: 33,
      loyaltyPoints: 0,
      remainingPriceGroups: [
        { unitPriceKopecks: 33, quantity: 1, loyaltyPointsPerUnit: 0 },
      ],
    });
    assert.deepEqual(allocateIncrementalRefund(groups, 2, 1), {
      amountKopecks: 33,
      loyaltyPoints: 0,
      remainingPriceGroups: [],
    });
  });

  it("allows real zero-price item returns and rejects excess quantities", () => {
    assert.deepEqual(
      allocateIncrementalRefund(
        [{ unitPriceKopecks: 0, quantity: 2, loyaltyPointsPerUnit: 0 }],
        0,
        1,
      ),
      {
        amountKopecks: 0,
        loyaltyPoints: 0,
        remainingPriceGroups: [
          { unitPriceKopecks: 0, quantity: 1, loyaltyPointsPerUnit: 0 },
        ],
      },
    );
    assert.throws(() => allocateIncrementalRefund(groups, 2, 2));
  });

  it("selects money and points from the same units across group boundaries", () => {
    const priceGroups = [
      { unitPriceKopecks: 140, quantity: 2, loyaltyPointsPerUnit: 3 },
      { unitPriceKopecks: 160, quantity: 2, loyaltyPointsPerUnit: 2 },
    ];
    assert.deepEqual(allocateIncrementalRefund(priceGroups, 1, 2), {
      amountKopecks: 300,
      loyaltyPoints: 5,
      remainingPriceGroups: [
        { unitPriceKopecks: 160, quantity: 1, loyaltyPointsPerUnit: 2 },
      ],
    });
    const exhausted = allocateIncrementalRefund(priceGroups, 4, 0);
    assert.deepEqual(exhausted, {
      amountKopecks: 0,
      loyaltyPoints: 0,
      remainingPriceGroups: [],
    });
    const projection = allocateIncrementalRefund(priceGroups, 1, 0);
    assert.equal(projection.loyaltyPoints, 0);
    assert.equal(projection.amountKopecks, 0);
    assert.deepEqual(projection.remainingPriceGroups[0], {
      ...priceGroups[0],
      quantity: 1,
    });
    assert.equal(priceGroups[0]!.quantity, 2);
  });

  it("preserves every point and kopeck through sequential partial returns", () => {
    for (const promo of [0, 1, 17, 59]) {
      const base = createOrderPricingSnapshot(
        calculatePromoPricing(
          [
            { id: "a", unitPriceKopecks: 281, quantity: 3 },
            { id: "b", unitPriceKopecks: 342, quantity: 4 },
          ],
          { type: "fixed", amountKopecks: promo },
        ),
        123,
      );
      for (let points = 0; points <= getMaxLoyaltyPoints(base); points += 1) {
        const pricing = applyLoyaltyPoints(base, points);
        let totalCash = 0;
        let totalPoints = 0;
        for (const item of pricing.items) {
          let cash = 0;
          let restoredPoints = 0;
          for (let returned = 0; returned < item.quantity; returned += 1) {
            const allocation = allocateIncrementalRefund(
              item.priceGroups,
              returned,
              1,
            );
            cash += allocation.amountKopecks;
            restoredPoints += allocation.loyaltyPoints;
            const prefix = allocateIncrementalRefund(
              item.priceGroups,
              0,
              returned + 1,
            );
            assert.equal(prefix.amountKopecks, cash);
            assert.equal(prefix.loyaltyPoints, restoredPoints);
            const remaining = allocateIncrementalRefund(
              allocation.remainingPriceGroups,
              0,
              item.quantity - returned - 1,
            );
            assert.equal(cash + remaining.amountKopecks, item.totalKopecks);
            assert.equal(
              restoredPoints + remaining.loyaltyPoints,
              item.loyaltyPoints,
            );
          }
          assert.equal(cash, item.totalKopecks);
          assert.equal(restoredPoints, item.loyaltyPoints);
          totalCash += cash;
          totalPoints += restoredPoints;
        }
        assert.equal(totalCash, pricing.itemsTotalKopecks);
        assert.equal(totalCash + pricing.deliveryKopecks, pricing.totalKopecks);
        assert.equal(totalPoints, points);
      }
    }
  });

  it("rejects malformed points, unsafe totals and excess previous returns", () => {
    for (const points of [
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      undefined,
    ]) {
      assert.throws(
        () =>
          allocateIncrementalRefund(
            [
              {
                unitPriceKopecks: 100,
                quantity: 1,
                loyaltyPointsPerUnit: points as number,
              },
            ],
            0,
            1,
          ),
        /Refund unit loyalty points/,
      );
    }
    for (const values of [
      { unitPriceKopecks: Number.MAX_SAFE_INTEGER, loyaltyPointsPerUnit: 0 },
      { unitPriceKopecks: 0, loyaltyPointsPerUnit: Number.MAX_SAFE_INTEGER },
    ]) {
      assert.throws(
        () => allocateIncrementalRefund([{ ...values, quantity: 2 }], 0, 2),
        /safe integer range/,
      );
      const single = allocateIncrementalRefund(
        [{ ...values, quantity: 1 }],
        0,
        1,
      );
      assert.equal(single.amountKopecks, values.unitPriceKopecks);
      assert.equal(single.loyaltyPoints, values.loyaltyPointsPerUnit);
    }
    assert.throws(
      () => allocateIncrementalRefund(groups, 4, 0),
      /exceeds purchased quantity/,
    );
    for (const quantity of [-1, 0.5, NaN, Infinity]) {
      assert.throws(() => allocateIncrementalRefund(groups, quantity, 0));
      assert.throws(() => allocateIncrementalRefund(groups, 0, quantity));
    }
  });
});

describe("getAffiliateCommissionStatus", () => {
  const availableAt = new Date("2026-09-15T00:00:00.000Z");

  it("derives readiness from current paid and completed state", () => {
    assert.equal(
      getAffiliateCommissionStatus({
        availableAt,
        completedAt: new Date("2026-09-01T00:00:00.000Z"),
        earnedKopecks: 100,
        isCompleted: true,
        isCancelled: false,
        isPaid: true,
        now: new Date("2026-09-15T00:00:00.000Z"),
        reversedKopecks: 0,
      }),
      "available",
    );
    assert.equal(
      getAffiliateCommissionStatus({
        availableAt,
        completedAt: new Date("2026-09-01T00:00:00.000Z"),
        earnedKopecks: 100,
        isCompleted: false,
        isCancelled: false,
        isPaid: true,
        now: new Date("2026-09-16T00:00:00.000Z"),
        reversedKopecks: 0,
      }),
      "held",
    );
  });

  it("prioritizes zero earnings and full reversal", () => {
    assert.equal(
      getAffiliateCommissionStatus({
        availableAt: null,
        completedAt: null,
        earnedKopecks: 0,
        isCompleted: false,
        isCancelled: false,
        isPaid: true,
        now: new Date(),
        reversedKopecks: 0,
      }),
      "not_earned",
    );
    assert.equal(
      getAffiliateCommissionStatus({
        availableAt,
        completedAt: new Date(),
        earnedKopecks: 100,
        isCompleted: true,
        isCancelled: false,
        isPaid: true,
        now: new Date(),
        reversedKopecks: 100,
      }),
      "reversed",
    );
    assert.equal(
      getAffiliateCommissionStatus({
        availableAt: null,
        completedAt: null,
        earnedKopecks: 100,
        isCancelled: true,
        isCompleted: false,
        isPaid: true,
        now: new Date(),
        reversedKopecks: 0,
      }),
      "held",
    );
  });
});
