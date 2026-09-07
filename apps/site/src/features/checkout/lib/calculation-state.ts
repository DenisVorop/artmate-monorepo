import type { CheckoutCalculationDTO } from "@/shared/actions/orders";

import type { CheckoutDeliverySelection } from "./checkout-form";
import { isMatchingCheckoutCalculation } from "./delivery-picker-state";

export type CheckoutCalculationState =
  | { status: "idle" }
  | { status: "pending" }
  | { retry: () => void; status: "offline" }
  | { error: Error; retry: () => void; status: "error" }
  | { calculation: CheckoutCalculationDTO; status: "ready" };

type CheckoutCalculationSignals = {
  calculation?: CheckoutCalculationDTO;
  cartId: string;
  confirmedDelivery?: CheckoutDeliverySelection;
  error: Error | null;
  isError: boolean;
  isOffline: boolean;
  isPending: boolean;
  retry: () => void;
};

export function resolveCheckoutCalculationState({
  calculation,
  cartId,
  confirmedDelivery,
  error,
  isError,
  isOffline,
  isPending,
  retry,
}: CheckoutCalculationSignals): CheckoutCalculationState {
  if (!confirmedDelivery) {
    return { status: "idle" };
  }

  if (isOffline) {
    return { retry, status: "offline" };
  }

  if (isError) {
    return {
      error: error ?? new Error("Не удалось рассчитать заказ"),
      retry,
      status: "error",
    };
  }

  if (isPending) {
    return { status: "pending" };
  }

  if (isMatchingCheckoutCalculation(calculation, confirmedDelivery, cartId)) {
    return { calculation, status: "ready" };
  }

  return {
    error: new Error("Не удалось получить актуальный расчет заказа"),
    retry,
    status: "error",
  };
}

export function getCheckoutSubmitLabel(
  calculationState: CheckoutCalculationState,
  isSubmitting: boolean,
) {
  if (isSubmitting) {
    return "Отправляем заказ";
  }

  switch (calculationState.status) {
    case "idle":
      return "Выберите ПВЗ";
    case "pending":
      return "Считаем доставку";
    case "offline":
      return "Нет сети";
    case "error":
      return "Расчет недоступен";
    case "ready":
      return "Перейти к оплате";
  }
}
