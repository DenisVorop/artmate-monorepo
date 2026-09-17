import type { AffiliatePayoutStatus } from "@/entities/affiliate-partners";

const errorMessages: Record<string, string> = {
  affiliate_payout_open_request:
    "У партнёра уже есть открытая заявка. Обновите историю выплат.",
  affiliate_payout_below_minimum:
    "Сумма заявки ниже действующего минимума. Обновите данные.",
  affiliate_payout_invalid_status: "Статус заявки уже изменился. Обновите данные.",
  affiliate_payout_request_conflict:
    "Результат операции не совпал с отправленными данными. Обновите историю выплат и проверьте заявку.",
  affiliate_payout_duplicate_reference:
    "Такой номер операции уже указан у выплаты этого партнёра.",
  affiliate_payout_unavailable_balance:
    "Доступный баланс изменился. Обновите данные перед подтверждением.",
};

export function getPayoutMutationErrorMessage(
  code: string | undefined,
  status: number | undefined,
  fallback: string,
) {
  if (code && errorMessages[code]) return errorMessages[code];
  if (status === 401) return "Сессия завершена. Войдите снова и повторите действие.";
  if (status === 403) return "Недостаточно прав для этого действия.";
  if (!status || status >= 500) {
    return "Не удалось подтвердить результат операции. Проверьте историю и повторите запрос с теми же данными.";
  }
  return fallback || "Не удалось сохранить выплату.";
}

export function getPayoutStatusBadgeVariant(status: AffiliatePayoutStatus) {
  if (status === "paid") return "default" as const;
  if (status === "rejected") return "destructive" as const;
  return "outline" as const;
}

export function formatPayoutDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatPayoutContractDate(value: string) {
  const calendarDate = value.slice(0, 10);
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${calendarDate}T00:00:00.000Z`));
}
