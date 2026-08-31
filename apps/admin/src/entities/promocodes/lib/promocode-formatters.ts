import type { PromoCode } from "../model/types";

export function formatPromoCodeValue(promoCode: PromoCode) {
  if (promoCode.type === "percentage") {
    return `${formatScaledInteger(promoCode.basisPoints ?? 0, 2)}%`;
  }

  return formatKopecks(promoCode.amountKopecks ?? 0);
}

export function formatKopecks(value: number) {
  return `${formatScaledInteger(value, 2)} ₽`;
}

export function getPromoCodeStatus(promoCode: PromoCode, now = new Date()) {
  if (!promoCode.isActive) {
    return { label: "На паузе", variant: "secondary" as const };
  }

  if (promoCode.startsAt && new Date(promoCode.startsAt) > now) {
    return { label: "Запланирован", variant: "outline" as const };
  }

  if (promoCode.endsAt && new Date(promoCode.endsAt) <= now) {
    return { label: "Завершён", variant: "secondary" as const };
  }

  return { label: "Активен", variant: "default" as const };
}

export function formatPromoCodeDate(value: string | null | undefined) {
  if (!value) {
    return "Без ограничения";
  }

  return `${new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Europe/Moscow",
    year: "numeric",
  }).format(new Date(value))} МСК`;
}

function formatScaledInteger(value: number, scaleDigits: number) {
  const factor = 10 ** scaleDigits;
  const integer = Math.trunc(value / factor);
  const fraction = String(Math.abs(value % factor)).padStart(scaleDigits, "0");

  return fraction === "0".repeat(scaleDigits)
    ? integer.toLocaleString("ru-RU")
    : `${integer.toLocaleString("ru-RU")},${fraction.replace(/0+$/, "")}`;
}
