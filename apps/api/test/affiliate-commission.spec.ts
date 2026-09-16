import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateAffiliateCommission,
  calculateAffiliateCommissionReversal,
  getAffiliateCommissionAvailableAt,
  type AffiliateCommissionSnapshot,
} from "../src/affiliate/commission";

describe("calculateAffiliateCommission", () => {
  it("calculates commission on merchandise before discount", () => {
    assert.deepEqual(
      calculateAffiliateCommission(
        [{ id: "poster", unitPriceKopecks: 100_000, quantity: 1 }],
        10,
      ),
      {
        subtotalKopecks: 100_000,
        commissionKopecks: 10_000,
        items: [
          {
            id: "poster",
            quantity: 1,
            subtotalKopecks: 100_000,
            commissionKopecks: 10_000,
          },
        ],
      },
    );
  });

  it("supports zero commission and suppresses commission for self-purchases", () => {
    const items = [{ id: "a", unitPriceKopecks: 10_000, quantity: 2 }];

    assert.equal(calculateAffiliateCommission(items, 0).commissionKopecks, 0);
    assert.equal(
      calculateAffiliateCommission(items, 15, true).commissionKopecks,
      0,
    );
  });

  it("uses basket rounding and proportional line allocation from promo pricing", () => {
    const result = calculateAffiliateCommission(
      [
        { id: "first", unitPriceKopecks: 3, quantity: 1 },
        { id: "second", unitPriceKopecks: 7, quantity: 1 },
      ],
      15,
    );

    assert.equal(result.commissionKopecks, 2);
    assert.deepEqual(
      result.items.map((item) => item.commissionKopecks),
      [1, 1],
    );
  });

  it("does not mutate inputs", () => {
    const items = [{ id: "a", unitPriceKopecks: 101, quantity: 3 }];
    const before = structuredClone(items);

    calculateAffiliateCommission(items, 10);

    assert.deepEqual(items, before);
  });

  it("rejects invalid rates and item values", () => {
    const valid = [{ id: "a", unitPriceKopecks: 100, quantity: 1 }];

    for (const rate of [-1, 16, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => calculateAffiliateCommission(valid, rate));
    }
    for (const items of [
      [{ id: "", unitPriceKopecks: 100, quantity: 1 }],
      [{ id: "a", unitPriceKopecks: -1, quantity: 1 }],
      [{ id: "a", unitPriceKopecks: 1.5, quantity: 1 }],
      [{ id: "a", unitPriceKopecks: 100, quantity: 0 }],
      [{ id: "a", unitPriceKopecks: 100, quantity: 1.5 }],
      [
        {
          id: "a",
          unitPriceKopecks: 100,
          quantity: Number.MAX_SAFE_INTEGER + 1,
        },
      ],
      [
        { id: "a", unitPriceKopecks: 100, quantity: 1 },
        { id: "a", unitPriceKopecks: 100, quantity: 1 },
      ],
    ]) {
      assert.throws(() => calculateAffiliateCommission(items, 10));
    }
  });
});

