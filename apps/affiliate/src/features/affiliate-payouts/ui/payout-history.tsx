import { ChevronLeft, ChevronRight, ChevronDown, FileText } from "lucide-react";

import { formatFinanceKopecks } from "@/entities/affiliate-finance";
import { formatDate as formatContractDate } from "@/entities/affiliate-partner";
import type { AffiliatePayoutList } from "@/entities/affiliate-payout";
import { cn } from "@/shared/lib";
import { Badge, Button, Card, CardContent, DataState } from "@/shared/ui";

import {
  formatPayoutDate,
  getPayoutStatusPresentation,
  getPayoutTotalPages,
} from "../lib";

type PayoutHistoryProps = {
  readonly data: AffiliatePayoutList | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isPending: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onRetry: () => void;
  readonly page: number;
};

export function PayoutHistory({
  data,
  isError,
  isFetching,
  isPending,
  onPageChange,
  onRetry,
  page,
}: PayoutHistoryProps) {
  const totalPages = data ? getPayoutTotalPages(data.total, data.pageSize) : 1;

  return (
    <section aria-labelledby="payout-history-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-ink" id="payout-history-title">
            История выплат
          </h2>
        </div>
        {data ? (
          <p className="text-sm font-bold text-muted-foreground">{data.total} всего</p>
        ) : null}
      </div>

      {isError && data ? (
        <div className="mt-4">
          <DataState
            compact
            description="Показываем последние загруженные данные."
            status="error"
            title="Не удалось обновить историю"
          >
            <Button onClick={onRetry} type="button" variant="outline">
              Повторить
            </Button>
          </DataState>
        </div>
      ) : null}

      {isPending ? (
        <div className="mt-4">
          <DataState compact status="loading" title="Загружаем заявки" />
        </div>
      ) : !data ? (
        <div className="mt-4">
          <DataState compact status="error" title="Не удалось загрузить историю">
            <Button onClick={onRetry} type="button" variant="outline">
              Повторить
            </Button>
          </DataState>
        </div>
      ) : data.items.length === 0 ? (
        <Card className="mt-4 border-dashed">
          <CardContent className="flex items-start gap-3 p-5">
            <FileText className="mt-0.5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-heading font-bold text-ink">Заявок пока нет</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Первая заявка появится здесь сразу после отправки.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-3">
          {data.items.map((payout) => {
            const status = getPayoutStatusPresentation(payout.status);

            return (
              <details
                className="group min-w-0 rounded-2xl border bg-card shadow-sm open:ring-2 open:ring-violet-200/60"
                key={payout.id}
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden sm:p-5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading text-lg font-bold text-ink tabular-nums">
                        {formatFinanceKopecks(payout.amountKopecks)}
                      </p>
                      <Badge
                        className={cn(
                          status.tone === "paid" && "bg-emerald-100 text-emerald-800",
                          status.tone === "pending" && "bg-amber-100 text-amber-900",
                          status.tone === "rejected" && "bg-rose-100 text-rose-800",
                          status.tone === "cancelled" && "bg-muted text-muted-foreground",
                        )}
                        variant="outline"
                      >
                        {status.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Создана {formatPayoutDate(payout.createdAt)}
                    </p>
                  </div>
                  <ChevronDown
                    className="size-5 shrink-0 text-muted-foreground transition group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>

                <div className="min-w-0 border-t px-4 py-5 sm:px-5">
                  <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
                    <Detail label="Минимум на момент заявки" value={formatFinanceKopecks(payout.minimumPayoutKopecks)} />
                    <Detail label="Версия договора" value={`№ ${payout.contract.number}, версия ${payout.contract.version}`} />
                    <Detail label="Договор подписан" value={formatContractDate(payout.contract.signedAt)} />
                    <Detail label="Реквизиты" value={payout.contract.paymentDetails} />
                    {payout.paidAt ? <Detail label="Дата выплаты" value={formatPayoutDate(payout.paidAt)} /> : null}
                    {payout.reference ? <Detail label="Номер операции" value={payout.reference} /> : null}
                    {payout.reason ? <Detail label="Причина" value={payout.reason} /> : null}
                  </dl>

                  <div className="mt-6">
                    <h3 className="text-sm font-extrabold text-ink">События заявки</h3>
                    <ol className="mt-3 grid gap-3 border-l-2 border-violet-100 pl-4">
                      {payout.events.map((event) => (
                        <li className="relative min-w-0 text-sm" key={event.id}>
                          <span className="absolute top-1.5 -left-[1.34rem] size-2 rounded-full bg-violet-500 ring-4 ring-card" />
                          <p className="font-bold text-ink">
                            {getPayoutStatusPresentation(event.status).label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPayoutDate(event.createdAt)}
                          </p>
                          {event.reason ? (
                            <p className="mt-1 break-words leading-6 [overflow-wrap:anywhere]">
                              {event.reason}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </details>
            );
          })}

          {totalPages > 1 ? (
            <nav
              className="mt-2 grid grid-cols-2 items-center gap-2 sm:flex sm:justify-between sm:gap-3"
              aria-label="Страницы истории выплат"
            >
              <Button
                disabled={page <= 1 || isFetching}
                onClick={() => onPageChange(page - 1)}
                type="button"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" />
                Предыдущая
              </Button>
              <span className="order-first col-span-2 text-center text-sm font-bold text-muted-foreground sm:order-none sm:w-auto">
                {page} из {totalPages}
              </span>
              <Button
                disabled={page >= totalPages || isFetching}
                onClick={() => onPageChange(page + 1)}
                type="button"
                variant="outline"
              >
                Следующая
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-bold text-ink [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
