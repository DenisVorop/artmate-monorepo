import type { AffiliatePartnerStatus, AffiliatePayoutStatus } from "../model";

export function getAffiliatePartnerStatusLabel(status: AffiliatePartnerStatus) {
  return status === "active" ? "Активен" : "Приостановлен";
}

export function formatKopecks(kopecks: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
  }).format(kopecks / 100);
}

export function getAffiliatePayoutStatusLabel(status: AffiliatePayoutStatus) {
  const labels: Record<AffiliatePayoutStatus, string> = {
    pending: "На рассмотрении",
    paid: "Выплачено",
    rejected: "Отклонено",
    cancelled: "Отменено",
  };
  return labels[status];
}
