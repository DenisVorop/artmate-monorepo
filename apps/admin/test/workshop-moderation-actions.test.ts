import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL(
    "../src/shared/actions/workshop-moderation/workshop-moderation.actions.ts",
    import.meta.url,
  ),
  "utf8",
);

test("workshop moderation actions forward auth and client IP without caching", () => {
  assert.match(source, /cookies, headers/);
  assert.match(source, /artmate_access_token/);
  assert.match(source, /getForwardedIpHeaders\(headerStore\)/);
  assert.match(source, /cache: "no-store"/);
});

test("decision POST applies CSRF and parses the strict response schema", () => {
  assert.match(source, /method: "POST"/);
  assert.match(source, /method === "POST" \? apiCsrfHeader/);
  assert.match(source, /workshopModerationDecisionSchema\.parse\(input\)/);
  assert.match(source, /workshopModerationDetailSchema\.parse/);
});

test("protected variants are validated and converted to bounded data URLs", () => {
  assert.match(source, /workshopModerationVariantSchema\.parse\(variant\)/);
  assert.match(source, /\/assets\/\$\{encodeURIComponent\(safeVariant\)\}/);
  assert.match(source, /arrayBuffer\(\)/);
  assert.match(source, /maxProtectedAssetBytes/);
  assert.match(source, /headers\.get\("content-length"\)/);
  assert.match(source, /declaredLength > maxProtectedAssetBytes/);
  assert.match(source, /`data:\$\{contentType\};base64,/);
  assert.doesNotMatch(source, /storageKey/);
});
