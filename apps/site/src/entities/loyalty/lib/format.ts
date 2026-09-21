import type { LoyaltyOperation } from "../model/types";

export function formatLoyaltyPoints(points: number) {
  return `${points.toLocaleString("ru-RU")} б`;
}

export function formatLoyaltyMoney(kopecks: number) {
  return (kopecks / 100).toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  });
}

export function formatLoyaltyDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  });
}

export function getOperationPresentation(operation: LoyaltyOperation) {
  if (operation.kind === "reserve") {
    return {
      amount: formatLoyaltyPoints(Math.abs(operation.reservedDelta)),
      detail: "Зарезервировано для заказа · ещё не списано",
      tone: "neutral",
    } as const;
  }
  if (operation.kind === "release") {
    return {
      amount: formatLoyaltyPoints(Math.abs(operation.reservedDelta)),
      detail: "Резерв снят · баллы снова доступны",
      tone: "neutral",
    } as const;
  }
  const delta = operation.balanceDelta;
  return {
    amount: `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatLoyaltyPoints(Math.abs(delta))}`,
    detail: `Баланс после операции: ${formatLoyaltyPoints(operation.balanceAfter)}`,
    tone: delta > 0 ? "positive" : "neutral",
  } as const;
}
