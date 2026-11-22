import type { AvailablePrize } from "@/entities/prize";
import type { WelcomePromo } from "@/entities/promocode";

export type PersonalPromoCode = {
  id: string;
  code: string;
  title: string;
  discountPercent: number | null;
  amount: number | null;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
};

export function getPersonalPromoCodes(
  prizes: readonly AvailablePrize[],
  welcome?: WelcomePromo | null,
  now = Date.now(),
): PersonalPromoCode[] {
  const codes: PersonalPromoCode[] = prizes.flatMap((prize) => {
    if (
      prize.kind !== "promocode" ||
      !["available", "upcoming"].includes(prize.status) ||
      (prize.endsAt && new Date(prize.endsAt).getTime() <= now)
    )
      return [];
    return [
      {
        id: `prize:${prize.id}`,
        code: prize.code,
        title: prize.contestTitle,
        discountPercent: prize.discountPercent,
        amount: prize.amount,
        minSubtotal: prize.minSubtotal,
        maxDiscount: prize.maxDiscount,
        startsAt: prize.startsAt,
        endsAt: prize.endsAt,
      },
    ];
  });
  if (welcome && (!welcome.endsAt || new Date(welcome.endsAt).getTime() > now)) {
    codes.push({ ...welcome, id: "welcome", title: "За знакомство", startsAt: null });
  }
  return [...new Map(codes.map((code) => [code.code, code])).values()];
}

export function personalPromoDiscount(promo: PersonalPromoCode) {
  return promo.discountPercent !== null
    ? `${promo.discountPercent.toLocaleString("ru-RU")}%`
    : personalPromoMoney(promo.amount!);
}
export function personalPromoMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}
export function personalPromoDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}
export function personalPromoAvailability(
  promo: PersonalPromoCode,
  subtotal: number,
  now = Date.now(),
) {
  const missing =
    Math.max(0, Math.round(promo.minSubtotal * 100) - Math.round(subtotal * 100)) / 100;
  const upcoming = Boolean(promo.startsAt && new Date(promo.startsAt).getTime() > now);
  return { missing, upcoming, canApply: missing === 0 && !upcoming };
}
export function personalPromoShortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}
export function personalPromoCount(count: number) {
  const last = count % 10,
    hundred = count % 100;
  return `${count} ${last === 1 && hundred !== 11 ? "промокод" : last >= 2 && last <= 4 && (hundred < 12 || hundred > 14) ? "промокода" : "промокодов"}`;
}
