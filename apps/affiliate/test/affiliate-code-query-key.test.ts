import assert from "node:assert/strict";
import test from "node:test";

import { affiliateCodeQueryKeys } from "../src/entities/affiliate-code/model/query-key.ts";

test("isolates code lists by owner and pagination", () => {
  assert.deepEqual(affiliateCodeQueryKeys.list("user-a", 2, 50), [
    "affiliate-codes",
    "user-a",
    "list",
    { page: 2, pageSize: 50 },
  ]);
  assert.notDeepEqual(
    affiliateCodeQueryKeys.list("user-a", 1, 20),
    affiliateCodeQueryKeys.list("user-b", 1, 20),
  );
});

test("provides an owner-scoped prefix for invalidating every page", () => {
  assert.deepEqual(affiliateCodeQueryKeys.lists("user-a"), [
    "affiliate-codes",
    "user-a",
    "list",
  ]);
});
