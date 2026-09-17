import type {
  AffiliatePayoutBlockedReason,
  AffiliatePayoutStatus,
} from "@/entities/affiliate-payout";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export function formatPayoutDate(value: string) {
  return `${dateFormatter.format(new Date(value)).replace(" в ", ", ")} МСК`;
}

export function getPayoutBlockedMessage(
  reason: AffiliatePayoutBlockedReason | null,
) {
  switch (reason) {
    case "partner_inactive":
      return "Доступ к новым заявкам приостановлен. Если это неожиданно, свяжитесь с поддержкой.";
    case "open_request":
      return "Одна заявка уже на рассмотрении. Новую можно создать после её завершения.";
    case "debt":
      return "Сейчас есть задолженность после возвратов. Новые начисления сначала погасят её.";
    case "no_available_balance":
      return "Доступного остатка для выплаты пока нет.";
    case "below_minimum":
      return "Доступный остаток пока меньше минимальной суммы выплаты.";
    case null:
      return null;
  }
}

export function getPayoutFormDescription(summary: {
  canRequest: boolean;
}, amounts: { available: string; minimum: string }) {
  if (!summary.canRequest) {
    return "Перевод поступит по реквизитам вашего договора.";
  }

  return `Выберите сумму от ${amounts.minimum} до ${amounts.available}. Реквизиты возьмём из действующего договора.`;
}

export function getPayoutStatusPresentation(status: AffiliatePayoutStatus) {
  switch (status) {
    case "pending":
      return { label: "На рассмотрении", tone: "pending" as const };
    case "paid":
      return { label: "Выплачено", tone: "paid" as const };
    case "rejected":
      return { label: "Отклонено", tone: "rejected" as const };
    case "cancelled":
      return { label: "Отменено", tone: "cancelled" as const };
  }
}
