import {
  formatKopecks,
  type AffiliatePartnerAnalytics,
} from "@/entities/affiliate-partners";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/shared/ui";

import { FinanceBalance } from "./finance-balance";
import { FinanceChart } from "./finance-chart";
import {
  FinanceEmpty,
  FinanceError,
  FinanceLoading,
  FinancePagination,
} from "./finance-states";

export function FinanceAnalytics({
  analytics,
  codePage,
  isError,
  isPending,
  onCodePageChange,
  onRetry,
}: {
  readonly analytics?: AffiliatePartnerAnalytics;
  readonly codePage: number;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly onCodePageChange: (page: number) => void;
  readonly onRetry: () => void;
}) {
  if (isPending) {
    return <FinanceLoading label="Загружаем баланс и аналитику…" />;
  }
  if (isError || !analytics) {
    return (
      <FinanceError
        label="Не удалось загрузить баланс и аналитику."
        onRetry={onRetry}
      />
    );
  }

  const codePages = Math.max(
    1,
    Math.ceil(analytics.codes.total / analytics.codes.pageSize),
  );

  return (
    <div className="min-w-0 space-y-4">
      <FinanceBalance balance={analytics.balance} asOf={analytics.asOf} />
      <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-5">
        <Metric label="Заказы" value={String(analytics.totals.orderCount)} />
        <Metric
          label="Продажи"
          value={formatKopecks(analytics.totals.salesKopecks)}
        />
        <Metric
          label="Начислено"
          value={formatKopecks(analytics.totals.earnedKopecks)}
        />
        <Metric
          label="Возвраты"
          value={formatKopecks(analytics.totals.reversedKopecks)}
        />
        <Metric
          className="col-span-2 lg:col-span-1"
          label="Итого"
          value={formatKopecks(analytics.totals.netKopecks)}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Продажи — сумма товаров до скидки покупателя, без доставки. Заказы и
        продажи не уменьшаются на возвраты.
      </p>
      <FinanceChart daily={analytics.daily} />

      <section
        className="min-w-0 space-y-2"
        aria-labelledby="partner-code-statistics-title"
      >
        <h3
          id="partner-code-statistics-title"
          className="font-heading text-sm font-medium"
        >
          Статистика по промокодам
        </h3>
        {analytics.codes.items.length ? (
          <div className="grid min-w-0 gap-2">
            {analytics.codes.items.map((code) => (
              <article
                className="min-w-0 rounded-lg border bg-card p-3"
                key={code.code}
              >
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <strong className="min-w-0 break-all font-mono text-xs">
                    {code.code}
                  </strong>
                  <span className="min-w-0 break-words text-sm font-semibold tabular-nums sm:text-right">
                    {formatKopecks(code.netKopecks)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                  <Stat label="Заказы" value={String(code.orderCount)} />
                  <Stat
                    label="Продажи"
                    value={formatKopecks(code.salesKopecks)}
                  />
                  <Stat
                    label="Начислено"
                    value={formatKopecks(code.earnedKopecks)}
                  />
                  <Stat
                    label="Возвраты"
                    value={formatKopecks(code.reversedKopecks)}
                  />
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <FinanceEmpty label="За этот период операций по промокодам нет." />
        )}
        <FinancePagination
          currentPage={codePage}
          label="Пагинация статистики по промокодам"
          onPageChange={onCodePageChange}
          totalPages={codePages}
        />
      </section>
    </div>
  );
}

function Metric({
  className,
  label,
  value,
}: {
  readonly className?: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Card className={cn("min-w-0", className)} size="sm">
      <CardContent className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 min-w-0 break-words font-heading text-sm font-semibold tabular-nums">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words tabular-nums">{value}</dd>
    </div>
  );
}
