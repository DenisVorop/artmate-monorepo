import assert from "node:assert/strict";
import test from "node:test";

import { getVisibleBalanceRows } from "../src/entities/affiliate-finance/lib/selectors.ts";

test("balance rows hide only an empty held bucket", () => {
  assert.deepEqual(
    getVisibleBalanceRows({
      availableKopecks: 12_000,
      debtKopecks: 0,
      heldKopecks: 0,
      paidKopecks: 0,
      pendingKopecks: 3_000,
      reservedKopecks: 0,
      reversedKopecks: 500,
    }).map(({ key }) => key),
    ["pending"],
  );
  assert.deepEqual(
    getVisibleBalanceRows({
      availableKopecks: 12_000,
      debtKopecks: 0,
      heldKopecks: 700,
      paidKopecks: 0,
      pendingKopecks: 3_000,
      reservedKopecks: 0,
      reversedKopecks: 500,
    }).map(({ key }) => key),
    ["pending", "held"],
  );
});

test("uses confirmation and suspension wording for balance buckets", () => {
  assert.deepEqual(
    getVisibleBalanceRows({
      availableKopecks: 12_000,
      debtKopecks: 0,
      heldKopecks: 700,
      paidKopecks: 0,
      pendingKopecks: 3_000,
      reservedKopecks: 0,
      reversedKopecks: 500,
    }).map(({ label }) => label),
    ["Ожидает подтверждения", "Приостановлено"],
  );
});

test("shows non-empty reserved, paid, and debt payout buckets", () => {
  assert.deepEqual(
    getVisibleBalanceRows({
      availableKopecks: 12_000,
      debtKopecks: 200,
      heldKopecks: 0,
      paidKopecks: 5_000,
      pendingKopecks: 3_000,
      reservedKopecks: 4_000,
      reversedKopecks: 500,
    }).map(({ key, label }) => [key, label]),
    [
      ["pending", "Ожидает подтверждения"],
      ["reserved", "В заявке на выплату"],
      ["paid", "Выплачено"],
      ["debt", "Задолженность"],
    ],
  );
});
