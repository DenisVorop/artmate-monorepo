"use client";

import type { ComponentType } from "react";

import type { CheckoutCustomerDefaults } from "../checkout-form";

import { CheckoutProvider } from "./checkout-provider";
import type { CheckoutProviderSubmit } from "./checkout.context";

type WithCheckoutProps = {
  customerDefaults?: CheckoutCustomerDefaults;
  isEmailLocked?: boolean;
  isSubmitting: boolean;
  onSubmit: CheckoutProviderSubmit;
  requiresAuth: boolean;
};

export function withCheckout<P extends object>(Component: ComponentType<P>) {
  function CheckoutWithProvider({
    customerDefaults,
    isEmailLocked,
    isSubmitting,
    onSubmit,
    requiresAuth,
    ...props
  }: P & WithCheckoutProps) {
    return (
      <CheckoutProvider
        customerDefaults={customerDefaults}
        isEmailLocked={isEmailLocked}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
        requiresAuth={requiresAuth}
      >
        <Component {...(props as P)} />
      </CheckoutProvider>
    );
  }

  return CheckoutWithProvider;
}
