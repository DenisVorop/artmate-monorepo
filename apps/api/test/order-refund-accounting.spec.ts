import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allocateIncrementalRefund,
  getAffiliateCommissionStatus,
} from "../src/orders/refunds/refund-accounting";

describe("allocateIncrementalRefund", () => {
  const groups = [
    { unitPriceKopecks: 34, quantity: 1 },
    { unitPriceKopecks: 33, quantity: 2 },
  ];

  it("uses persisted receipt group order without rounding drift", () => {
    assert.deepEqual(allocateIncrementalRefund(groups, 0, 1), {
      amountKopecks: 34,
      remainingPriceGroups: [{ unitPriceKopecks: 33, quantity: 2 }],
    });
    assert.deepEqual(allocateIncrementalRefund(groups, 1, 1), {
      amountKopecks: 33,
      remainingPriceGroups: [{ unitPriceKopecks: 33, quantity: 1 }],
    });
    assert.deepEqual(allocateIncrementalRefund(groups, 2, 1), {
      amountKopecks: 33,
      remainingPriceGroups: [],
    });
  });

  it("allows real zero-price item returns and rejects excess quantities", () => {
    assert.deepEqual(
      allocateIncrementalRefund([{ unitPriceKopecks: 0, quantity: 2 }], 0, 1),
      {
        amountKopecks: 0,
        remainingPriceGroups: [{ unitPriceKopecks: 0, quantity: 1 }],
      },
    );
    assert.throws(() => allocateIncrementalRefund(groups, 2, 2));
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
