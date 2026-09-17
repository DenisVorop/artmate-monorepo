"use client";

import { RefreshCw } from "lucide-react";

import { Button, DataState } from "@/shared/ui";

import { useAffiliatePayouts } from "../lib";
import { PayoutForm } from "./payout-form";
import { PayoutHistory } from "./payout-history";
import { PayoutSummary } from "./payout-summary";

export function AffiliatePayouts() {
  const {
    isSummaryFresh,
    page,
    payouts,
    refresh,
    setPage,
    summary,
    summaryQuery,
  } = useAffiliatePayouts();
  const isRefreshing = payouts.isFetching || summaryQuery.isFetching;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-10 lg:py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl leading-tight font-bold text-ink sm:text-4xl">
            Выплаты
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Выберите сумму, отправьте одну заявку и следите за её статусом. Перевод
            выполняется по реквизитам действующего договора.
          </p>
        </div>
        <Button
          className="self-start sm:self-auto"
          disabled={isRefreshing}
          onClick={() => void refresh()}
          type="button"
          variant="outline"
        >
          <RefreshCw
            className={isRefreshing ? "animate-spin" : undefined}
            aria-hidden="true"
          />
          Обновить
        </Button>
      </header>

      {!summary && summaryQuery.isPending ? (
        <div className="mt-7">
          <DataState
            compact
            description="Получаем актуальный остаток и историю заявок."
            status="loading"
            title="Загружаем выплаты"
          />
        </div>
      ) : !summary ? (
        <div className="mt-7">
          <DataState compact status="error" title="Не удалось загрузить выплаты">
            <Button onClick={() => void refresh()} type="button" variant="outline">
              Повторить
            </Button>
          </DataState>
        </div>
      ) : summary ? (
        <>
          <div className="mt-7">
            <PayoutSummary summary={summary} />
          </div>
          <div className="mt-5">
            <PayoutForm
              isSummaryFresh={isSummaryFresh}
              summary={summary}
            />
          </div>
          <div className="mt-10">
            <PayoutHistory
              data={payouts.data}
              isError={payouts.isError}
              isFetching={payouts.isFetching}
              isPending={payouts.isPending}
              onPageChange={setPage}
              onRetry={() => void payouts.refetch()}
              page={page}
            />
          </div>
        </>
      ) : null}
    </main>
  );
}
