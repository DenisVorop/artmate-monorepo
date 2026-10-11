"use client";

import { useFormContext } from "react-hook-form";

import { cn } from "@/shared/lib";
import { Label, RadioGroup, RadioGroupItem } from "@/shared/ui";
import { PaymentLogo } from "@/shared/ui/payment-logos";

import type { CheckoutFormValues, CheckoutPaymentMethod } from "../lib";

import { FieldError } from "./field-error";

const paymentOptions: {
  bankBrand: "ozonbank" | "tbank";
  brands: ("mir" | "sbp" | "dolyame")[];
  title: string;
  value: CheckoutPaymentMethod;
}[] = [
  {
    bankBrand: "tbank",
    brands: ["mir", "sbp", "dolyame"],
    title: "Т-Банк",
    value: "tbank_acquiring",
  },
  {
    bankBrand: "ozonbank",
    brands: ["mir", "sbp"],
    title: "Ozon Банк",
    value: "ozon_acquiring",
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
      <p id="checkout-payment-heading" className="sr-only">
        Способ оплаты
      </p>
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
        className="gap-2"
      >
        {paymentOptions.map((option) => (
          <Label
            key={option.value}
            htmlFor={`payment-${option.value}`}
            className={cn(
              "flex min-h-16 min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal transition-colors hover:border-rose-200 hover:bg-rose-50/40 dark:hover:bg-rose-950/20",
              selectedPaymentMethod === option.value
                ? "border-rose-300 bg-rose-50/60 ring-1 ring-rose-200/60 dark:border-rose-700 dark:bg-rose-950/20 dark:ring-rose-800/60"
                : "border-border bg-background",
            )}
          >
            <RadioGroupItem
              id={`payment-${option.value}`}
              aria-label={option.title}
              value={option.value}
              className="shrink-0 data-[state=checked]:border-rose-500 data-[state=checked]:text-rose-500"
            />
            <PaymentLogo brand={option.bankBrand} size="compact" />
            <span className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-2 gap-y-1.5">
              {option.brands.map((brand) => (
                <PaymentLogo key={brand} brand={brand} size="compact" />
              ))}
            </span>
          </Label>
        ))}
      </RadioGroup>
      <FieldError id="checkout-payment-error" message={errors.paymentMethod?.message} />
    </div>
  );
}
