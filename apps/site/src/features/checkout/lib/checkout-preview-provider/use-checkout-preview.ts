"use client";

import { useContext } from "react";
import { CheckoutPreviewContext } from "./checkout-preview.context";

export function useCheckoutPreview() {
  const value = useContext(CheckoutPreviewContext);
  if (!value) throw new Error("CheckoutPreviewProvider is missing");
  return value;
}
