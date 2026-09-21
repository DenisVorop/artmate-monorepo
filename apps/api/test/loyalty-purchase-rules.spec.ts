import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  purchasePointsForAmount,
  purchaseRateForSpend,
} from "../src/loyalty/purchase-rules";

describe("purchase rules", () => {
  it("uses exact confirmed lifetime cash thresholds", () => {
    for (const [amount, rate] of [
      [0n, 3],
      [299999n, 3],
      [300000n, 5],
      [699999n, 5],
      [700000n, 7],
      [1199999n, 7],
      [1200000n, 10],
    ] as const)
      assert.equal(purchaseRateForSpend(amount), rate);
  });
  it("converts five points per ruble and rounds only the order total upward", () => {
    assert.equal(purchasePointsForAmount(79900n, 5), 200n);
    assert.equal(purchasePointsForAmount(79900n, 3), 120n);
    assert.equal(purchasePointsForAmount(0n, 10), 0n);
    assert.equal(purchasePointsForAmount(1n, 3), 1n);
    assert.equal(purchasePointsForAmount(10000n, 10), 50n);
  });
  it("cumulative remaining-goods calculation cancels a full grant exactly", () => {
    const original = purchasePointsForAmount(79900n, 5);
    let previous = original;
    let reversed = 0n;
    for (const remaining of [69001n, 69000n, 550n, 1n, 0n]) {
      const target = purchasePointsForAmount(remaining, 5);
      reversed += previous - target;
      previous = target;
    }
    assert.equal(reversed, original);
  });
  it("rejects invalid input and unsupported rates without floating point math", () => {
    assert.throws(() => purchaseRateForSpend(-1n));
    assert.throws(() => purchasePointsForAmount(-1n, 3));
    assert.throws(() => purchasePointsForAmount(100n, 4));
    assert.throws(() => purchasePointsForAmount(100n, 2.5));
    assert.throws(() => purchasePointsForAmount(10n ** 30n, 10));
  });
});
