import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getPromoIneligibilityMessage } from "../src/promocodes/eligibility";
import {
  kopecksToRubles,
  normalizePromoCode,
  rublesToKopecks,
} from "../src/promocodes/promocodes.service";

const activePromo = {
  isActive: true,
  startsAt: new Date("2026-08-01T00:00:00.000Z"),
  endsAt: new Date("2026-09-01T00:00:00.000Z"),
  minSubtotalKopecks: 10_000,
  maxUses: 3,
  maxUsesPerUser: 1,
  usedCount: 1,
  reservedCount: 1,
};

describe("promocode eligibility", () => {
  it("normalizes only valid ASCII codes", () => {
    assert.equal(normalizePromoCode("  sale_20-x "), "SALE_20-X");
    for (const code of ["ab", "ПРОМО", "SALE 20", "A".repeat(41)]) {
      assert.throws(() => normalizePromoCode(code), /Некорректный формат/);
    }
  });

  it("uses inclusive start and exclusive end boundaries", () => {
    const eligible = (now: string) =>
      getPromoIneligibilityMessage(activePromo, {
        now: new Date(now),
        subtotalKopecks: 10_000,
        userId: "user-1",
        userRedemptionCount: 0,
      });
    assert.equal(eligible("2026-08-01T00:00:00.000Z"), undefined);
    assert.match(eligible("2026-07-31T23:59:59.999Z")!, /еще не начался/);
    assert.match(eligible("2026-09-01T00:00:00.000Z")!, /истек/);
  });

  it("enforces subtotal, overall and per-account limits without guessing for guests", () => {
    const input = {
      now: new Date("2026-08-15T00:00:00.000Z"),
      subtotalKopecks: 10_000,
    };
    assert.match(
      getPromoIneligibilityMessage(activePromo, {
        ...input,
        subtotalKopecks: 9_999,
      })!,
      /минимальной/,
    );
    assert.match(
      getPromoIneligibilityMessage(
        { ...activePromo, reservedCount: 2 },
        { ...input, userId: "u", userRedemptionCount: 0 },
      )!,
      /Лимит применений/,
    );
    assert.match(
      getPromoIneligibilityMessage(activePromo, input)!,
      /необходимо войти/,
    );
    assert.match(
      getPromoIneligibilityMessage(activePromo, {
        ...input,
        userId: "u",
        userRedemptionCount: 1,
      })!,
      /Ваш лимит/,
    );
  });

  it("converts exact RUB decimals to safe integer kopecks", () => {
    assert.equal(rublesToKopecks({ toString: () => "199.9" }), 19_990);
    assert.equal(rublesToKopecks({ toString: () => "0.01" }), 1);
    assert.equal(kopecksToRubles(Number.MAX_SAFE_INTEGER), "90071992547409.91");
    assert.throws(
      () => rublesToKopecks({ toString: () => "1.001" }),
      /two decimal/,
    );
    assert.throws(
      () => rublesToKopecks({ toString: () => "90071992547410" }),
      /safe integer/,
    );
  });
});
