import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  try {
    return await readFile(new URL(path, root), "utf8");
  } catch {
    return "";
  }
}

test("payout transport and queries are partner and pagination scoped", async () => {
  const [actions, query, hook] = await Promise.all([
    source("src/shared/actions/affiliate-partners/affiliate-partners.actions.ts"),
    source("src/entities/affiliate-partners/model/query.ts"),
    source("src/entities/affiliate-partners/model/use-affiliate-partner-payouts.ts"),
  ]);

  assert.match(actions, /partners\/\$\{encodeURIComponent\(userId\)\}\/payouts\?\$\{searchParams\}/);
  assert.match(actions, /payouts\/\$\{encodeURIComponent\(payoutId\)\}\/paid/);
  assert.match(actions, /payouts\/\$\{encodeURIComponent\(payoutId\)\}\/reject/);
  assert.match(actions, /code: error instanceof AdminApiError \? error\.code : undefined/);
  assert.match(query, /payoutsScope: \(userId: string\)/);
  assert.match(query, /payouts: \(userId: string, params: AffiliatePartnerPayoutsParams\)/);
  assert.match(hook, /affiliatePartnersQuery\.payouts\(userId, params\)/);
});

test("payout mutations invalidate payouts and analytics with stable errors", async () => {
  const [paid, reject, presenters] = await Promise.all([
    source("src/features/partners-management/model/use-record-affiliate-payout.ts"),
    source("src/features/partners-management/model/use-reject-affiliate-payout.ts"),
    source("src/features/partners-management/lib/payout-presenters.ts"),
  ]);

  for (const mutation of [paid, reject]) {
    assert.match(mutation, /affiliatePartnersQueryKeys\.payoutsScope\(userId\)/);
    assert.match(mutation, /affiliatePartnersQueryKeys\.analyticsScope\(userId\)/);
    assert.match(mutation, /disableToast: true/);
    assert.match(mutation, /error\.code = result\.code/);
    assert.match(mutation, /onError: async \(error, \{ userId \}\)/);
  }
  assert.match(presenters, /affiliate_payout_request_conflict/);
  assert.match(presenters, /affiliate_payout_duplicate_reference/);
  assert.match(presenters, /affiliate_payout_invalid_status/);
  assert.match(presenters, /affiliate_payout_open_request/);
  assert.match(presenters, /affiliate_payout_below_minimum/);
  assert.match(presenters, /affiliate_payout_unavailable_balance/);
});

test("payout UI shows immutable amount, snapshots and keeps orchestration in lib", async () => {
  const [management, payouts, paidDialog, rejectDialog, paidForm, rejectForm, state] = await Promise.all([
    source("src/features/partners-management/ui/partners-management.tsx"),
    source("src/features/partners-management/ui/partner-payouts.tsx"),
    source("src/features/partners-management/ui/record-payout-dialog.tsx"),
    source("src/features/partners-management/ui/reject-payout-dialog.tsx"),
    source("src/features/partners-management/lib/use-record-payout-form.ts"),
    source("src/features/partners-management/lib/use-reject-payout-form.ts"),
    source("src/features/partners-management/lib/use-partner-payouts-state.ts"),
  ]);

  assert.match(management, /<PartnerPayouts/);
  assert.match(management, /partnerStatus={detailQuery\.data\?\.status}/);
  assert.match(payouts, /payout\.amountKopecks/);
  assert.match(payouts, /payout\.minimumPayoutKopecks/);
  assert.match(payouts, /payout\.contract\.paymentDetails/);
  assert.match(payouts, /payout\.events/);
  assert.match(payouts, /payout\.status === "pending"/);
  assert.match(payouts, /partnerStatus === "active"/);
  assert.match(
    payouts,
    /canMarkPaid={data\.summary\.blockedReason !== "partner_inactive"}/,
  );
  assert.doesNotMatch(paidDialog, /register\("amount/);
  assert.match(paidDialog, /Сохранение не переводит деньги/);
  assert.match(paidDialog, /type="datetime-local"/);
  assert.match(rejectDialog, /register\("reason"\)/);
  assert.doesNotMatch(paidDialog, /useForm|useRef|useState/);
  assert.doesNotMatch(rejectDialog, /useForm|useRef|useState/);
  assert.doesNotMatch(payouts, /useState|Intl\.DateTimeFormat/);
  assert.match(paidForm, /submitLock\.current/);
  assert.match(rejectForm, /submitLock\.current/);
  assert.match(state, /useState\(1\)/);
});

test("analytics balance requires payout semantics and refund refreshes finance", async () => {
  const [contracts, balance, refund] = await Promise.all([
    source("src/shared/actions/affiliate-partners/affiliate-partners.types.ts"),
    source("src/features/partners-management/ui/finance-balance.tsx"),
    source("src/features/order-refunds/model/use-record-order-refund.ts"),
  ]);

  assert.match(contracts, /reservedKopecks: number/);
  assert.match(contracts, /paidKopecks: number/);
  assert.match(contracts, /debtKopecks: number/);
  assert.match(balance, /В заявке/);
  assert.match(balance, /Выплачено/);
  assert.match(balance, /Задолженность/);
  assert.match(refund, /affiliatePartnersQueryKeys\.finance\(\)/);
});
