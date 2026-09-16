import assert from "node:assert/strict";
import test from "node:test";

import { getSafeRedirectPath } from "../src/features/auth/lib/safe-redirect.ts";

test("allows only protected affiliate destinations", () => {
  assert.equal(getSafeRedirectPath("/"), "/");
  assert.equal(getSafeRedirectPath("/cooperation"), "/cooperation");
});

test("rejects login loops and non-allowlisted paths", () => {
  assert.equal(getSafeRedirectPath("/login"), "/");
  assert.equal(getSafeRedirectPath("/access-denied"), "/");
  assert.equal(getSafeRedirectPath("/cooperation?section=contract"), "/");
});

test("rejects malformed and encoded external redirects", () => {
  assert.equal(getSafeRedirectPath("//evil.example"), "/");
  assert.equal(getSafeRedirectPath("/\\evil.example"), "/");
  assert.equal(getSafeRedirectPath("/%2f%2fevil.example"), "/");
  assert.equal(getSafeRedirectPath("/%5cevil.example"), "/");
  assert.equal(getSafeRedirectPath("/cooperation\n"), "/");
  assert.equal(getSafeRedirectPath("https://evil.example"), "/");
});
