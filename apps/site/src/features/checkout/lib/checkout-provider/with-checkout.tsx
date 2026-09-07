"use client";

import type { ComponentType } from "react";

import type { Cart } from "@/entities/cart";

import type { CheckoutCustomerDefaults } from "../checkout-form";

import { CheckoutProvider } from "./checkout-provider";
import type { CheckoutProviderSubmit } from "./checkout.context";

type WithCheckoutProps = {
  cart: Cart;
  customerDefaults?: CheckoutCustomerDefaults;
  isEmailLocked?: boolean;
  isSubmitting: boolean;
  onSubmit: CheckoutProviderSubmit;
};

export function withCheckout<P extends object>(Component: ComponentType<P>) {
  function CheckoutWithProvider({
    customerDefaults,
    isEmailLocked,
    isSubmitting,
    onSubmit,
    ...props
  }: P & WithCheckoutProps) {
    return (
      <CheckoutProvider
        cart={(props as P & { cart: Cart }).cart}
        customerDefaults={customerDefaults}
        isEmailLocked={isEmailLocked}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
      >
        <Component {...(props as P)} />
      </CheckoutProvider>
    );
  }

  return CheckoutWithProvider;
}
