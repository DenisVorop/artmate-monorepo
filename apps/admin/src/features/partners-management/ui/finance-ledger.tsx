import {
  formatKopecks,
  type AffiliatePartnerLedger,
  type AffiliatePartnerLedgerEntry,
} from "@/entities/affiliate-partners";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui";

import {
  financeLedgerPageSize,
  formatMoscowDateTime,
  getLedgerAvailabilityLabel,
  getLedgerHoldReasonLabel,
  getLedgerStatusLabel,
} from "../lib";
import {
  FinanceEmpty,
  FinanceError,
  FinanceLoading,
  FinancePagination,
} from "./finance-states";

export function FinanceLedger({
  isError,
  isPending,
  ledger,
  onPageChange,
  onRetry,
  page,
}: {
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly ledger?: AffiliatePartnerLedger;
  readonly onPageChange: (page: number) => void;
  readonly onRetry: () => void;
  readonly page: number;
}) {
  const totalPages = Math.max(
    1,
    Math.ceil((ledger?.total ?? 0) / financeLedgerPageSize),
  );

  return (
    <section
      className="min-w-0 space-y-2"
      aria-labelledby="partner-ledger-title"
    >
      <h3
        id="partner-ledger-title"
        className="font-heading text-sm font-medium"
      >
        Операции вознаграждения
      </h3>
      {isPending ? (
        <FinanceLoading label="Загружаем операции…" />
      ) : isError || !ledger ? (
        <FinanceError
          label="Не удалось загрузить операции."
          onRetry={onRetry}
        />
      ) : ledger.items.length ? (
        <div className="grid min-w-0 gap-2">
          {ledger.items.map((entry) => (
            <LedgerEntry entry={entry} key={entry.id} />
          ))}
        </div>
      ) : (
        <FinanceEmpty label="За этот период операций нет." />
      )}
      {!isError && !isPending ? (
        <FinancePagination
          currentPage={page}
          label="Пагинация операций вознаграждения"
          onPageChange={onPageChange}
          totalPages={totalPages}
        />
      ) : null}
    </section>
  );
}

function LedgerEntry({
  entry,
}: {
  readonly entry: AffiliatePartnerLedgerEntry;
}) {
  const isReversal = entry.kind === "reversal";
  const isZeroCredit = entry.kind === "credit" && entry.amountKopecks === 0;
  const availabilityLabel = getLedgerAvailabilityLabel(entry);
  const holdReasonLabel = getLedgerHoldReasonLabel(entry);

  return (
    <article className="min-w-0 rounded-lg border bg-card p-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {isReversal ? (
              <Badge variant="destructive">Возврат</Badge>
            ) : (
              <>
                <strong className="text-sm">Начисление</strong>
                <Badge variant="outline">
                  {getLedgerStatusLabel(entry.status)}
                </Badge>
              </>
            )}
          </div>
          <p className="mt-1 min-w-0 break-all font-mono text-xs text-muted-foreground">
            {entry.code}
          </p>
        </div>
        <span
          className={cn(
            "w-full min-w-0 break-words font-semibold tabular-nums sm:w-auto sm:text-right",
            entry.amountKopecks < 0 && "text-destructive",
          )}
        >
          {formatKopecks(entry.amountKopecks)}
        </span>
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <time>{formatMoscowDateTime(entry.createdAt)}</time>
        <span>{entry.partnerPercent}% партнёру</span>
        {availabilityLabel ? <span>{availabilityLabel}</span> : null}
      </div>
      {holdReasonLabel ? (
        <p className="mt-2 text-xs text-muted-foreground">{holdReasonLabel}</p>
      ) : null}
      {isZeroCredit ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {entry.isSelfPurchase
            ? "Собственная покупка, вознаграждение не начислено."
            : "Ставка 0%, вознаграждение не начислено."}
        </p>
      ) : null}
    </article>
  );
}
