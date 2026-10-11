import type { LoyaltyOperation } from "../model/types";

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
      points: Math.abs(operation.reservedDelta),
      prefix: "",
      detail: "Зарезервировано для заказа · ещё не списано",
      tone: "neutral",
    } as const;
  }
  if (operation.kind === "release") {
    return {
      points: Math.abs(operation.reservedDelta),
      prefix: "",
      detail: "Резерв снят · баллы снова доступны",
      tone: "neutral",
    } as const;
  }
  const delta = operation.balanceDelta;
  return {
    points: Math.abs(delta),
    prefix: delta > 0 ? "+" : delta < 0 ? "−" : "",
    detail: "Баланс после операции:",
    balanceAfter: operation.balanceAfter,
    tone: delta > 0 ? "positive" : "neutral",
  } as const;
}
