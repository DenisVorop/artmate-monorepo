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

test("partner finance uses owner-scoped analytics and ledger queries", async () => {
  const [actions, query, analyticsHook, ledgerHook] = await Promise.all([
    source(
      "src/shared/actions/affiliate-partners/affiliate-partners.actions.ts",
    ),
    source("src/entities/affiliate-partners/model/query.ts"),
    source(
      "src/entities/affiliate-partners/model/use-affiliate-partner-analytics.ts",
    ),
    source(
      "src/entities/affiliate-partners/model/use-affiliate-partner-ledger.ts",
    ),
  ]);

  assert.match(
    actions,
    /partners\/\$\{encodeURIComponent\(userId\)\}\/analytics/,
  );
  assert.match(actions, /partners\/\$\{encodeURIComponent\(userId\)\}\/ledger/);
  assert.match(query, /finance: \(\) =>/);
  assert.match(query, /analytics: \(userId: string, params:/);
  assert.match(query, /ledger: \(userId: string, params:/);
  assert.match(query, /staleTime: 30_000/);
  const analyticsQuery = query.slice(
    query.indexOf(
      "  analytics: (userId",
      query.indexOf("export const affiliatePartnersQuery ="),
    ),
    query.indexOf(
      "  ledger: (userId",
      query.indexOf("export const affiliatePartnersQuery ="),
    ),
  );
  const ledgerQuery = query.slice(
    query.indexOf(
      "  ledger: (userId",
      query.indexOf("export const affiliatePartnersQuery ="),
    ),
  );
  assert.match(analyticsQuery, /refetchOnWindowFocus: true/);
  assert.match(ledgerQuery, /refetchOnWindowFocus: true/);
  assert.match(
    analyticsHook,
    /affiliatePartnersQuery\.analytics\(userId, params\)/,
  );
  assert.match(ledgerHook, /affiliatePartnersQuery\.ledger\(userId, params\)/);
});

test("partner finance stays inside partners management with reset pagination and isolated states", async () => {
  const [management, finance, state, obsoleteFeature] = await Promise.all([
    source("src/features/partners-management/ui/partners-management.tsx"),
    source("src/features/partners-management/ui/partner-finance.tsx"),
    source("src/features/partners-management/lib/use-partner-finance-state.ts"),
    source("src/features/partner-finance/index.ts"),
  ]);

  assert.match(
    management,
    /import \{ PartnerFinance \} from "\.\/partner-finance"/,
  );
  assert.match(management, /<PartnerFinance/);
  assert.doesNotMatch(management, /@\/features\/partner-finance/);
  assert.match(finance, /useAffiliatePartnerAnalytics/);
  assert.match(finance, /useAffiliatePartnerLedger/);
  assert.match(finance, /analyticsQuery\.isError/);
  assert.match(finance, /ledgerQuery\.isError/);
  assert.match(finance, /aria-label="Обновить финансовые данные"/);
  assert.match(finance, /analyticsQuery\.isFetching/);
  assert.match(state, /setCodePage\(1\)/);
  assert.match(state, /setLedgerPage\(1\)/);
  assert.equal(obsoleteFeature, "");
});

test("finance presentation is split and communicates exact financial semantics", async () => {
  const [finance, analytics, chart, ledger, presenters] = await Promise.all([
    source("src/features/partners-management/ui/partner-finance.tsx"),
    source("src/features/partners-management/ui/finance-analytics.tsx"),
    source("src/features/partners-management/ui/finance-chart.tsx"),
    source("src/features/partners-management/ui/finance-ledger.tsx"),
    source("src/features/partners-management/lib/finance-presenters.ts"),
  ]);

  assert.match(analytics, /до скидки/);
  assert.match(finance, /analyticsQuery\.data\?\.period\.days === days/);
  assert.match(finance, /ledgerQuery\.data\?\.period\.days === days/);
  assert.doesNotMatch(finance, /items={ledger\?\.items \?\? \[\]}/);
  assert.match(chart, /useId\(\)/);
  assert.match(chart, /<details/);
  assert.match(chart, /Первый день/);
  assert.match(chart, /Последний день/);
  assert.match(chart, /Нулевая линия/);
  assert.match(ledger, /flex-col.*sm:flex-row/s);
  assert.match(ledger, /isError \|\| !ledger/);
  assert.doesNotMatch(ledger, /shrink-0.*formatKopecks/s);
  assert.match(presenters, /status === "pending"/);
  assert.match(presenters, /status === "available"/);
  assert.match(presenters, /Будет доступно/);
  assert.match(ledger, /getLedgerHoldReasonLabel/);
  assert.match(chart, /getNewestFinanceDays\(daily\)/);
  assert.doesNotMatch(presenters, /status === "held".*Доступно с/s);
});

test("affiliate response contracts require code limit and ledger hold reason", async () => {
  const contracts = await source(
    "src/shared/actions/affiliate-partners/affiliate-partners.types.ts",
  );

  assert.match(contracts, /AffiliateCodesPageDTO[\s\S]*?limit: number/);
  assert.match(
    contracts,
    /holdReason:\s*\| "order_cancelled"\s*\| "payment_not_confirmed"\s*\| "order_not_completed"\s*\| null/,
  );
});

test("recording a refund invalidates cached partner finance", async () => {
  const mutation = await source(
    "src/features/order-refunds/model/use-record-order-refund.ts",
  );

  assert.match(mutation, /affiliatePartnersQueryKeys\.finance\(\)/);
});
