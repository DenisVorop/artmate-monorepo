import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreateAffiliatePayoutInput,
  createPayoutFormSchema,
  parseRublesToKopecks,
  sanitizePayoutAmountInput,
} from "../src/features/affiliate-payouts/lib/form-values.ts";

test("truncates typed or pasted payout fractions without changing rubles", () => {
  assert.equal(sanitizePayoutAmountInput("5 000,2599"), "5 000,25");
  assert.equal(sanitizePayoutAmountInput("123456.987"), "123456.98");
});

test("keeps empty, transitional, grouped, and valid payout input unchanged", () => {
  for (const value of ["", "5000,", "5000.", "5 000", "5 000,2", "5 000.25"]) {
    assert.equal(sanitizePayoutAmountInput(value), value);
  }
});

test("parses rubles with comma or dot without floating point rounding", () => {
  assert.equal(parseRublesToKopecks("5 000"), 500_000);
  assert.equal(parseRublesToKopecks("5000,7"), 500_070);
  assert.equal(parseRublesToKopecks("5000.07"), 500_007);
  assert.equal(parseRublesToKopecks("0,01"), 1);
});

test("rejects malformed, fractional-kopeck, non-positive, and unsafe amounts", () => {
  for (const value of [
    "",
    "0",
    "-5000",
    "5 000,001",
    "5,000.00",
    "90071992547410",
  ]) {
    assert.equal(parseRublesToKopecks(value), null, value);
  }
});

test("accepts the exact minimum, a partial amount, and the full available amount", () => {
  const schema = createPayoutFormSchema({
    availableKopecks: 1_250_050,
    minimumPayoutKopecks: 500_000,
  });

  for (const amountRubles of ["5000", "7000,25", "12500,50"]) {
    assert.equal(schema.safeParse({ amountRubles }).success, true, amountRubles);
  }
});

test("rejects amounts below the minimum or above the available balance", () => {
  const schema = createPayoutFormSchema({
    availableKopecks: 1_250_050,
    minimumPayoutKopecks: 500_000,
  });

  for (const amountRubles of ["4999,99", "12500,51"]) {
    assert.equal(schema.safeParse({ amountRubles }).success, false, amountRubles);
  }
});

test("uses a plain prompt for an empty or malformed payout amount", () => {
  const schema = createPayoutFormSchema({
    availableKopecks: 1_250_050,
    minimumPayoutKopecks: 500_000,
  });

  for (const amountRubles of ["", "not-money"]) {
    const result = schema.safeParse({ amountRubles });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.issues[0]?.message, "Введите сумму в рублях.");
    }
  }
});

test("builds the API payload with the selected amount and stable request id", () => {
  assert.deepEqual(
    buildCreateAffiliatePayoutInput(
      { amountRubles: "7 000,25" },
      "0f971acc-f50a-44b6-9cf1-41be31b52d51",
    ),
    {
      amountKopecks: 700_025,
      requestId: "0f971acc-f50a-44b6-9cf1-41be31b52d51",
    },
  );
});
