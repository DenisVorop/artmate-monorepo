"use client";

import { useContext } from "react";

import { CheckoutContext } from "./checkout.context";

export function useCheckout() {
  const context = useContext(CheckoutContext);

  if (!context) {
    throw new Error("useCheckout must be used inside CheckoutProvider");
  }

  return context;
}
