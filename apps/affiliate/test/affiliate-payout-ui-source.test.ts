import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readSource(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const featureSource = readSource(
  "../src/features/affiliate-payouts/ui/affiliate-payouts.tsx",
);
const formSource = readSource(
  "../src/features/affiliate-payouts/ui/payout-form.tsx",
);
const formHookSource = readSource(
  "../src/features/affiliate-payouts/lib/use-payout-form.ts",
);
const historySource = readSource(
  "../src/features/affiliate-payouts/ui/payout-history.tsx",
);
const summarySource = readSource(
  "../src/features/affiliate-payouts/ui/payout-summary.tsx",
);
const shellSource = readSource(
  "../src/widgets/cabinet-shell/ui/cabinet-shell.tsx",
);

test("shows authoritative financial summary and effective minimum", () => {
  for (const label of ["Доступно", "В заявке", "Выплачено", "Задолженность"]) {
    assert.match(summarySource, new RegExp(label));
  }
  assert.match(summarySource, /Минимальная сумма/);
  assert.match(summarySource, /formatFinanceKopecks/);
});

test("uses an accessible RHF amount form with full-balance action and confirmation", () => {
  assert.match(formSource, /<form/);
  assert.match(formSource, /\.\.\.amountField/);
  assert.match(formHookSource, /register\("amountRubles"/);
  assert.match(formHookSource, /sanitizePayoutAmountInput/);
  assert.match(formSource, /Вся доступная сумма/);
  assert.match(formSource, /Подтвердить заявку/);
  assert.match(formSource, /confirmation/);
  assert.match(
    formSource,
    /disabled=\{isPending \|\| isUncertain \|\| !isSummaryFresh\}/,
  );
  assert.match(
    formSource,
    /disabled=\{isPending \|\| \(!isSummaryFresh && !isUncertain\)\}/,
  );
  assert.match(formSource, /role="alert"/);
});

test("renders newest-first paginated history with snapshot and event details", () => {
  assert.match(historySource, /История выплат/);
  assert.doesNotMatch(historySource, /Архив операций/);
  assert.match(historySource, /<details/);
  assert.match(historySource, /Реквизиты/);
  assert.match(historySource, /Версия договора/);
  assert.match(historySource, /События заявки/);
  assert.match(historySource, /Предыдущая/);
  assert.match(historySource, /Следующая/);
  assert.match(historySource, /DataState/);
  assert.match(historySource, /Заявок пока нет/);
});

test("keeps query orchestration inside the feature", () => {
  assert.match(featureSource, /useAffiliatePayouts/);
  assert.doesNotMatch(featureSource, /useState|useAffiliatePayoutsData/);
  assert.match(featureSource, /PayoutSummary/);
  assert.match(featureSource, /PayoutHistory/);
});

test("keeps the payout form mounted from last-known summary during history transitions", () => {
  assert.match(featureSource, /summary\s*\?/);
  assert.match(featureSource, /<PayoutForm[^>]*isSummaryFresh=/s);
  assert.doesNotMatch(featureSource, /payouts\.isPending\s*\?\s*\([\s\S]*<PayoutForm/);
});

test("shows a background history error without dropping retained history data", () => {
  assert.match(historySource, /isError && data/);
  assert.match(historySource, /:\s*!data\s*\?/);
});

test("wraps long event reasons and uses a mobile-safe pagination layout", () => {
  assert.match(historySource, /event\.reason[\s\S]*\[overflow-wrap:anywhere\]/);
  assert.match(historySource, /grid-cols-2/);
  assert.match(historySource, /sm:flex/);
});

test("formats contract signed date as an existing UTC calendar date", () => {
  assert.match(historySource, /formatContractDate\(payout\.contract\.signedAt\)/);
  assert.doesNotMatch(historySource, /formatPayoutDate\(payout\.contract\.signedAt\)/);
});

test("allows long mobile navigation labels to wrap inside four columns", () => {
  assert.match(shellSource, /grid-cols-4/);
  assert.match(shellSource, /\[overflow-wrap:anywhere\]/);
});
