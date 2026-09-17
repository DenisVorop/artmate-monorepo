import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readSource(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const routeSource = readSource("../app/payouts/page.tsx");
const pageSource = readSource("../src/_pages/payouts/index.tsx");
const builderSource = readSource("../src/_app/lib/affiliate-data-builder.ts");
const actionSource = readSource(
  "../src/shared/actions/affiliate/affiliate.actions.ts",
);
const mutationSource = readSource(
  "../src/features/affiliate-payouts/model/use-create-affiliate-payout.ts",
);
const formStateSource = readSource(
  "../src/features/affiliate-payouts/lib/use-payout-form.ts",
);

test("protects and hydrates the dedicated payouts route", () => {
  assert.match(routeSource, /buildAffiliateData\("\/payouts"/);
  assert.match(routeSource, /includePayouts:\s*true/);
  assert.match(builderSource, /affiliatePayoutsQuery/);
  assert.match(builderSource, /prefetchQuery/);
  assert.match(builderSource, /dehydrateQueryClient/);
});

test("keeps the payouts page as composition only", () => {
  assert.match(pageSource, /AffiliatePayouts/);
  assert.match(pageSource, /CabinetShell/);
  assert.doesNotMatch(pageSource, /useQuery|useMutation|useAffiliatePayoutsData/);
});

test("sends request id and selected amount through transport", () => {
  assert.match(actionSource, /createAffiliatePayout/);
  assert.match(actionSource, /\/affiliate\/payouts/);
  assert.match(actionSource, /JSON\.stringify\(input\)/);
});

test("does not automatically retry money mutations or mint ids in transport", () => {
  assert.match(mutationSource, /retry:\s*0/);
  assert.doesNotMatch(mutationSource, /randomUUID/);
  assert.doesNotMatch(actionSource, /randomUUID/);
});

test("preserves an uncertain request id and payload for deliberate retries", () => {
  assert.match(formStateSource, /useRef/);
  assert.match(formStateSource, /amountKopecks/);
  assert.match(formStateSource, /shouldRetainPayoutAttempt/);
  assert.match(formStateSource, /attemptRef\.current/);
  assert.match(formStateSource, /sendingRef/);
  assert.match(formStateSource, /retryUncertain/);
  assert.match(formStateSource, /catch/);
});
