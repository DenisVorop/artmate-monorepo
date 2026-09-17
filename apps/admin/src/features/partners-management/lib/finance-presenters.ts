import type { AffiliatePartnerLedgerEntry } from "@/entities/affiliate-partners";

const moscowDateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

const financeDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const ledgerStatusLabels: Record<
  AffiliatePartnerLedgerEntry["status"],
  string
> = {
  pending: "Ожидает подтверждения",
  available: "Доступно",
  held: "Приостановлено",
  reversed: "Возвращено",
  not_earned: "Не начислено",
};

export function formatMoscowDateTime(value: string) {
  return moscowDateTimeFormatter.format(new Date(value));
}

export function formatFinanceDate(value: string) {
  return financeDateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function getLedgerStatusLabel(
  status: AffiliatePartnerLedgerEntry["status"],
) {
  return ledgerStatusLabels[status];
}

export function getLedgerAvailabilityLabel(
  entry: Pick<AffiliatePartnerLedgerEntry, "availableAt" | "kind" | "status">,
) {
  if (entry.kind === "reversal") return null;
  if (entry.status === "pending") {
    return entry.availableAt
      ? `Будет доступно ${formatMoscowDateTime(entry.availableAt)}`
      : "Станет доступно через 14 дней после завершения заказа";
  }
  if (!entry.availableAt) return null;
  if (entry.status === "available") {
    return `Доступно с ${formatMoscowDateTime(entry.availableAt)}`;
  }
  return null;
}

const ledgerHoldReasonLabels: Record<
  NonNullable<AffiliatePartnerLedgerEntry["holdReason"]>,
  string
> = {
  order_cancelled: "Заказ отменён",
  payment_not_confirmed: "Оплата заказа не подтверждена",
  order_not_completed: "Заказ ещё не завершён",
};

export function getLedgerHoldReasonLabel(
  entry: Pick<AffiliatePartnerLedgerEntry, "holdReason" | "kind" | "status">,
) {
  if (
    entry.kind !== "credit" ||
    entry.status !== "held" ||
    !entry.holdReason
  ) {
    return null;
  }

  return ledgerHoldReasonLabels[entry.holdReason];
}

export function getNewestFinanceDays<T>(daily: readonly T[]) {
  return [...daily].reverse();
}
