import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculatePromoPricing,
  type PromoDiscount,
  type PromoPricingItemInput,
} from "../src/promocodes/pricing";

describe("calculatePromoPricing", () => {
  it("calculates exact percentage, fixed, and capped discounts", () => {
    const items = [
      { id: "a", unitPriceKopecks: 400, quantity: 1 },
      { id: "b", unitPriceKopecks: 300, quantity: 2 },
    ];

    assert.deepEqual(calculatePromoPricing(items, percentage(2_500)), {
      subtotalKopecks: 1_000,
      discountKopecks: 250,
      totalKopecks: 750,
      items: [
        {
          ...items[0],
          subtotalKopecks: 400,
          discountKopecks: 100,
          totalKopecks: 300,
          priceGroups: [
            { unitPriceKopecks: 300, quantity: 1, totalKopecks: 300 },
          ],
        },
        {
          ...items[1],
          subtotalKopecks: 600,
          discountKopecks: 150,
          totalKopecks: 450,
          priceGroups: [
            { unitPriceKopecks: 225, quantity: 2, totalKopecks: 450 },
          ],
        },
      ],
    });
    assert.equal(calculatePromoPricing(items, fixed(125)).discountKopecks, 125);
    assert.equal(
      calculatePromoPricing(items, percentage(5_000, 200)).discountKopecks,
      200,
    );
    assert.equal(
      calculatePromoPricing(items, percentage(5_000, 0)).discountKopecks,
      0,
    );
    assert.equal(calculatePromoPricing(items, fixed(0)).discountKopecks, 0);
  });

  it("rounds a percentage half-up once across the basket", () => {
    const result = calculatePromoPricing(
      [
        { id: "first", unitPriceKopecks: 1, quantity: 1 },
        { id: "second", unitPriceKopecks: 1, quantity: 1 },
      ],
      percentage(2_500),
    );

    assert.equal(result.discountKopecks, 1);
    assert.deepEqual(
      result.items.map((item) => item.discountKopecks),
      [1, 0],
    );
  });

  it("clamps discounts larger than the subtotal", () => {
    const result = calculatePromoPricing(
      [{ id: "a", unitPriceKopecks: 30, quantity: 2 }],
      fixed(1_000),
    );

    assert.equal(result.discountKopecks, 60);
    assert.equal(result.totalKopecks, 0);
    assert.deepEqual(result.items[0]?.priceGroups, [
      { unitPriceKopecks: 0, quantity: 2, totalKopecks: 0 },
    ]);
  });

  it("handles empty baskets and zero-price lines", () => {
    assert.deepEqual(calculatePromoPricing([], fixed(0)), {
      subtotalKopecks: 0,
      discountKopecks: 0,
      totalKopecks: 0,
      items: [],
    });

    const result = calculatePromoPricing(
      [
        { id: "free", unitPriceKopecks: 0, quantity: 5 },
        { id: "paid", unitPriceKopecks: 10, quantity: 1 },
      ],
      fixed(5),
    );
    assert.deepEqual(result.items[0], {
      id: "free",
      unitPriceKopecks: 0,
      quantity: 5,
      subtotalKopecks: 0,
      discountKopecks: 0,
      totalKopecks: 0,
      priceGroups: [{ unitPriceKopecks: 0, quantity: 5, totalKopecks: 0 }],
    });
    assert.equal(result.items[1]?.discountKopecks, 5);
  });

  it("matches the specified fixed-discount grouping example", () => {
    const result = calculatePromoPricing(
      [{ id: "a", unitPriceKopecks: 99_900, quantity: 3 }],
      fixed(10_000),
    );

    assert.deepEqual(result, {
      subtotalKopecks: 299_700,
      discountKopecks: 10_000,
      totalKopecks: 289_700,
      items: [
        {
          id: "a",
          unitPriceKopecks: 99_900,
          quantity: 3,
          subtotalKopecks: 299_700,
          discountKopecks: 10_000,
          totalKopecks: 289_700,
          priceGroups: [
            {
              unitPriceKopecks: 96_567,
              quantity: 2,
              totalKopecks: 193_134,
            },
            {
              unitPriceKopecks: 96_566,
              quantity: 1,
              totalKopecks: 96_566,
            },
          ],
        },
      ],
    });
  });

  it("allocates proportionally and breaks equal remainders by input order", () => {
    const proportional = calculatePromoPricing(
      [
        { id: "small", unitPriceKopecks: 100, quantity: 1 },
        { id: "large", unitPriceKopecks: 200, quantity: 1 },
      ],
      fixed(100),
    );
    assert.deepEqual(
      proportional.items.map((item) => item.discountKopecks),
      [33, 67],
    );

    const tied = calculatePromoPricing(
      ["first", "second", "third"].map((id) => ({
        id,
        unitPriceKopecks: 1,
        quantity: 1,
      })),
      fixed(2),
    );
    assert.deepEqual(
      tied.items.map((item) => item.discountKopecks),
      [1, 1, 0],
    );
  });

  it("uses BigInt for percentage products at the safe-integer boundary", () => {
    const max = Number.MAX_SAFE_INTEGER;
    const result = calculatePromoPricing(
      [{ id: "max", unitPriceKopecks: max, quantity: 1 }],
      percentage(9_999),
    );

    assert.equal(result.subtotalKopecks, max);
    assert.equal(result.discountKopecks, 9_006_298_534_815_517);
    assert.equal(result.totalKopecks, 900_719_925_474);
  });

  it("allocates a boundary-sized fixed discount without Number overflow", () => {
    const max = Number.MAX_SAFE_INTEGER;
    const result = calculatePromoPricing(
      [
        { id: "large", unitPriceKopecks: max - 1, quantity: 1 },
        { id: "small", unitPriceKopecks: 1, quantity: 1 },
      ],
      fixed(max - 1),
    );

    assert.deepEqual(
      result.items.map((item) => item.discountKopecks),
      [9_007_199_254_740_989, 1],
    );
    assert.deepEqual(
      result.items.map((item) => item.totalKopecks),
      [1, 0],
    );
  });

  it("breaks percentage remainder ties by input index rather than id", () => {
    const result = calculatePromoPricing(
      ["z", "a", "m"].map((id) => ({
        id,
        unitPriceKopecks: 1,
        quantity: 1,
      })),
      percentage(5_000),
    );

    assert.equal(result.discountKopecks, 2);
    assert.deepEqual(
      result.items.map((item) => item.discountKopecks),
      [1, 1, 0],
    );
    assert.deepEqual(
      result.items.map((item) => item.totalKopecks),
      [0, 0, 1],
    );
  });

  it("combines pro-rata allocation with two-group line pricing", () => {
    const result = calculatePromoPricing(
      [
        { id: "A", unitPriceKopecks: 7, quantity: 3 },
        { id: "B", unitPriceKopecks: 5, quantity: 2 },
      ],
      fixed(10),
    );

    assert.deepEqual(
      result.items.map(({ discountKopecks, totalKopecks, priceGroups }) => ({
        discountKopecks,
        totalKopecks,
        priceGroups,
      })),
      [
        {
          discountKopecks: 7,
          totalKopecks: 14,
          priceGroups: [
            { unitPriceKopecks: 5, quantity: 2, totalKopecks: 10 },
            { unitPriceKopecks: 4, quantity: 1, totalKopecks: 4 },
          ],
        },
        {
          discountKopecks: 3,
          totalKopecks: 7,
          priceGroups: [
            { unitPriceKopecks: 4, quantity: 1, totalKopecks: 4 },
            { unitPriceKopecks: 3, quantity: 1, totalKopecks: 3 },
          ],
        },
      ],
    );
  });

  it("supports safe-integer boundaries and huge quantities without unit allocation", () => {
    const boundary = calculatePromoPricing(
      [
        {
          id: "boundary",
          unitPriceKopecks: 1,
          quantity: Number.MAX_SAFE_INTEGER,
        },
      ],
      fixed(0),
    );
    assert.equal(boundary.subtotalKopecks, Number.MAX_SAFE_INTEGER);
    assert.deepEqual(boundary.items[0]?.priceGroups, [
      {
        unitPriceKopecks: 1,
        quantity: Number.MAX_SAFE_INTEGER,
        totalKopecks: Number.MAX_SAFE_INTEGER,
      },
    ]);

    const hugeFreeLine = calculatePromoPricing(
      [
        {
          id: "huge-free",
          unitPriceKopecks: 0,
          quantity: Number.MAX_SAFE_INTEGER,
        },
      ],
      percentage(10_000),
    );
    assert.equal(hugeFreeLine.items[0]?.priceGroups.length, 1);

    assert.throws(
      () =>
        calculatePromoPricing(
          [
            {
              id: "overflow",
              unitPriceKopecks: Number.MAX_SAFE_INTEGER,
              quantity: 2,
            },
          ],
          fixed(0),
        ),
      /subtotal exceeds safe integer range/,
    );
    assert.throws(
      () =>
        calculatePromoPricing(
          [
            {
              id: "max",
              unitPriceKopecks: Number.MAX_SAFE_INTEGER,
              quantity: 1,
            },
            { id: "one", unitPriceKopecks: 1, quantity: 1 },
          ],
          fixed(0),
        ),
      /Basket subtotal exceeds safe integer range/,
    );
  });

  it("rejects invalid items and discounts, including for empty baskets", () => {
    const validItem = { id: "valid", unitPriceKopecks: 100, quantity: 1 };
    const invalidNumbers = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ];

    for (const value of invalidNumbers) {
      assert.throws(() =>
        calculatePromoPricing(
          [{ ...validItem, unitPriceKopecks: value }],
          fixed(0),
        ),
      );
      assert.throws(() =>
        calculatePromoPricing([{ ...validItem, quantity: value }], fixed(0)),
      );
    }
    assert.throws(
      () => calculatePromoPricing([{ ...validItem, quantity: 0 }], fixed(0)),
      /quantity must be positive/,
    );
    assert.throws(() =>
      calculatePromoPricing([{ ...validItem, id: "  " }], fixed(0)),
    );
    assert.throws(
      () => calculatePromoPricing([validItem, validItem], fixed(0)),
      /Duplicate item id/,
    );

    const invalidMoneyValues = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
    ];
    const invalidBasisPoints = [...invalidMoneyValues, 0, 10_001];
    const invalidDiscounts: unknown[] = [
      ...invalidMoneyValues.map((amountKopecks) => ({
        type: "fixed",
        amountKopecks,
      })),
      ...invalidBasisPoints.map((basisPoints) => ({
        type: "percentage",
        basisPoints,
      })),
      ...invalidMoneyValues.map((maxDiscountKopecks) => ({
        type: "percentage",
        basisPoints: 100,
        maxDiscountKopecks,
      })),
      { type: "bogus" },
      null,
    ];
    const discountValidationBaskets: readonly PromoPricingItemInput[][] = [
      [],
      [{ id: "free", unitPriceKopecks: 0, quantity: 1 }],
    ];
    for (const invalidDiscount of invalidDiscounts) {
      for (const basket of discountValidationBaskets) {
        assert.throws(() =>
          calculatePromoPricing(basket, invalidDiscount as PromoDiscount),
        );
      }
    }
  });

  it("does not mutate deeply frozen inputs", () => {
    const items = Object.freeze([
      Object.freeze({ id: "a", unitPriceKopecks: 101, quantity: 3 }),
      Object.freeze({ id: "b", unitPriceKopecks: 59, quantity: 2 }),
    ]);
    const discount = Object.freeze(percentage(3_333, 100));

    assert.doesNotThrow(() => calculatePromoPricing(items, discount));
    assert.deepEqual(items, [
      { id: "a", unitPriceKopecks: 101, quantity: 3 },
      { id: "b", unitPriceKopecks: 59, quantity: 2 },
    ]);
    assert.deepEqual(discount, {
      type: "percentage",
      basisPoints: 3_333,
      maxDiscountKopecks: 100,
    });
  });

  it("maintains pricing invariants for deterministic generated cases", () => {
    let state = 0x1234_5678;
    const random = (limit: number) => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state % limit;
    };

    for (let caseIndex = 0; caseIndex < 200; caseIndex += 1) {
      const items: PromoPricingItemInput[] = Array.from(
        { length: random(8) },
        (_, itemIndex) => ({
          id: `${caseIndex}-${itemIndex}`,
          unitPriceKopecks: random(100_000),
          quantity: random(1_000_000) + 1,
        }),
      );
      const discount: PromoDiscount =
        caseIndex % 2 === 0
          ? fixed(random(1_000_000))
          : percentage(random(10_000) + 1, random(1_000_000));
      const result = calculatePromoPricing(items, discount);

      assert.equal(
        result.items.reduce((sum, item) => sum + item.subtotalKopecks, 0),
        result.subtotalKopecks,
      );
      assert.equal(
        result.items.reduce((sum, item) => sum + item.discountKopecks, 0),
        result.discountKopecks,
      );
      assert.equal(
        result.items.reduce((sum, item) => sum + item.totalKopecks, 0),
        result.totalKopecks,
      );
      assert.ok(result.discountKopecks >= 0);
      assert.ok(result.discountKopecks <= result.subtotalKopecks);
      assert.equal(
        result.subtotalKopecks,
        result.discountKopecks + result.totalKopecks,
      );

      for (const item of result.items) {
        assert.equal(
          item.subtotalKopecks,
          item.discountKopecks + item.totalKopecks,
        );
        assert.ok(item.discountKopecks >= 0);
        assert.ok(item.discountKopecks <= item.subtotalKopecks);
        assert.ok(item.priceGroups.length >= 1);
        assert.ok(item.priceGroups.length <= 2);
        assert.equal(
          item.priceGroups.reduce((sum, group) => sum + group.quantity, 0),
          item.quantity,
        );
        assert.equal(
          item.priceGroups.reduce((sum, group) => sum + group.totalKopecks, 0),
          item.totalKopecks,
        );
        for (const group of item.priceGroups) {
          assert.ok(Number.isSafeInteger(group.quantity));
          assert.ok(group.quantity > 0);
          assert.ok(Number.isSafeInteger(group.unitPriceKopecks));
          assert.ok(group.unitPriceKopecks >= 0);
          assert.ok(Number.isSafeInteger(group.totalKopecks));
          assert.ok(group.totalKopecks >= 0);
          assert.equal(
            group.unitPriceKopecks * group.quantity,
            group.totalKopecks,
          );
        }
        if (item.priceGroups.length === 2) {
          assert.equal(
            item.priceGroups[0]!.unitPriceKopecks,
            item.priceGroups[1]!.unitPriceKopecks + 1,
          );
        }
      }
    }
  });
});

function fixed(amountKopecks: number): PromoDiscount {
  return { type: "fixed", amountKopecks };
}

function percentage(
  basisPoints: number,
  maxDiscountKopecks?: number,
): PromoDiscount {
  return { type: "percentage", basisPoints, maxDiscountKopecks };
}
