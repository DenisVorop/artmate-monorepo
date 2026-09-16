import assert from "node:assert/strict";
import test from "node:test";

import {
  getAccessFailureDecision,
  getAffiliateAccessDecision,
} from "../src/features/auth/lib/access.ts";

test("sends a visitor without a session to login", () => {
  assert.equal(getAffiliateAccessDecision(false, "not-requested"), "login");
});

test("allows an authenticated user only after /affiliate/me succeeds", () => {
  assert.equal(getAffiliateAccessDecision(true, "active"), "allow");
});

test("refuses ordinary and suspended authenticated users", () => {
  assert.equal(getAffiliateAccessDecision(true, "forbidden"), "denied");
  assert.equal(getAffiliateAccessDecision(true, "suspended"), "denied");
});

test("does not disguise API outages as missing partner access", () => {
  assert.equal(getAccessFailureDecision(401), "login");
  assert.equal(getAccessFailureDecision(403), "denied");
  assert.equal(getAccessFailureDecision(404), "denied");
  assert.equal(getAccessFailureDecision(500), "error");
  assert.equal(getAccessFailureDecision(undefined), "error");
});