describe("calculateAffiliateCommissionReversal", () => {
  const snapshot: AffiliateCommissionSnapshot = {
    subtotalKopecks: 310,
    commissionKopecks: 5,
    items: [
      {
        id: "three-units",
        quantity: 3,
        subtotalKopecks: 300,
        commissionKopecks: 2,
      },
      {
        id: "single-unit",
        quantity: 1,
        subtotalKopecks: 10,
        commissionKopecks: 3,
      },
    ],
  };

  it("reverses partial returns per unit without rounding drift", () => {
    const first = calculateAffiliateCommissionReversal(
      snapshot,
      [],
      [{ id: "three-units", quantity: 1 }],
    );
    const second = calculateAffiliateCommissionReversal(
      snapshot,
      [{ id: "three-units", quantity: 1 }],
      [{ id: "three-units", quantity: 2 }],
    );
    const third = calculateAffiliateCommissionReversal(
      snapshot,
      [{ id: "three-units", quantity: 2 }],
      [{ id: "three-units", quantity: 3 }],
    );

    assert.deepEqual(first, {
      reversedCommissionKopecks: 1,
      remainingCommissionKopecks: 4,
    });
    assert.deepEqual(second, {
      reversedCommissionKopecks: 1,
      remainingCommissionKopecks: 3,
    });
    assert.deepEqual(third, {
      reversedCommissionKopecks: 0,
      remainingCommissionKopecks: 3,
    });
    assert.equal(
      first.reversedCommissionKopecks +
        second.reversedCommissionKopecks +
        third.reversedCommissionKopecks,
      2,
    );
  });

  it("reverses the exact original commission after all items are returned", () => {
    assert.deepEqual(
      calculateAffiliateCommissionReversal(
        snapshot,
        [],
        [
          { id: "three-units", quantity: 3 },
          { id: "single-unit", quantity: 1 },
        ],
      ),
      {
        reversedCommissionKopecks: 5,
        remainingCommissionKopecks: 0,
      },
    );
  });

  it("is idempotent for repeated cumulative state and ignores delivery-only changes", () => {
    const returned = [{ id: "three-units", quantity: 1 }];

    assert.deepEqual(
      calculateAffiliateCommissionReversal(snapshot, returned, returned),
      {
        reversedCommissionKopecks: 0,
        remainingCommissionKopecks: 4,
      },
    );
    assert.deepEqual(calculateAffiliateCommissionReversal(snapshot, [], []), {
      reversedCommissionKopecks: 0,
      remainingCommissionKopecks: 5,
    });
    assert.deepEqual(
      calculateAffiliateCommissionReversal(
        { subtotalKopecks: 0, commissionKopecks: 0, items: [] },
        [],
        [],
      ),
      { reversedCommissionKopecks: 0, remainingCommissionKopecks: 0 },
    );
  });

  it("does not mutate the snapshot or cumulative return lists", () => {
    const previous = [{ id: "three-units", quantity: 1 }];
    const next = [{ id: "three-units", quantity: 2 }];
    const before = structuredClone({ snapshot, previous, next });

    calculateAffiliateCommissionReversal(snapshot, previous, next);

    assert.deepEqual({ snapshot, previous, next }, before);
  });

  it("rejects invalid snapshots", () => {
    const invalidSnapshots: AffiliateCommissionSnapshot[] = [
      { ...snapshot, subtotalKopecks: 309 },
      { ...snapshot, commissionKopecks: 4 },
      { ...snapshot, subtotalKopecks: -1 },
      {
        ...snapshot,
        items: [{ ...snapshot.items[0]!, quantity: 0 }, snapshot.items[1]!],
      },
      {
        ...snapshot,
        items: [
          snapshot.items[0]!,
          { ...snapshot.items[1]!, id: "three-units" },
        ],
      },
      {
        subtotalKopecks: 1,
        commissionKopecks: 2,
        items: [
          {
            id: "a",
            quantity: 1,
            subtotalKopecks: 1,
            commissionKopecks: 2,
          },
        ],
      },
      {
        ...snapshot,
        commissionKopecks: 1.5,
      },
    ];

    for (const invalidSnapshot of invalidSnapshots) {
      assert.throws(() =>
        calculateAffiliateCommissionReversal(invalidSnapshot, [], []),
      );
    }
  });

  it("rejects unknown, duplicate, decreasing, and invalid cumulative quantities", () => {
    assert.throws(() =>
      calculateAffiliateCommissionReversal(
        snapshot,
        [],
        [{ id: "unknown", quantity: 1 }],
      ),
    );
    assert.throws(() =>
      calculateAffiliateCommissionReversal(
        snapshot,
        [],
        [
          { id: "three-units", quantity: 1 },
          { id: "three-units", quantity: 2 },
        ],
      ),
    );
    assert.throws(() =>
      calculateAffiliateCommissionReversal(
        snapshot,
        [{ id: "three-units", quantity: 2 }],
        [{ id: "three-units", quantity: 1 }],
      ),
    );
    for (const quantity of [-1, 1.5, 4, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() =>
        calculateAffiliateCommissionReversal(
          snapshot,
          [],
          [{ id: "three-units", quantity }],
        ),
      );
    }
  });
});

describe("getAffiliateCommissionAvailableAt", () => {
  it("adds exactly fourteen absolute days across timezone offsets", () => {
    const completedAt = new Date("2026-03-22T23:30:00-07:00");

    assert.equal(
      getAffiliateCommissionAvailableAt(completedAt).toISOString(),
      "2026-04-06T06:30:00.000Z",
    );
    assert.equal(completedAt.toISOString(), "2026-03-23T06:30:00.000Z");
  });

  it("rejects invalid dates and timestamp overflow", () => {
    assert.throws(() =>
      getAffiliateCommissionAvailableAt(new Date(Number.NaN)),
    );
    assert.throws(() =>
      getAffiliateCommissionAvailableAt(new Date(8_640_000_000_000_000)),
    );
  });
});
