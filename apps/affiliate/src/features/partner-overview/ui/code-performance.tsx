import { TicketPercent } from "lucide-react";

import {
  formatFinanceKopecks,
  formatOrderCount,
  type AffiliateAnalytics,
} from "@/entities/affiliate-finance";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataState,
} from "@/shared/ui";

import { Pagination } from "./pagination";

type CodePerformanceProps = {
  readonly codes: AffiliateAnalytics["codes"] | undefined;
  readonly isError?: boolean;
  readonly isFetching: boolean;
  readonly isPending?: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onRetry?: () => void;
  readonly page: number;
};

export function CodePerformance({
  codes,
  isError = false,
  isFetching,
  isPending = false,
  onPageChange,
  onRetry,
  page,
}: CodePerformanceProps) {
  if (isPending) {
    return (
      <DataState compact status="loading" title="Загружаем продажи по кодам" />
    );
  }

  if (isError || !codes) {
    return (
      <DataState
        compact
        status="error"
        title="Не удалось загрузить продажи по кодам"
      >
        <Button onClick={onRetry} type="button" variant="outline">
          Повторить
        </Button>
      </DataState>
    );
  }

  const totalPages = Math.max(1, Math.ceil(codes.total / codes.pageSize));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Продажи по промокодам</CardTitle>
        <p className="text-sm text-muted-foreground">
          Только коды с активностью за период.
        </p>
      </CardHeader>
      <CardContent>
        {codes.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
            <TicketPercent
              className="mx-auto text-rose-500"
              aria-hidden="true"
            />
            <p className="font-heading mt-3 font-bold">Нет продаж по кодам</p>
            <p className="mt-1 text-sm text-muted-foreground">
              За выбранный период активности не было.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {codes.items.map((item) => (
              <article
                className="min-w-0 rounded-2xl bg-muted/55 p-4"
                key={item.code}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="min-w-0 break-words font-extrabold text-ink [overflow-wrap:anywhere]">
                    {item.code}
                  </p>
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">
                    {formatOrderCount(item.orderCount)} заказов
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Продажи</dt>
                    <dd className="mt-1 min-w-0 break-words font-bold tabular-nums [overflow-wrap:anywhere]">
                      {formatFinanceKopecks(item.salesKopecks)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Начислено</dt>
                    <dd className="mt-1 min-w-0 break-words font-bold tabular-nums [overflow-wrap:anywhere]">
                      {formatFinanceKopecks(item.earnedKopecks)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Возвраты</dt>
                    <dd className="mt-1 min-w-0 break-words font-bold tabular-nums [overflow-wrap:anywhere]">
                      {formatFinanceKopecks(item.reversedKopecks)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Чистый доход
                    </dt>
                    <dd className="mt-1 min-w-0 break-words font-bold tabular-nums [overflow-wrap:anywhere]">
                      {formatFinanceKopecks(item.netKopecks)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
        <Pagination
          isFetching={isFetching}
          label="Страницы продаж по промокодам"
          onPageChange={onPageChange}
          page={page}
          totalPages={totalPages}
        />
      </CardContent>
    </Card>
  );
}
