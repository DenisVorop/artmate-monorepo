"use client";

import { createContext, type FormEventHandler } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CheckoutCalculationDTO } from "@/shared/actions/orders";

import type {
  CheckoutCustomerDefaults,
  CheckoutDeliverySelection,
  CheckoutFormValues,
} from "../checkout-form";
import type { CheckoutCreateOrderInput } from "../checkout-types";

export type CheckoutStep = "delivery" | "contacts" | "confirmation";

export type CheckoutCalculationState = {
  calculation?: CheckoutCalculationDTO;
  error: Error | null;
  isError: boolean;
  isPaused: boolean;
  isPending: boolean;
  retry: () => void;
};

export type CheckoutContextValue = {
  activeStepIndex: number;
  canContinueDelivery: boolean;
  checkoutCalculation: CheckoutCalculationState;
  continueFromContacts: () => Promise<void>;
  continueFromDelivery: () => void;
  customerDefaults?: CheckoutCustomerDefaults;
  form: UseFormReturn<CheckoutFormValues>;
  goBack: () => void;
  goToStep: (_step: CheckoutStep) => void;
  isEmailLocked: boolean;
  isSubmitting: boolean;
  requiresAuth: boolean;
  selectedDelivery?: CheckoutDeliverySelection;
  setSelectedDelivery: (_delivery: CheckoutDeliverySelection | undefined) => void;
  step: CheckoutStep;
  submitLabel: string;
  submitOrder: FormEventHandler<HTMLFormElement>;
};

export type CheckoutProviderSubmit = (_input: CheckoutCreateOrderInput) => Promise<void>;

export const checkoutSteps = ["delivery", "contacts", "confirmation"] as const;

export const CheckoutContext = createContext<CheckoutContextValue | null>(null);
