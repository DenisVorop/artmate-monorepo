"use client";

import { useState, type ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";

import { getDefaultCheckoutFormValues, type CheckoutFormValues } from "../checkout-form";
import { CheckoutContext, type CheckoutContextValue } from "../checkout-provider/checkout.context";
import { createPreviewCalculation } from "../preview-data";
import { CheckoutPreviewContext } from "./checkout-preview.context";

export function CheckoutPreviewProvider({ children }: { children: ReactNode }) {
  const [points, setPoints] = useState(0);
  const [hasPromo, setHasPromo] = useState(true);
  const [hasDelivery, setHasDelivery] = useState(true);
  const [notice, setNotice] = useState("");
  const form = useForm<CheckoutFormValues>({
    defaultValues: getDefaultCheckoutFormValues({
      name: "Анна Иванова",
      phone: "+7 (999) 123-45-67",
      email: "anna@example.com",
    }),
  });
  const calculation = createPreviewCalculation(hasDelivery ? points : 0, hasPromo);
  const value: CheckoutContextValue = {
    form,
    isEmailLocked: true,
    isSubmitting: false,
    isDeliveryPickerOpen: false,
    setDeliveryPickerOpen: () => setHasDelivery(true),
    submitLabel: "Оформить заказ",
    checkoutCalculation: hasDelivery ? { status: "ready", calculation } : { status: "idle" },
    selectedDelivery: hasDelivery
      ? { provider: "ozon", pickupPointId: "preview-pickup" }
      : undefined,
    confirmDelivery: async () => ({ status: "error", message: "Это предпросмотр" }),
    invalidateDeliveryConfirmation: () => {},
    loyalty: {
      selectionKey: "checkout-preview",
      pointsToSpend: hasDelivery ? points : 0,
      preview: hasDelivery ? calculation.loyalty : undefined,
      isPending: false,
      setPoints: (value) => {
        if (Number.isSafeInteger(value) && value >= 0 && value <= 1250) setPoints(value);
      },
    },
    submitOrder: (event) => {
      event.preventDefault();
      if (!hasDelivery) setHasDelivery(true);
      else setNotice("Это предпросмотр. Заказ не создаётся.");
    },
  };
  return (
    <CheckoutPreviewContext.Provider
      value={{ hasPromo, setHasPromo, hasDelivery, setHasDelivery, notice }}
    >
      <CheckoutContext.Provider value={value}>
        <FormProvider {...form}>{children}</FormProvider>
      </CheckoutContext.Provider>
    </CheckoutPreviewContext.Provider>
  );
}
