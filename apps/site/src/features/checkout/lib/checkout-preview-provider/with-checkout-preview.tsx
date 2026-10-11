"use client";

import type { ComponentType } from "react";
import { CheckoutPreviewProvider } from "./checkout-preview-provider";

export function withCheckoutPreview(Component: ComponentType) {
  return function CheckoutWithPreview() {
    return (
      <CheckoutPreviewProvider>
        <Component />
      </CheckoutPreviewProvider>
    );
  };
}
