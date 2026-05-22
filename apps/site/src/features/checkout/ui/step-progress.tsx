"use client";

import { Check } from "lucide-react";

import { cn } from "@/shared/lib";

import { checkoutSteps, type CheckoutStep, useCheckout } from "../lib";

const stepTitles: Record<CheckoutStep, string> = {
  confirmation: "Подтверждение",
  contacts: "Контакты",
  delivery: "Доставка",
};

export function CheckoutStepProgress() {
  const { activeStepIndex, checkoutCalculation, goToStep, requiresAuth, selectedDelivery, step } =
    useCheckout();

  return (
    <nav
      aria-label="Шаги оформления заказа"
      className="mb-6 rounded-xl border bg-card px-4 py-4 ring-1 ring-foreground/5"
    >
      <div className="flex items-start">
        {checkoutSteps.map((item, index) => {
          const isCurrent = item === step;
          const isComplete = index < activeStepIndex;
          const isReachable = index <= activeStepIndex;

          return (
            <div key={item} className="contents">
              <button
                type="button"
                disabled={!isReachable}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-24 min-w-0 flex-col items-center text-center outline-none sm:w-36",
                  isReachable && "cursor-pointer",
                  !isReachable && "cursor-default",
                )}
                onClick={() => goToStep(item)}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border bg-background text-sm font-medium transition-colors",
                    isCurrent && "border-rose-500 bg-rose-50 text-rose-700",
                    isComplete && "border-emerald-500 bg-emerald-50 text-emerald-700",
                    !isCurrent && !isComplete && "text-muted-foreground",
                  )}
                >
                  {isComplete ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="mt-2 text-sm leading-tight font-medium">
                  {index + 1}. {stepTitles[item]}
                </span>
                <span className="mt-0.5 max-w-full text-xs leading-tight text-muted-foreground">
                  {getStepDescription({
                    hasDelivery: Boolean(selectedDelivery),
                    isDeliveryPending: checkoutCalculation.isPending,
                    requiresAuth,
                    step: item,
                    status: isComplete ? "complete" : isCurrent ? "current" : "pending",
                  })}
                </span>
              </button>

              {index < checkoutSteps.length - 1 ? (
                <span className="relative mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full bg-rose-500 transition-[width] duration-300",
                      activeStepIndex > index ? "w-full" : "w-0",
                    )}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function getStepDescription({
  hasDelivery,
  isDeliveryPending,
  requiresAuth,
  status,
  step,
}: {
  hasDelivery: boolean;
  isDeliveryPending: boolean;
  requiresAuth: boolean;
  status: "complete" | "current" | "pending";
  step: CheckoutStep;
}) {
  if (step === "delivery") {
    if (status === "complete") {
      return "ПВЗ выбран";
    }

    return hasDelivery && isDeliveryPending ? "Считаем стоимость" : "Выберите ПВЗ";
  }

  if (step === "contacts") {
    return status === "complete" ? "Данные заполнены" : "Проверьте данные";
  }

  return requiresAuth ? "Вход по email" : "Создание заказа";
}
