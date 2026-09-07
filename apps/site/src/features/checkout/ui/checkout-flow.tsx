"use client";

import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import type { Cart } from "@/entities/cart";
import { Button, DataState, Separator } from "@/shared/ui";

import {
  checkoutOrderFormId,
  formatMoney,
  useCheckout,
  withCheckout,
  type CheckoutCalculationState,
} from "../lib";

import { ContactFields } from "./contact-fields";
import { CheckoutSubmitButton } from "./checkout-submit-button";
import { DeliveryMethodField } from "./delivery-method-field";
import { LegalField } from "./legal-field";
import { OrderSummary } from "./order-summary";
import { PaymentMethodField } from "./payment-method-field";

type CheckoutFlowProps = {
  cart: Cart;
  createOrderError: Error | null;
};

function BaseCheckoutFlow({ cart, createOrderError }: CheckoutFlowProps) {
  const { checkoutCalculation, isSubmitting, selectedDelivery, submitLabel, submitOrder } =
    useCheckout();
  const isSubmitDisabled =
    isSubmitting || checkoutCalculation.status !== "ready" || !selectedDelivery;
  const calculationFeedback = getCalculationFeedback(checkoutCalculation);

  return (
    <>
      <div className="grid gap-6 pb-[calc(7rem+var(--site-cookie-consent-height))] lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:pb-0">
        <form id={checkoutOrderFormId} onSubmit={submitOrder}>
          <div className="overflow-hidden rounded-xl border bg-background px-4 sm:px-6">
            <CheckoutSection number="01" title="Получатель">
              <ContactFields />
            </CheckoutSection>

            <Separator />

            <CheckoutSection number="02" title="Доставка">
              <DeliveryMethodField
                isOzonDeliveryAvailable={cart.isOzonDeliveryAvailable}
                minimumDeliveryPrices={cart.minimumDeliveryPrices}
              />
              {calculationFeedback ? (
                <div className="space-y-3">
                  <div role="alert" aria-live="assertive" aria-atomic={true}>
                    <DataState
                      variant="error"
                      title={calculationFeedback.title}
                      description={calculationFeedback.description}
                      className="max-w-none"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={calculationFeedback.retry}
                  >
                    <RefreshCw data-icon="inline-start" />
                    Повторить расчет
                  </Button>
                </div>
              ) : null}
            </CheckoutSection>

            <Separator />

            <CheckoutSection number="03" title="Оплата">
              <PaymentMethodField />
              <LegalField />
            </CheckoutSection>
          </div>

          {createOrderError ? (
            <div role="alert" aria-live="assertive" aria-atomic={true}>
              <DataState
                variant="error"
                title="Не удалось создать заказ"
                description={getMutationErrorMessage(createOrderError)}
                className="max-w-none"
              />
            </div>
          ) : null}
        </form>

        <OrderSummary
          cart={cart}
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={isSubmitting}
          submitLabel={submitLabel}
        />
      </div>

      <div className="fixed inset-x-0 bottom-[var(--site-cookie-consent-height)] z-40 border-t bg-background/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Итого</p>
            <p className="truncate font-semibold">
              {getMobileTotalLabel(checkoutCalculation)}
            </p>
          </div>
          <CheckoutSubmitButton
            form={checkoutOrderFormId}
            disabled={isSubmitDisabled}
            isSubmitting={isSubmitting}
            className="min-h-11"
          >
            {submitLabel}
          </CheckoutSubmitButton>
        </div>
      </div>
    </>
  );
}

function getCalculationFeedback(calculationState: CheckoutCalculationState) {
  if (calculationState.status === "offline") {
    return {
      description: "Подключитесь к интернету и повторите расчет стоимости заказа.",
      retry: calculationState.retry,
      title: "Нет сети",
    };
  }

  if (calculationState.status === "error") {
    return {
      description:
        calculationState.error.message || "Выберите другой пункт выдачи или повторите расчет.",
      retry: calculationState.retry,
      title: "Не удалось рассчитать заказ",
    };
  }

  return undefined;
}

function getMobileTotalLabel(calculationState: CheckoutCalculationState) {
  switch (calculationState.status) {
    case "idle":
      return "После выбора доставки";
    case "pending":
      return "Пересчитываем";
    case "offline":
      return "Нет сети";
    case "error":
      return "Недоступно";
    case "ready":
      return formatMoney(calculationState.calculation.total);
  }
}

export const CheckoutFlow = withCheckout(BaseCheckoutFlow);

function getMutationErrorMessage(error: Error) {
  return error.message || "Проверьте данные и попробуйте еще раз.";
}

function CheckoutSection({
  children,
  number,
  title,
}: {
  children: ReactNode;
  number: string;
  title: string;
}) {
  const headingId = `checkout-section-${number}-heading`;

  return (
    <section aria-labelledby={headingId} className="py-6 sm:py-8">
      <div className="mb-5 flex items-baseline gap-3">
        <span aria-hidden="true" className="font-mono text-sm font-semibold text-rose-500">
          {number}
        </span>
        <h2 id={headingId} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
