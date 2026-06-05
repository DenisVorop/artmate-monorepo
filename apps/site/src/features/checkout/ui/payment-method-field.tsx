"use client";

import { CheckCircle2, CreditCard, WalletCards } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { cn } from "@/shared/lib";

import type { CheckoutFormValues, CheckoutPaymentMethod } from "../lib";

const paymentOptions: {
  description: string;
  icon: typeof WalletCards;
  title: string;
  value: CheckoutPaymentMethod;
}[] = [
  {
    description: "Оплата на защищенной странице Ozon Pay.",
    icon: WalletCards,
    title: "Ozon Pay",
    value: "ozon_acquiring",
  },
  {
    description: "Оплата картой на платежной форме T-Bank.",
    icon: CreditCard,
    title: "T-Bank",
    value: "tbank_acquiring",
  },
];

export function PaymentMethodField() {
  const { setValue, watch } = useFormContext<CheckoutFormValues>();
  const selectedPaymentMethod = watch("paymentMethod");

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Способ оплаты</p>
        <p className="text-xs text-muted-foreground">
          Выберите платежную страницу, на которую мы отправим после создания заказа.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {paymentOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedPaymentMethod === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() =>
                setValue("paymentMethod", option.value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
              className={cn(
                "flex min-h-24 items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                "hover:border-foreground/30 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isSelected
                  ? "border-rose-300 bg-rose-50/70"
                  : "border-border bg-background",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border",
                  isSelected
                    ? "border-rose-200 bg-white text-rose-600"
                    : "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {option.title}
                  {isSelected ? <CheckCircle2 className="size-4 text-rose-600" /> : null}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
