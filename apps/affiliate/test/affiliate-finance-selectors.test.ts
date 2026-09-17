import assert from "node:assert/strict";
import test from "node:test";

import { getVisibleBalanceRows } from "../src/entities/affiliate-finance/lib/selectors.ts";

test("balance rows hide only an empty held bucket", () => {
  assert.deepEqual(
    getVisibleBalanceRows({
      availableKopecks: 12_000,
      heldKopecks: 0,
      pendingKopecks: 3_000,
      reversedKopecks: 500,
    }).map(({ key }) => key),
    ["pending"],
  );
  assert.deepEqual(
    getVisibleBalanceRows({
      availableKopecks: 12_000,
      heldKopecks: 700,
      pendingKopecks: 3_000,
      reversedKopecks: 500,
    }).map(({ key }) => key),
    ["pending", "held"],
  );
});

test("uses confirmation and suspension wording for balance buckets", () => {
  assert.deepEqual(
    getVisibleBalanceRows({
      availableKopecks: 12_000,
      heldKopecks: 700,
      pendingKopecks: 3_000,
      reversedKopecks: 500,
    }).map(({ label }) => label),
    ["Ожидает подтверждения", "Приостановлено"],
  );
});
