"use client";

import { CreditCard, WalletCards } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Badge, Label, RadioGroup, RadioGroupItem } from "@/shared/ui";

import type { CheckoutFormValues, CheckoutPaymentMethod } from "../lib";

import { FieldError } from "./field-error";

const paymentOptions: {
  description: string;
  badges: string[];
  icon: typeof WalletCards;
  title: string;
  value: CheckoutPaymentMethod;
}[] = [
  {
    badges: ["Карта", "СБП"],
    description: "После создания заказа вы перейдёте на защищённую страницу Ozon Pay для оплаты.",
    icon: WalletCards,
    title: "Ozon Pay",
    value: "ozon_acquiring",
  },
  {
    badges: ["Карта", "СБП"],
    description: "После создания заказа вы перейдёте на защищённую страницу T-Bank для оплаты.",
    icon: CreditCard,
    title: "T-Bank",
    value: "tbank_acquiring",
  },
];

export function PaymentMethodField() {
  const {
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<CheckoutFormValues>();
  const selectedPaymentMethod = watch("paymentMethod");
  const hasError = Boolean(errors.paymentMethod);

  return (
    <div className="space-y-3">
      <div>
        <p id="checkout-payment-heading" className="text-sm font-medium">
          Способ оплаты
        </p>
        <p className="text-xs text-muted-foreground">
          Выберите платежную страницу, на которую мы отправим после создания заказа.
        </p>
      </div>
      <RadioGroup
        aria-labelledby="checkout-payment-heading"
        aria-describedby={hasError ? "checkout-payment-error" : undefined}
        aria-invalid={hasError}
        value={selectedPaymentMethod}
        onValueChange={(value) =>
          setValue("paymentMethod", value as CheckoutPaymentMethod, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          })
        }
        className="gap-0 divide-y border-y"
      >
        {paymentOptions.map((option) => {
          const Icon = option.icon;

          return (
            <Label
              key={option.value}
              htmlFor={`payment-${option.value}`}
              className="flex min-h-20 min-w-0 cursor-pointer items-center gap-3 py-3 font-normal hover:bg-muted/30"
            >
              <RadioGroupItem id={`payment-${option.value}`} value={option.value} />
              <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                  <span className="min-w-0 break-words">{option.title}</span>
                  {option.badges.map((badge) => (
                    <Badge key={badge} variant="secondary" className="shrink-0">
                      {badge}
                    </Badge>
                  ))}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>
      <FieldError id="checkout-payment-error" message={errors.paymentMethod?.message} />
    </div>
  );
}
