import assert from "node:assert/strict";
import test from "node:test";

import { getAffiliatePartnerQueryKey } from "../src/entities/affiliate-partner/model/query-key.ts";

test("isolates partner data by authenticated owner", () => {
  assert.notDeepEqual(
    getAffiliatePartnerQueryKey("user-a"),
    getAffiliatePartnerQueryKey("user-b"),
  );
  assert.deepEqual(getAffiliatePartnerQueryKey("user-a"), [
    "affiliate-partner",
    "me",
    "user-a",
  ]);
});
