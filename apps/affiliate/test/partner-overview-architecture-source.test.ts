import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readSource(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const routeSource = readSource("../app/page.tsx");
const builderSource = readSource("../src/_app/lib/affiliate-data-builder.ts");
const querySource = readSource(
  "../src/entities/affiliate-finance/model/query.ts",
);
const featureSource = readSource(
  "../src/features/partner-overview/ui/partner-overview.tsx",
);
const stateSource = readSource(
  "../src/features/partner-overview/lib/use-partner-overview.ts",
);

test("hydrates both financial queries from the route data builder", () => {
  assert.match(routeSource, /includeFinance:\s*true/);
  assert.match(builderSource, /affiliateAnalyticsQuery/);
  assert.match(builderSource, /affiliateLedgerQuery/);
  assert.match(builderSource, /prefetchQuery/);
  assert.match(builderSource, /dehydrateQueryClient/);
});

test("financial reads are finite-stale and refresh on focus without old-page placeholders", () => {
  assert.match(querySource, /staleTime:\s*30_000/);
  assert.match(querySource, /refetchOnWindowFocus:\s*true/);
  assert.doesNotMatch(querySource, /keepPreviousData|placeholderData/);
});

test("keeps query orchestration out of overview UI", () => {
  assert.match(featureSource, /usePartnerOverview/);
  assert.doesNotMatch(featureSource, /useAffiliate(Analytics|Ledger)Data/);
  assert.match(stateSource, /^"use client";/);
  assert.match(stateSource, /useAffiliateAnalyticsData/);
  assert.match(stateSource, /useAffiliateLedgerData/);
});
