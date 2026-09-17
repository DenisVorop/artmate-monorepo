"use client";

import { Banknote, LockKeyhole } from "lucide-react";

import {
  formatKopecks,
  getAffiliatePayoutStatusLabel,
  type AffiliatePayoutList,
  type AffiliatePartnerStatus,
  type AffiliatePayout,
} from "@/entities/affiliate-partners";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import {
  formatPayoutContractDate,
  formatPayoutDateTime,
  getPayoutStatusBadgeVariant,
  usePartnerPayoutsState,
} from "../lib";
import { FinanceEmpty, FinanceError, FinanceLoading, FinancePagination } from "./finance-states";
import { RecordPayoutDialog } from "./record-payout-dialog";
import { RejectPayoutDialog } from "./reject-payout-dialog";

export function PartnerPayouts({
  partnerStatus,
  userId,
}: {
  readonly partnerStatus?: AffiliatePartnerStatus;
  readonly userId: string;
}) {
  const { page, payoutsQuery, setPage, totalPages } =
    usePartnerPayoutsState(userId);
  const data = payoutsQuery.data;

  return (
    <section className="min-w-0 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium">
          <Banknote className="size-4" aria-hidden="true" /> Выплаты
        </h2>
        {payoutsQuery.isFetching && data ? (
          <Badge variant="secondary">Обновляем</Badge>
        ) : null}
      </div>

      {payoutsQuery.isPending && !data ? (
        <FinanceLoading label="Загружаем выплаты…" />
      ) : null}
      {payoutsQuery.isError ? (
        <FinanceError
          label="Не удалось загрузить выплаты."
          onRetry={() => void payoutsQuery.refetch()}
        />
      ) : null}
      {data ? (
        <>
          <PayoutSummary summary={data.summary} />
          {data.items.length ? (
            <div className="grid min-w-0 gap-3">
              {data.items.map((payout) => (
                <PayoutCard
                  canMarkPaid={data.summary.blockedReason !== "partner_inactive"}
                  key={payout.id}
                  partnerStatus={partnerStatus}
                  payout={payout}
                  userId={userId}
                />
              ))}
            </div>
          ) : (
            <FinanceEmpty label="Заявок на выплату пока нет." />
          )}
          <FinancePagination
            currentPage={page}
            label="Пагинация выплат"
            onPageChange={setPage}
            totalPages={totalPages}
          />
        </>
      ) : null}
    </section>
  );
}

function PayoutSummary({
  summary,
}: {
  readonly summary: NonNullable<
    AffiliatePayoutList
  >["summary"];
}) {
  return (
    <Card size="sm" className="min-w-0 bg-muted/25">
      <CardHeader>
        <CardTitle className="text-sm">Текущая сводка</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <SummaryValue label="Доступно" value={summary.availableKopecks} />
          <SummaryValue label="В заявке" value={summary.reservedKopecks} />
          <SummaryValue label="Выплачено" value={summary.paidKopecks} />
          <SummaryValue label="Задолженность" value={summary.debtKopecks} />
        </dl>
        <p className="text-xs text-muted-foreground">
          Текущий минимум: {formatKopecks(summary.minimumPayoutKopecks)} · на {formatPayoutDateTime(summary.asOf)}
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryValue({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium tabular-nums">{formatKopecks(value)}</dd>
    </div>
  );
}

function PayoutCard({
  canMarkPaid,
  partnerStatus,
  payout,
  userId,
}: {
  readonly canMarkPaid: boolean;
  readonly partnerStatus?: AffiliatePartnerStatus;
  readonly payout: AffiliatePayout;
  readonly userId: string;
}) {
  return (
    <article className="min-w-0 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-lg font-semibold tabular-nums">
            {formatKopecks(payout.amountKopecks)}
          </p>
          <p className="text-xs text-muted-foreground">
            Заявка от {formatPayoutDateTime(payout.createdAt)}
          </p>
        </div>
        <Badge variant={getPayoutStatusBadgeVariant(payout.status)}>
          {getAffiliatePayoutStatusLabel(payout.status)}
        </Badge>
      </div>

      {payout.reference || payout.reason ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {payout.reference ? (
            <div className="min-w-0">
              <dt className="text-muted-foreground">Номер операции</dt>
              <dd className="break-all">{payout.reference}</dd>
            </div>
          ) : null}
          {payout.reason ? (
            <div className="min-w-0">
              <dt className="text-muted-foreground">Причина</dt>
              <dd className="whitespace-pre-wrap break-words">{payout.reason}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <details className="mt-3 rounded-md bg-muted/35 p-3 text-sm">
        <summary className="cursor-pointer font-medium">Договор и история</summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Договор</dt>
            <dd className="break-all">№ {payout.contract.number}, версия {payout.contract.version}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Подписан</dt>
            <dd>{formatPayoutContractDate(payout.contract.signedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Минимум на момент заявки</dt>
            <dd>{formatKopecks(payout.minimumPayoutKopecks)}</dd>
          </div>
          {payout.paidAt ? (
            <div>
              <dt className="text-muted-foreground">Выплачено</dt>
              <dd>{formatPayoutDateTime(payout.paidAt)}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-3 min-w-0">
          <p className="text-muted-foreground">Реквизиты для этой выплаты</p>
          <p className="whitespace-pre-wrap break-words">{payout.contract.paymentDetails}</p>
        </div>
        <ol className="mt-3 space-y-2 border-l pl-4">
          {payout.events.map((event) => (
            <li key={event.id}>
              <p className="font-medium">{getAffiliatePayoutStatusLabel(event.status)}</p>
              <p className="text-xs text-muted-foreground">
                {formatPayoutDateTime(event.createdAt)} · <span className="break-all">{event.actorUserId ?? "Автоматически"}</span>
              </p>
              {event.reason ? <p className="mt-1 whitespace-pre-wrap break-words">{event.reason}</p> : null}
            </li>
          ))}
        </ol>
      </details>

      {payout.status === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {partnerStatus === "active" && canMarkPaid ? (
            <RecordPayoutDialog payout={payout} userId={userId} />
          ) : (
            <Button disabled size="sm" variant="outline" title="Партнёр приостановлен">
              <LockKeyhole aria-hidden="true" /> Учесть выплату
            </Button>
          )}
          <RejectPayoutDialog payout={payout} userId={userId} />
        </div>
      ) : null}
    </article>
  );
}
