"use client";

import { createContext, type FormEventHandler } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  CheckoutCustomerDefaults,
  CheckoutDeliverySelection,
  CheckoutFormValues,
} from "../checkout-form";
import type { CheckoutCalculationState } from "../calculation-state";
import type { DeliveryConfirmationResult } from "../delivery-picker-state";
import type { CheckoutCreateOrderInput } from "../checkout-types";

export type CheckoutContextValue = {
  checkoutCalculation: CheckoutCalculationState;
  customerDefaults?: CheckoutCustomerDefaults;
  form: UseFormReturn<CheckoutFormValues>;
  isEmailLocked: boolean;
  isSubmitting: boolean;
  selectedDelivery?: CheckoutDeliverySelection;
  confirmDelivery: (_delivery: CheckoutDeliverySelection) => Promise<DeliveryConfirmationResult>;
  invalidateDeliveryConfirmation: () => void;
  submitLabel: string;
  submitOrder: FormEventHandler<HTMLFormElement>;
};

export type CheckoutProviderSubmitVariables = {
  input: CheckoutCreateOrderInput;
};

export type CheckoutProviderSubmit = (_variables: CheckoutProviderSubmitVariables) => Promise<void>;

export const CheckoutContext = createContext<CheckoutContextValue | null>(null);
