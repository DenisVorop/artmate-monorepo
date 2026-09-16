import type { AffiliatePartnerStatus } from "../model";

export function getAffiliatePartnerStatusLabel(status: AffiliatePartnerStatus) {
  return status === "active" ? "Активен" : "Приостановлен";
}

export function formatKopecks(kopecks: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
  }).format(kopecks / 100);
}
