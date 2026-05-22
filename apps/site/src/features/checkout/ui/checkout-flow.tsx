"use client";

import type { Cart } from "@/entities/cart";
import { DataState } from "@/shared/ui";

import { useCheckout, withCheckout } from "../lib";

import { CheckoutConfirmationStep } from "./confirmation-step";
import { CheckoutContactsStep } from "./contacts-step";
import { CheckoutDeliveryStep } from "./delivery-step";
import { OrderSummary } from "./order-summary";
import { CheckoutStepProgress } from "./step-progress";

type CheckoutFlowProps = {
  cart: Cart;
  createOrderError: Error | null;
};

function BaseCheckoutFlow({ cart, createOrderError }: CheckoutFlowProps) {
  const { step } = useCheckout();

  return (
    <>
      <CheckoutStepProgress />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          <div hidden={step !== "delivery"}>
            <CheckoutDeliveryStep />
          </div>
          <div hidden={step !== "contacts"}>
            <CheckoutContactsStep />
          </div>
          <div hidden={step !== "confirmation"}>
            <CheckoutConfirmationStep />
          </div>

          {createOrderError ? (
            <DataState
              variant="error"
              title="Не удалось создать заказ"
              description={getMutationErrorMessage(createOrderError)}
              className="max-w-none"
            />
          ) : null}
        </div>

        <OrderSummary cart={cart} compact={step !== "confirmation"} />
      </div>
    </>
  );
}

export const CheckoutFlow = withCheckout(BaseCheckoutFlow);

function getMutationErrorMessage(error: Error) {
  return error.message || "Проверьте данные и попробуйте еще раз.";
}
