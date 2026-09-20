import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculatePromoPricing } from "../src/promocodes/pricing";
import {
  assertOrderPricingMatches,
  createOrderPricingSnapshot,
  parseOrderPricingSnapshot,
  type OrderPricingSnapshot,
} from "../src/orders/pricing/pricing-snapshot";

function example() {
  return createOrderPricingSnapshot(
    calculatePromoPricing(
      [
        { id: "a", unitPriceKopecks: 7, quantity: 3 },
        { id: "b", unitPriceKopecks: 5, quantity: 2 },
      ],
      { type: "fixed", amountKopecks: 10 },
    ),
    300,
  );
}

function expectedOrder(snapshot: OrderPricingSnapshot) {
  return {
    subtotalKopecks: snapshot.subtotalKopecks,
    discountKopecks: snapshot.discountKopecks,
    deliveryKopecks: snapshot.deliveryKopecks,
    totalKopecks: snapshot.totalKopecks,
    items: snapshot.items.map((item) => ({
      id: item.id,
      unitPriceKopecks: item.unitPriceKopecks,
      quantity: item.quantity,
      lineTotalKopecks: item.subtotalKopecks,
    })),
  };
}

describe("order pricing snapshot", () => {
  it("records exact original prices, promo allocation, delivery and zero loyalty", () => {
    const snapshot = example();
    assert.deepEqual(snapshot, {
      version: 1,
      currency: "RUB",
      subtotalKopecks: 31,
      promoDiscountKopecks: 10,
      loyaltyDiscountKopecks: 0,
      discountKopecks: 10,
      itemsTotalKopecks: 21,
      deliveryKopecks: 300,
      totalKopecks: 321,
      items: [
        {
          id: "a",
          unitPriceKopecks: 7,
          quantity: 3,
          subtotalKopecks: 21,
          promoDiscountKopecks: 7,
          loyaltyPoints: 0,
          loyaltyDiscountKopecks: 0,
          totalKopecks: 14,
          priceGroups: [
            {
              quantity: 2,
              unitPriceKopecks: 5,
              promoDiscountPerUnitKopecks: 2,
              loyaltyPointsPerUnit: 0,
              totalKopecks: 10,
            },
            {
              quantity: 1,
              unitPriceKopecks: 4,
              promoDiscountPerUnitKopecks: 3,
              loyaltyPointsPerUnit: 0,
              totalKopecks: 4,
            },
          ],
        },
        {
          id: "b",
          unitPriceKopecks: 5,
          quantity: 2,
          subtotalKopecks: 10,
          promoDiscountKopecks: 3,
          loyaltyPoints: 0,
          loyaltyDiscountKopecks: 0,
          totalKopecks: 7,
          priceGroups: [
            {
              quantity: 1,
              unitPriceKopecks: 4,
              promoDiscountPerUnitKopecks: 1,
              loyaltyPointsPerUnit: 0,
              totalKopecks: 4,
            },
            {
              quantity: 1,
              unitPriceKopecks: 3,
              promoDiscountPerUnitKopecks: 2,
              loyaltyPointsPerUnit: 0,
              totalKopecks: 3,
            },
          ],
        },
      ],
    });
    assert.deepEqual(
      parseOrderPricingSnapshot(JSON.parse(JSON.stringify(snapshot))),
      snapshot,
    );
  });

  it("preserves input group order for partial returns, including reversed groups", () => {
    const pricing = calculatePromoPricing(
      [{ id: "a", unitPriceKopecks: 99_900, quantity: 3 }],
      { type: "fixed", amountKopecks: 10_000 },
    );
    const originalGroups = structuredClone(pricing.items[0]!.priceGroups);
    const snapshot = createOrderPricingSnapshot(pricing, 0);
    assert.deepEqual(
      snapshot.items[0]!.priceGroups.map(
        ({ quantity, unitPriceKopecks, totalKopecks }) => ({
          quantity,
          unitPriceKopecks,
          totalKopecks,
        }),
      ),
      originalGroups,
    );
    assert.equal(snapshot.items[0]!.priceGroups[0]!.unitPriceKopecks, 96_567);

    pricing.items[0]!.priceGroups.reverse();
    const reversed = createOrderPricingSnapshot(pricing, 0);
    assert.equal(reversed.items[0]!.priceGroups[0]!.unitPriceKopecks, 96_566);
    assert.deepEqual(parseOrderPricingSnapshot(reversed), reversed);
    assert.equal(snapshot.items[0]!.priceGroups[0]!.unitPriceKopecks, 96_567);
  });

  it("supports a loyalty-only snapshot with integer points at 20 kopecks each", () => {
    const snapshot: OrderPricingSnapshot = {
      version: 1,
      currency: "RUB",
      subtotalKopecks: 2_000,
      promoDiscountKopecks: 0,
      loyaltyDiscountKopecks: 60,
      discountKopecks: 60,
      itemsTotalKopecks: 1_940,
      deliveryKopecks: 100,
      totalKopecks: 2_040,
      items: [
        {
          id: "loyal",
          unitPriceKopecks: 1_000,
          quantity: 2,
          subtotalKopecks: 2_000,
          promoDiscountKopecks: 0,
          loyaltyPoints: 3,
          loyaltyDiscountKopecks: 60,
          totalKopecks: 1_940,
          priceGroups: [
            {
              quantity: 1,
              unitPriceKopecks: 980,
              promoDiscountPerUnitKopecks: 0,
              loyaltyPointsPerUnit: 1,
              totalKopecks: 980,
            },
            {
              quantity: 1,
              unitPriceKopecks: 960,
              promoDiscountPerUnitKopecks: 0,
              loyaltyPointsPerUnit: 2,
              totalKopecks: 960,
            },
          ],
        },
      ],
    };
    assert.deepEqual(parseOrderPricingSnapshot(snapshot), snapshot);
    assert.doesNotThrow(() =>
      assertOrderPricingMatches(snapshot, expectedOrder(snapshot)),
    );
    for (const mutate of [
      (s: OrderPricingSnapshot) => {
        s.items[0]!.loyaltyPoints = 2;
      },
      (s: OrderPricingSnapshot) => {
        s.items[0]!.loyaltyDiscountKopecks = 40;
      },
      (s: OrderPricingSnapshot) => {
        s.items[0]!.priceGroups[0]!.loyaltyPointsPerUnit = 2;
      },
    ]) {
      const corrupt = structuredClone(snapshot);
      mutate(corrupt);
      assert.throws(() => parseOrderPricingSnapshot(corrupt));
    }
  });

  it("permits sub-ruble, zero final and zero original prices without a receipt minimum", () => {
    for (const unitPriceKopecks of [0, 1, 99]) {
      for (const amountKopecks of [0, 1_000]) {
        const snapshot = createOrderPricingSnapshot(
          calculatePromoPricing(
            [{ id: "historical", unitPriceKopecks, quantity: 2 }],
            { type: "fixed", amountKopecks },
          ),
          0,
        );
        assert.equal(
          snapshot.totalKopecks,
          Math.max(0, unitPriceKopecks * 2 - amountKopecks),
        );
      }
    }
  });

  it("rejects malformed structures, unsupported versions/currencies and empty collections", () => {
    const valid = example();
    for (const value of [
      null,
      [],
      "snapshot",
      {},
      { ...valid, version: 2 },
      { ...valid, version: "1" },
      { ...valid, currency: "USD" },
      { ...valid, currency: undefined },
      { ...valid, extra: true },
      { ...valid, items: [] },
      { ...valid, items: new Array(1) },
      { ...valid, items: [null] },
    ]) {
      assert.throws(() => parseOrderPricingSnapshot(value));
    }
    for (const mutate of [
      (s: OrderPricingSnapshot) => {
        s.items[0]!.priceGroups = [];
      },
      (s: OrderPricingSnapshot) => {
        s.items[0]!.priceGroups = new Array(1);
      },
      (s: OrderPricingSnapshot) => {
        s.items[0]!.id = " ";
      },
      (s: OrderPricingSnapshot) => {
        s.items[1]!.id = s.items[0]!.id;
      },
      (s: OrderPricingSnapshot) => {
        s.items.pop();
      },
      (s: OrderPricingSnapshot) => {
        s.items.push({ ...s.items[0]!, id: "extra" });
      },
    ]) {
      const corrupt = example();
      mutate(corrupt);
      assert.throws(() => parseOrderPricingSnapshot(corrupt));
    }
    assert.throws(() =>
      createOrderPricingSnapshot(
        calculatePromoPricing([], { type: "fixed", amountKopecks: 0 }),
        0,
      ),
    );
  });

  it("rejects non-integer, unsafe and negative numbers in every numeric field", () => {
    const valid = example();
    for (const section of [
      valid,
      valid.items[0]!,
      valid.items[0]!.priceGroups[0]!,
    ]) {
      for (const field of Object.keys(section).filter(
        (key) => typeof (section as Record<string, unknown>)[key] === "number",
      )) {
        for (const value of [
          -1,
          0.5,
          Number.MAX_SAFE_INTEGER + 1,
          NaN,
          Infinity,
          "1",
          null,
        ]) {
          const corrupt = example();
          const target =
            section === valid
              ? corrupt
              : section === valid.items[0]
                ? corrupt.items[0]!
                : corrupt.items[0]!.priceGroups[0]!;
          (target as Record<string, unknown>)[field] = value;
          assert.throws(
            () => parseOrderPricingSnapshot(corrupt),
            `${field}: ${String(value)}`,
          );
        }
      }
    }
    for (const group of [false, true]) {
      const corrupt = example();
      if (group) corrupt.items[0]!.priceGroups[0]!.quantity = 0;
      else corrupt.items[0]!.quantity = 0;
      assert.throws(
        () => parseOrderPricingSnapshot(corrupt),
        "Zero quantity must be rejected",
      );
    }
  });

  it("detects corruption of each monetary sum and per-unit identity", () => {
    for (const section of ["snapshot", "item", "group"] as const) {
      const valid = example();
      const source =
        section === "snapshot"
          ? valid
          : section === "item"
            ? valid.items[0]!
            : valid.items[0]!.priceGroups[0]!;
      for (const field of Object.keys(source).filter(
        (key) =>
          typeof (source as Record<string, unknown>)[key] === "number" &&
          key !== "version",
      )) {
        const corrupt = example();
        const target =
          section === "snapshot"
            ? corrupt
            : section === "item"
              ? corrupt.items[0]!
              : corrupt.items[0]!.priceGroups[0]!;
        const fields = target as Record<string, number>;
        fields[field] = fields[field]! + 1;
        assert.throws(
          () => parseOrderPricingSnapshot(corrupt),
          `${section}.${field}`,
        );
      }
    }
  });

  it("validates arithmetic at safe-integer boundaries and rejects sum/product overflow", () => {
    const max = Number.MAX_SAFE_INTEGER;
    const pricing = calculatePromoPricing(
      [{ id: "max", unitPriceKopecks: max, quantity: 1 }],
      { type: "fixed", amountKopecks: 0 },
    );
    assert.equal(createOrderPricingSnapshot(pricing, 0).totalKopecks, max);
    assert.throws(
      () => createOrderPricingSnapshot(pricing, 1),
      /safe integer range/,
    );
    const tooMany = createOrderPricingSnapshot(pricing, 0);
    tooMany.items[0]!.quantity = 2;
    assert.throws(
      () => parseOrderPricingSnapshot(tooMany),
      /safe integer range/,
    );
    const groupOverflow = createOrderPricingSnapshot(pricing, 0);
    groupOverflow.items[0]!.priceGroups[0]!.quantity = 2;
    assert.throws(
      () => parseOrderPricingSnapshot(groupOverflow),
      /safe integer range/,
    );
    const sumOverflow = createOrderPricingSnapshot(pricing, 0);
    sumOverflow.items.push({ ...sumOverflow.items[0]!, id: "another" });
    assert.throws(
      () => parseOrderPricingSnapshot(sumOverflow),
      /safe integer range/,
    );
    const loyaltyOverflow = createOrderPricingSnapshot(pricing, 0);
    loyaltyOverflow.items[0]!.priceGroups[0]!.loyaltyPointsPerUnit = max;
    assert.throws(
      () => parseOrderPricingSnapshot(loyaltyOverflow),
      /safe integer range/,
    );
    const quantityOverflow = createOrderPricingSnapshot(
      calculatePromoPricing(
        [{ id: "free", unitPriceKopecks: 0, quantity: max }],
        { type: "fixed", amountKopecks: 0 },
      ),
      0,
    );
    quantityOverflow.items[0]!.priceGroups.push({
      ...quantityOverflow.items[0]!.priceGroups[0]!,
      quantity: 1,
    });
    assert.throws(
      () => parseOrderPricingSnapshot(quantityOverflow),
      /safe integer range/,
    );
  });

  it("validates caller-supplied promo pricing before creating a snapshot", () => {
    for (const mutate of [
      (p: ReturnType<typeof calculatePromoPricing>) => {
        p.items[0]!.discountKopecks += 1;
      },
      (p: ReturnType<typeof calculatePromoPricing>) => {
        p.items[0]!.priceGroups[0]!.totalKopecks += 1;
      },
      (p: ReturnType<typeof calculatePromoPricing>) => {
        p.items[0]!.priceGroups[0]!.unitPriceKopecks = 101;
      },
      (p: ReturnType<typeof calculatePromoPricing>) => {
        p.items[0] = { ...p.items[0]!, quantity: 0 };
      },
      (p: ReturnType<typeof calculatePromoPricing>) => {
        p.totalKopecks = 0.5;
      },
    ]) {
      const pricing = calculatePromoPricing(
        [{ id: "a", unitPriceKopecks: 100, quantity: 1 }],
        { type: "fixed", amountKopecks: 1 },
      );
      mutate(pricing);
      assert.throws(() => createOrderPricingSnapshot(pricing, 0));
    }
    for (const delivery of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const pricing = calculatePromoPricing(
        [{ id: "a", unitPriceKopecks: 100, quantity: 1 }],
        { type: "fixed", amountKopecks: 0 },
      );
      assert.throws(() => createOrderPricingSnapshot(pricing, delivery));
    }
  });
});

