import type { WelcomeOffer } from "@/entities/promocode";
import { routes } from "@/shared/constants";

export function getWelcomeOfferCopy(offer: WelcomeOffer) {
  const discount =
    offer.discountPercent !== null
      ? `Скидка ${offer.discountPercent}%`
      : offer.amount !== null
        ? `Скидка ${formatRubles(offer.amount)}`
        : "Приветственный бонус";
  const conditions: string[] = [];
  const description =
    offer.action === "authorize"
      ? "Создайте аккаунт и привяжите Telegram — бонус появится в личном кабинете."
      : "Привяжите Telegram — бонус появится в личном кабинете.";

  if (offer.minSubtotal > 0) {
    conditions.push(`при сумме товаров от ${formatRubles(offer.minSubtotal)}`);
  }

  if (offer.maxDiscount !== null) {
    conditions.push(`скидка до ${formatRubles(offer.maxDiscount)}`);
  }

  if (offer.endsAt) {
    conditions.push(
      `действует до ${new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Moscow",
      }).format(new Date(offer.endsAt))} МСК (не включительно)`,
    );
  }

  return {
    discount,
    description,
    conditions: conditions.join(" · "),
  };
}

export function getWelcomeOfferAction(action: WelcomeOffer["action"]) {
  return action === "authorize"
    ? {
        href: `${routes.auth}?next=${encodeURIComponent(routes.account)}`,
        label: "Получить бонус",
      }
    : {
        href: routes.account,
        label: "Привязать Telegram",
      };
}

function formatRubles(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
