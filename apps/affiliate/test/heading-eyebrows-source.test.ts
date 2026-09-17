import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const pageSources = [
  readSource("../src/features/partner-overview/ui/partner-overview.tsx"),
  readSource("../src/features/affiliate-payouts/ui/affiliate-payouts.tsx"),
  readSource("../src/_pages/access-denied/index.tsx"),
  readSource("../src/_pages/unavailable/index.tsx"),
];

test("removes redundant partner eyebrows while retaining page headings", () => {
  for (const source of pageSources) {
    assert.doesNotMatch(source, /artmate partner/i);
    assert.match(source, /<h1/);
  }
});

test("removes unused sparkle icons from status pages", () => {
  for (const source of pageSources.slice(2)) {
    assert.doesNotMatch(source, /Sparkles/);
  }
});
