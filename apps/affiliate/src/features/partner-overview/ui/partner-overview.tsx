"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";

import { Button, DataState } from "@/shared/ui";

import { usePartnerOverview } from "../lib";

import { BalanceCard } from "./balance-card";
import { CodePerformance } from "./code-performance";
import { EarningsChart } from "./earnings-chart";
import { LedgerList } from "./ledger-list";
import { MetricCards } from "./metric-cards";
import { PeriodControls } from "./period-controls";

export function PartnerOverview() {
  const {
    analytics,
    codePage,
    days,
    ledger,
    ledgerPage,
    refresh,
    setCodePage,
    setDays,
    setLedgerPage,
  } = usePartnerOverview();
  const isRefreshing = analytics.isFetching || ledger.isFetching;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-10 lg:py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold tracking-[0.16em] text-rose-600 uppercase">
            Artmate partner
          </p>
          <h1 className="font-heading mt-2 text-3xl leading-tight font-bold text-ink sm:text-4xl">
            Финансовый обзор
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Доход, продажи по промокодам и все операции в одном месте.
          </p>
        </div>
        <Button
          className="self-start sm:self-auto"
          disabled={isRefreshing}
          onClick={() => void refresh()}
          type="button"
          variant="outline"
        >
          {isRefreshing ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          Обновить
        </Button>
      </header>

      <div className="mt-7">
        <PeriodControls days={days} onChange={setDays} />
      </div>

      {analytics.isPending ? (
        <div className="mt-6">
          <DataState
            compact
            description="Собираем баланс и статистику за выбранный период."
            status="loading"
            title="Загружаем аналитику"
          />
        </div>
      ) : analytics.isError || !analytics.data ? (
        <div className="mt-6">
          <DataState
            compact
            description="Попробуйте ещё раз чуть позже."
            status="error"
            title="Не удалось загрузить аналитику"
          >
            <Button onClick={() => void analytics.refetch()} variant="outline">
              Повторить
            </Button>
          </DataState>
        </div>
      ) : (
        <>
          <section
            className="mt-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)]"
            aria-label="Баланс и показатели"
          >
            <BalanceCard
              asOf={analytics.data.asOf}
              balance={analytics.data.balance}
            />
            <MetricCards totals={analytics.data.totals} />
          </section>

          <div className="mt-4">
            <EarningsChart
              daily={analytics.data.daily}
              period={analytics.data.period}
            />
          </div>

          <div className="mt-4">
            <CodePerformance
              codes={analytics.data.codes}
              isFetching={analytics.isFetching}
              onPageChange={setCodePage}
              page={codePage}
            />
          </div>
        </>
      )}

      <div className="mt-4">
        <LedgerList
          data={ledger.data}
          isError={ledger.isError}
          isFetching={ledger.isFetching}
          isPending={ledger.isPending}
          onPageChange={setLedgerPage}
          onRetry={() => void ledger.refetch()}
          page={ledgerPage}
        />
      </div>
    </main>
  );
}
