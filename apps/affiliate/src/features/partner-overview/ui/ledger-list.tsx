import { ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";

import {
  formatFinanceKopecks,
  formatSignedFinanceKopecks,
  type AffiliateLedger,
} from "@/entities/affiliate-finance";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataState,
} from "@/shared/ui";

import {
  formatMoscowDateTime,
  getLedgerPresentation,
  getLedgerStatusHint,
} from "../lib";

import { Pagination } from "./pagination";
import { StatusHint } from "./status-hint";
type LedgerListProps = {
  readonly data: AffiliateLedger | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isPending: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onRetry: () => void;
  readonly page: number;
};

export function LedgerList({
  data,
  isError,
  isFetching,
  isPending,
  onPageChange,
  onRetry,
  page,
}: LedgerListProps) {
  if (isPending) {
    return <DataState compact status="loading" title="Загружаем операции" />;
  }

  if (isError || !data) {
    return (
      <DataState compact status="error" title="Не удалось загрузить операции">
        <Button onClick={onRetry} variant="outline">
          Повторить
        </Button>
      </DataState>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Операции</CardTitle>
        <p className="text-sm text-muted-foreground">
          Начисления и возвраты за выбранный период.
        </p>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
            <ReceiptText
              className="mx-auto text-violet-600"
              aria-hidden="true"
            />
            <p className="font-heading mt-3 font-bold">Операций пока нет</p>
            <p className="mt-1 text-sm text-muted-foreground">
              За выбранный период журнал пуст.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {data.items.map((item) => {
              const presentation = getLedgerPresentation(item);
              const statusHint = getLedgerStatusHint(item);

              return (
                <article
                  className="flex min-w-0 gap-3 py-4 first:pt-0 last:pb-0"
                  key={item.id}
                >
                  <span
                    className={
                      item.kind === "credit"
                        ? "grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"
                        : "grid size-10 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-700"
                    }
                  >
                    {item.kind === "credit" ? (
                      <ArrowUpRight aria-hidden="true" />
                    ) : (
                      <ArrowDownLeft aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-5">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words font-extrabold [overflow-wrap:anywhere]">
                          {item.code}
                        </p>
                        <Badge variant="secondary">
                          {presentation.kindLabel}
                        </Badge>
                        {presentation.statusLabel && statusHint ? (
                          <StatusHint
                            hint={statusHint}
                            label={presentation.statusLabel}
                          />
                        ) : null}
                      </div>
                      {presentation.note ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {presentation.note}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatMoscowDateTime(item.createdAt)} МСК · доля{" "}
                        {item.partnerPercent}%
                      </p>
                    </div>
                    <p className="mt-3 min-w-0 break-words font-heading text-lg font-bold tabular-nums [overflow-wrap:anywhere] sm:mt-0 sm:text-right">
                      {item.amountKopecks === 0
                        ? formatFinanceKopecks(0)
                        : formatSignedFinanceKopecks(item.amountKopecks)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <Pagination
          isFetching={isFetching}
          label="Страницы операций"
          onPageChange={onPageChange}
          page={page}
          totalPages={totalPages}
        />
      </CardContent>
    </Card>
  );
}
