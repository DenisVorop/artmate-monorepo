import type { AffiliateLedgerItem } from "@/entities/affiliate-finance";

const moscowDateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "long",
  timeZone: "Europe/Moscow",
});

export function formatMoscowDateTime(isoDate: string) {
  return moscowDateTimeFormatter.format(new Date(isoDate)).replace(" в ", ", ");
}

function getChartDomain(items: ReadonlyArray<{ netKopecks: number }>) {
  return items.reduce(
    (domain, item) => ({
      max: Math.max(domain.max, item.netKopecks),
      min: Math.min(domain.min, item.netKopecks),
    }),
    { max: 0, min: 0 },
  );
}

const statusLabels: Record<AffiliateLedgerItem["status"], string> = {
  available: "Доступно",
  held: "Приостановлено",
  not_earned: "Без вознаграждения",
  pending: "Ожидает подтверждения",
  reversed: "Отменено",
};

const holdReasonLabels: Record<
  NonNullable<AffiliateLedgerItem["holdReason"]>,
  string
> = {
  order_cancelled: "Заказ отменён",
  order_not_completed: "Заказ ещё не завершён",
  payment_not_confirmed: "Оплата заказа не подтверждена",
};

export function getLedgerStatusHint(item: AffiliateLedgerItem) {
  if (item.kind === "reversal") {
    return null;
  }

  switch (item.status) {
    case "pending": {
      const expectedDate = item.availableAt
        ? ` Ожидаемая дата: ${formatMoscowDateTime(item.availableAt)} МСК.`
        : "";

      return `Заказ ещё не завершён или 14 дней после завершения ещё не прошли.${expectedDate}`;
    }
    case "available":
      return "14 дней после завершения заказа прошли, вознаграждение учтено в доступном балансе.";
    case "held":
      return item.holdReason
        ? `Начисление временно недоступно. ${holdReasonLabels[item.holdReason]}.`
        : "Начисление временно недоступно, потому что состояние заказа изменилось.";
    case "reversed":
      return "Вознаграждение отменено из-за возврата товаров.";
    case "not_earned":
      if (item.isSelfPurchase) {
        return "Это собственная покупка: скидка сохранена, вознаграждение не начисляется.";
      }

      return item.partnerPercent === 0
        ? "Доля партнёра 0%, поэтому вознаграждение не начисляется."
        : "По этому заказу партнёрское вознаграждение не начисляется.";
  }
}

export function getLedgerPresentation(item: AffiliateLedgerItem) {
  if (item.kind === "reversal") {
    return { kindLabel: "Возврат", note: null, statusLabel: null };
  }

  let note: string | null = null;

  if (item.isSelfPurchase) {
    note = "Своя покупка, вознаграждение не начисляется";
  } else if (item.partnerPercent === 0) {
    note = "Доля партнёра 0%, вознаграждение не начисляется";
  } else if (item.status === "held" && item.holdReason) {
    note = holdReasonLabels[item.holdReason];
  } else if (item.status === "pending") {
    note = item.availableAt
      ? `Будет доступно ${formatMoscowDateTime(item.availableAt)} МСК`
      : "Станет доступно через 14 дней после завершения заказа";
  }

  return {
    kindLabel: "Начисление",
    note,
    statusLabel: statusLabels[item.status],
  };
}

export function getDailyTableRows<T extends { date: string }>(
  daily: ReadonlyArray<T>,
) {
  return [...daily].sort((left, right) => right.date.localeCompare(left.date));
}

const chartWidth = 1_000;
const plotLeft = 40;
const plotRight = 960;
const plotTop = 24;
const plotBottom = 216;

export function getEarningsChartGeometry(
  daily: ReadonlyArray<{ date: string; netKopecks: number }>,
) {
  const domain = getChartDomain(daily);
  const range = domain.max - domain.min || 1;
  const step = (plotRight - plotLeft) / Math.max(daily.length, 1);
  const barWidth = Math.max(2, Math.min(16, step * 0.58));
  const toY = (value: number) =>
    plotBottom - ((value - domain.min) / range) * (plotBottom - plotTop);
  const zeroY = toY(0);

  return {
    barWidth,
    chartWidth,
    domain,
    firstDate: daily.at(0)?.date ?? null,
    getBar: (index: number, value: number) => {
      const valueY = toY(value);

      return {
        height: Math.max(1.5, Math.abs(zeroY - valueY)),
        x: plotLeft + index * step + (step - barWidth) / 2,
        y: Math.min(valueY, zeroY),
      };
    },
    lastDate: daily.at(-1)?.date ?? null,
    plotBottom,
    plotLeft,
    plotRight,
    plotTop,
    zeroY,
  };
}
