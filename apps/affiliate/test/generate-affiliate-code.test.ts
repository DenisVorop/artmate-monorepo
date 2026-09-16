import assert from "node:assert/strict";
import test from "node:test";

import { generateAffiliateCode } from "../src/features/affiliate-codes/lib/generate-code.ts";

test("generates ARTM code with six unambiguous symbols", () => {
  const code = generateAffiliateCode();

  assert.match(code, /^ARTM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});
