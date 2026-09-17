"use client";

import { useId } from "react";

import {
  formatAnalyticsDate,
  formatFinanceKopecks,
  type AffiliateAnalytics,
  type AffiliateAnalyticsPeriod,
} from "@/entities/affiliate-finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { getDailyTableRows, getEarningsChartGeometry } from "../lib";

type EarningsChartProps = {
  readonly daily: AffiliateAnalytics["daily"];
  readonly period: AffiliateAnalyticsPeriod;
};

export function EarningsChart({ daily, period }: EarningsChartProps) {
  const id = useId();
  const titleId = `earnings-chart-title-${id}`;
  const descriptionId = `earnings-chart-description-${id}`;
  const gradientId = `earnings-chart-gradient-${id}`;
  const geometry = getEarningsChartGeometry(daily);
  const tableRows = getDailyTableRows(daily);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="sm:flex sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle>Динамика вознаграждения</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Начисления минус возвраты по дням, время московское.
          </p>
        </div>
        <p className="mt-2 text-xs font-bold text-muted-foreground sm:mt-0">
          {period.days} дней
        </p>
      </CardHeader>
      <CardContent>
        <div className="min-w-0 rounded-2xl bg-muted/45 px-3 py-4 sm:px-5">
          <div className="grid grid-cols-3 gap-2 text-xs leading-5 text-muted-foreground">
            <p>
              Максимум
              <strong className="block text-sm text-ink tabular-nums">
                {formatFinanceKopecks(geometry.domain.max)}
              </strong>
            </p>
            <p className="text-center">
              Нулевая линия
              <strong className="block text-sm text-ink tabular-nums">
                0 ₽
              </strong>
            </p>
            <p className="text-right">
              Минимум
              <strong className="block text-sm text-ink tabular-nums">
                {formatFinanceKopecks(geometry.domain.min)}
              </strong>
            </p>
          </div>

          <svg
            aria-labelledby={`${titleId} ${descriptionId}`}
            className="mt-3 h-56 w-full"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${geometry.chartWidth} 240`}
          >
            <title id={titleId}>Чистый доход по дням</title>
            <desc id={descriptionId}>
              Столбцы выше нулевой линии означают доход, ниже линии означают
              возвраты, превысившие начисления за день.
            </desc>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#e73786" />
                <stop offset="1" stopColor="#7258b8" />
              </linearGradient>
            </defs>
            <line
              className="text-foreground/10"
              stroke="currentColor"
              x1={geometry.plotLeft}
              x2={geometry.plotRight}
              y1={geometry.plotTop}
              y2={geometry.plotTop}
            />
            <line
              className="text-foreground/10"
              stroke="currentColor"
              x1={geometry.plotLeft}
              x2={geometry.plotRight}
              y1={geometry.plotBottom}
              y2={geometry.plotBottom}
            />
            <line
              className="text-foreground/35"
              stroke="currentColor"
              strokeDasharray="7 7"
              strokeWidth="2"
              x1={geometry.plotLeft}
              x2={geometry.plotRight}
              y1={geometry.zeroY}
              y2={geometry.zeroY}
            />
            {daily.map((item, index) => {
              const bar = geometry.getBar(index, item.netKopecks);

              return (
                <rect
                  aria-label={`${formatAnalyticsDate(item.date)}: ${formatFinanceKopecks(item.netKopecks)}`}
                  className="focus-visible:stroke-white focus-visible:stroke-[8] focus-visible:outline-none"
                  fill={item.netKopecks < 0 ? "#f97316" : `url(#${gradientId})`}
                  height={bar.height}
                  key={item.date}
                  rx={Math.min(4, geometry.barWidth / 2)}
                  tabIndex={0}
                  width={geometry.barWidth}
                  x={bar.x}
                  y={bar.y}
                />
              );
            })}
          </svg>

          <div className="mt-2 flex items-center justify-between gap-4 text-xs font-bold text-muted-foreground">
            <time dateTime={geometry.firstDate ?? undefined}>
              {geometry.firstDate
                ? formatAnalyticsDate(geometry.firstDate)
                : "Начало периода"}
            </time>
            <time dateTime={geometry.lastDate ?? undefined}>
              {geometry.lastDate
                ? formatAnalyticsDate(geometry.lastDate)
                : "Конец периода"}
            </time>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span
                className="size-2.5 rounded-full bg-rose-500"
                aria-hidden="true"
              />
              Доход
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="size-2.5 rounded-full bg-orange-500"
                aria-hidden="true"
              />
              Возвраты выше начислений
            </span>
          </div>
        </div>

        <details className="mt-4 rounded-2xl border border-border/70 px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-500">
            Данные по дням
          </summary>
          <div className="mt-3 max-h-72 overflow-auto">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-bold" scope="col">
                    Дата
                  </th>
                  <th className="pb-2 text-right font-bold" scope="col">
                    Заказы
                  </th>
                  <th className="pb-2 text-right font-bold" scope="col">
                    Продажи
                  </th>
                  <th className="pb-2 text-right font-bold" scope="col">
                    Начислено
                  </th>
                  <th className="pb-2 text-right font-bold" scope="col">
                    Возвраты
                  </th>
                  <th className="pb-2 text-right font-bold" scope="col">
                    Чистый доход
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tableRows.map((item) => (
                  <tr key={item.date}>
                    <th className="py-2 font-bold" scope="row">
                      {formatAnalyticsDate(item.date)}
                    </th>
                    <td className="py-2 text-right tabular-nums">
                      {item.orderCount}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatFinanceKopecks(item.salesKopecks)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatFinanceKopecks(item.earnedKopecks)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatFinanceKopecks(item.reversedKopecks)}
                    </td>
                    <td className="py-2 text-right font-bold tabular-nums">
                      {formatFinanceKopecks(item.netKopecks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
