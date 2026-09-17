import assert from "node:assert/strict";
import test from "node:test";

import { affiliateFinanceQueryKeys } from "../src/entities/affiliate-finance/model/query-key.ts";

test("isolates analytics by owner, period, and code pagination", () => {
  assert.deepEqual(affiliateFinanceQueryKeys.analytics("user-a", 30, 2, 10), [
    "affiliate-finance",
    "user-a",
    "analytics",
    { codePage: 2, codePageSize: 10, days: 30 },
  ]);
  assert.notDeepEqual(
    affiliateFinanceQueryKeys.analytics("user-a", 30, 1, 10),
    affiliateFinanceQueryKeys.analytics("user-b", 30, 1, 10),
  );
});

test("isolates ledger by owner, period, and pagination", () => {
  assert.deepEqual(affiliateFinanceQueryKeys.ledger("user-a", 7, 3, 20), [
    "affiliate-finance",
    "user-a",
    "ledger",
    { days: 7, page: 3, pageSize: 20 },
  ]);
  assert.notDeepEqual(
    affiliateFinanceQueryKeys.ledger("user-a", 90, 1, 20),
    affiliateFinanceQueryKeys.ledger("user-b", 90, 1, 20),
  );
});