describe("assertOrderPricingMatches", () => {
  it("matches original database line totals and rejects discounted line totals", () => {
    const snapshot = example();
    const expected = expectedOrder(snapshot);
    assert.equal(expected.items[0]!.lineTotalKopecks, 21);
    assert.equal(snapshot.items[0]!.totalKopecks, 14);
    assert.doesNotThrow(() => assertOrderPricingMatches(snapshot, expected));
    expected.items[0]!.lineTotalKopecks = snapshot.items[0]!.totalKopecks;
    assert.throws(() => assertOrderPricingMatches(snapshot, expected));
  });

  it("matches immutable order values by id independently of database item ordering", () => {
    const snapshot = example();
    const expected = expectedOrder(snapshot);
    expected.items.reverse();
    assert.doesNotThrow(() => assertOrderPricingMatches(snapshot, expected));
  });

  it("rejects extra, missing, replaced and duplicate order item ids", () => {
    const snapshot = example();
    for (const mutate of [
      (e: ReturnType<typeof expectedOrder>) => {
        e.items.pop();
      },
      (e: ReturnType<typeof expectedOrder>) => {
        e.items.push({ ...e.items[0]!, id: "extra" });
      },
      (e: ReturnType<typeof expectedOrder>) => {
        e.items[1]!.id = "unknown";
      },
      (e: ReturnType<typeof expectedOrder>) => {
        e.items[1]!.id = e.items[0]!.id;
      },
    ]) {
      const expected = expectedOrder(snapshot);
      mutate(expected);
      assert.throws(() => assertOrderPricingMatches(snapshot, expected));
    }
  });

  it("rejects mismatched immutable totals and item values, including numeric coercion", () => {
    const snapshot = example();
    for (const field of [
      "subtotalKopecks",
      "discountKopecks",
      "deliveryKopecks",
      "totalKopecks",
    ] as const) {
      const expected = expectedOrder(snapshot);
      expected[field] += 1;
      assert.throws(() => assertOrderPricingMatches(snapshot, expected));
    }
    for (const field of [
      "unitPriceKopecks",
      "quantity",
      "lineTotalKopecks",
    ] as const) {
      const expected = expectedOrder(snapshot);
      expected.items[0]![field] += 1;
      assert.throws(() => assertOrderPricingMatches(snapshot, expected));
      (expected.items[0]! as Record<string, unknown>)[field] = String(
        snapshot.items[0]!.quantity,
      );
      assert.throws(() => assertOrderPricingMatches(snapshot, expected));
    }
    const corrupt = example();
    corrupt.items[0]!.priceGroups[0]!.totalKopecks += 1;
    assert.throws(() =>
      assertOrderPricingMatches(corrupt, expectedOrder(corrupt)),
    );
  });
});
