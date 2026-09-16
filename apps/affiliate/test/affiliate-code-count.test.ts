import assert from "node:assert/strict";
import test from "node:test";

import { formatAffiliateCodeCount } from "../src/features/affiliate-codes/lib/format-count.ts";

test("uses the correct Russian plural form for promo code counts", () => {
  assert.equal(formatAffiliateCodeCount(0), "0 промокодов");
  assert.equal(formatAffiliateCodeCount(1), "1 промокод");
  assert.equal(formatAffiliateCodeCount(2), "2 промокода");
  assert.equal(formatAffiliateCodeCount(5), "5 промокодов");
  assert.equal(formatAffiliateCodeCount(11), "11 промокодов");
  assert.equal(formatAffiliateCodeCount(21), "21 промокод");
  assert.equal(formatAffiliateCodeCount(22), "22 промокода");
});
