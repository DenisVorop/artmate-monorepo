"use client";

import { LoaderCircle, RefreshCw, WalletCards } from "lucide-react";

import {
  useAffiliatePartnerAnalytics,
  useAffiliatePartnerLedger,
} from "@/entities/affiliate-partners";
import { Badge, Button } from "@/shared/ui";

import {
  financeCodePageSize,
  financeLedgerPageSize,
  financePeriodOptions,
  usePartnerFinanceState,
} from "../lib";
import { FinanceAnalytics } from "./finance-analytics";
import { FinanceLedger } from "./finance-ledger";

export function PartnerFinance({ userId }: { readonly userId: string }) {
  const { codePage, days, ledgerPage, setCodePage, setDays, setLedgerPage } =
    usePartnerFinanceState();
  const analyticsQuery = useAffiliatePartnerAnalytics(userId, {
    days,
    codePage,
    codePageSize: financeCodePageSize,
  });
  const ledgerQuery = useAffiliatePartnerLedger(userId, {
    days,
    page: ledgerPage,
    pageSize: financeLedgerPageSize,
  });
  const analytics =
    analyticsQuery.data?.period.days === days &&
    analyticsQuery.data.codes.page === codePage
      ? analyticsQuery.data
      : undefined;
  const ledger =
    ledgerQuery.data?.period.days === days &&
    ledgerQuery.data.page === ledgerPage
      ? ledgerQuery.data
      : undefined;
  const isRefreshing = analyticsQuery.isFetching || ledgerQuery.isFetching;

  return (
    <section
      className="min-w-0 space-y-4 border-t pt-4"
      aria-labelledby="partner-finance-title"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="partner-finance-title"
            className="flex items-center gap-2 font-heading font-medium"
          >
            <WalletCards
              className="size-4 text-fuchsia-600"
              aria-hidden="true"
            />
            Финансы партнёра
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Баланс на текущий момент и операции за выбранный период.
          </p>
        </div>
        <Button
          aria-label="Обновить финансовые данные"
          disabled={isRefreshing}
          onClick={() =>
            void Promise.all([analyticsQuery.refetch(), ledgerQuery.refetch()])
          }
          size="sm"
          variant="outline"
        >
          {isRefreshing ? (
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          Обновить
        </Button>
      </div>

      <div
        className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
        aria-label="Период аналитики"
      >
        {financePeriodOptions.map((value) => (
          <Button
            aria-pressed={days === value}
            className="flex-1"
            key={value}
            onClick={() => setDays(value)}
            size="sm"
            variant={days === value ? "default" : "ghost"}
          >
            {value} дней
          </Button>
        ))}
      </div>

      {isRefreshing && (analytics || ledger) ? (
        <Badge aria-live="polite" variant="secondary">
          <LoaderCircle
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Обновляем период {days} дней
        </Badge>
      ) : null}

      <FinanceAnalytics
        analytics={analytics}
        codePage={codePage}
        isError={analyticsQuery.isError}
        isPending={analyticsQuery.isPending}
        onCodePageChange={setCodePage}
        onRetry={() => void analyticsQuery.refetch()}
      />
      <FinanceLedger
        isError={ledgerQuery.isError}
        isPending={ledgerQuery.isPending}
        ledger={ledger}
        onPageChange={setLedgerPage}
        onRetry={() => void ledgerQuery.refetch()}
        page={ledgerPage}
      />
    </section>
  );
}
