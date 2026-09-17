"use client";

import { useId } from "react";

import {
  formatKopecks,
  type AffiliatePartnerAnalytics,
} from "@/entities/affiliate-partners";

import {
  formatFinanceDate,
  getFinanceChartModel,
  getNewestFinanceDays,
} from "../lib";

const chartWidth = 640;
const chartHeight = 160;
const chartInset = 14;

export function FinanceChart({
  daily,
}: {
  readonly daily: AffiliatePartnerAnalytics["daily"];
}) {
  const gradientId = `${useId()}-finance-line`;
  const chart = getFinanceChartModel(
    daily,
    chartWidth,
    chartHeight,
    chartInset,
  );

  return (
    <section
      className="min-w-0 space-y-2"
      aria-labelledby="partner-daily-chart-title"
    >
      <div>
        <h3
          id="partner-daily-chart-title"
          className="font-heading text-sm font-medium"
        >
          Динамика вознаграждения
        </h3>
        <p className="text-xs text-muted-foreground">
          Итог начислений и возвратов по дням, МСК.
        </p>
      </div>
      <div className="min-w-0 rounded-lg border bg-zinc-950 p-3 text-zinc-300">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
          <div className="flex flex-col justify-between py-1 text-right text-[10px] tabular-nums text-zinc-400">
            <span>{formatKopecks(chart.extent)}</span>
            <span>0 ₽</span>
            <span>{formatKopecks(-chart.extent)}</span>
          </div>
          <svg
            aria-label={`Дневная динамика за ${daily.length} дней от ${formatKopecks(-chart.extent)} до ${formatKopecks(chart.extent)}`}
            className="h-36 w-full"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="1">
                <stop offset="0" stopColor="#f97316" />
                <stop offset="0.5" stopColor="#ec4899" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <line
              x1="0"
              x2={chartWidth}
              y1={chartHeight / 2}
              y2={chartHeight / 2}
              stroke="#71717a"
              strokeDasharray="4 5"
            />
            {daily.length ? (
              <polyline
                fill="none"
                points={chart.points}
                stroke={`url(#${gradientId})`}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
        </div>
        <div className="mt-1 flex min-w-0 justify-between gap-3 text-[10px] text-zinc-400">
          <span className="min-w-0">
            Первый день:{" "}
            {chart.firstDate ? formatFinanceDate(chart.firstDate) : "—"}
          </span>
          <span className="min-w-0 text-right">
            Последний день:{" "}
            {chart.lastDate ? formatFinanceDate(chart.lastDate) : "—"}
          </span>
        </div>
        <p className="mt-1 text-center text-[10px] text-zinc-500">
          Нулевая линия показана пунктиром
        </p>
      </div>
      <details className="rounded-lg border bg-card text-xs">
        <summary className="cursor-pointer px-3 py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Значения по дням
        </summary>
        <dl className="grid max-h-52 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 overflow-y-auto border-t px-3 py-2 tabular-nums">
          {getNewestFinanceDays(daily).map((day) => (
            <div className="contents" key={day.date}>
              <dt className="text-muted-foreground">
                {formatFinanceDate(day.date)}
              </dt>
              <dd className="min-w-0 break-words text-right">
                {formatKopecks(day.netKopecks)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
