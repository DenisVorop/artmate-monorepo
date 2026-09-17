import assert from "node:assert/strict";
import test from "node:test";

import { affiliatePayoutQueryKeys } from "../src/entities/affiliate-payout/model/query-key.ts";

test("isolates payout lists by owner and pagination", () => {
  assert.deepEqual(affiliatePayoutQueryKeys.list("user-a", 2, 10), [
    "affiliate-payouts",
    "user-a",
    "list",
    { page: 2, pageSize: 10 },
  ]);
  assert.notDeepEqual(
    affiliatePayoutQueryKeys.list("user-a", 1, 10),
    affiliatePayoutQueryKeys.list("user-b", 1, 10),
  );
});

test("provides an owner-scoped prefix for cache invalidation", () => {
  assert.deepEqual(affiliatePayoutQueryKeys.all("user-a"), [
    "affiliate-payouts",
    "user-a",
  ]);
});
