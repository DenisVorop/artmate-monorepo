"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEventHandler,
  type ReactNode,
} from "react";
import { FormProvider, useForm } from "react-hook-form";

import { useCheckoutCalculation } from "../../model";
import {
  checkoutFormValidationSchema,
  getCheckoutSubmitLabel,
  getDefaultCheckoutFormValues,
  toCreateOrderInput,
  type CheckoutCustomerDefaults,
  type CheckoutFormValues,
} from "../checkout-form";
import type { CheckoutDeliverySelection } from "../checkout-form";

import {
  CheckoutContext,
  checkoutSteps,
  type CheckoutProviderSubmit,
  type CheckoutStep,
  type CheckoutContextValue,
} from "./checkout.context";

type CheckoutProviderProps = {
  children: ReactNode;
  customerDefaults?: CheckoutCustomerDefaults;
  isEmailLocked?: boolean;
  isSubmitting: boolean;
  onSubmit: CheckoutProviderSubmit;
  requiresAuth: boolean;
};

const contactsFields = ["name", "phone", "email", "comment"] as const;

function scrollViewportToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

export function CheckoutProvider({
  children,
  customerDefaults,
  isEmailLocked = false,
  isSubmitting,
  onSubmit,
  requiresAuth,
}: CheckoutProviderProps) {
  const [step, setStep] = useState<CheckoutStep>("delivery");
  const [selectedDelivery, setSelectedDeliveryState] = useState<CheckoutDeliverySelection>();
  const checkoutCalculation = useCheckoutCalculation(selectedDelivery);
  const defaultValues = useMemo(
    () => getDefaultCheckoutFormValues(customerDefaults),
    [customerDefaults],
  );
  const form = useForm<CheckoutFormValues>({
    defaultValues,
    mode: "onSubmit",
    resolver: zodResolver(checkoutFormValidationSchema),
  });
  const {
    formState: { isDirty },
    reset,
  } = form;
  const activeStepIndex = checkoutSteps.indexOf(step);
  const canContinueDelivery =
    Boolean(selectedDelivery) && !checkoutCalculation.isPending && !checkoutCalculation.isError;
  const submitLabel = getCheckoutSubmitLabel({
    hasDelivery: Boolean(selectedDelivery),
    isDeliveryPending: checkoutCalculation.isPending,
    isSubmitting,
    requiresAuth,
  });

  useEffect(() => {
    if (!isDirty) {
      reset(defaultValues);
    }
  }, [defaultValues, isDirty, reset]);

  const setSelectedDelivery = useCallback((delivery: CheckoutDeliverySelection | undefined) => {
    setSelectedDeliveryState(delivery);

    if (!delivery) {
      setStep("delivery");
    }
  }, []);

  const continueFromDelivery = useCallback(() => {
    if (canContinueDelivery) {
      setStep("contacts");
      scrollViewportToTop();
    }
  }, [canContinueDelivery]);

  const continueFromContacts = useCallback(async () => {
    const isValid = await form.trigger(contactsFields, { shouldFocus: true });

    if (isValid) {
      setStep("confirmation");
      scrollViewportToTop();
    }
  }, [form]);

  const goBack = useCallback(() => {
    setStep((currentStep) => {
      const currentIndex = checkoutSteps.indexOf(currentStep);
      const previousStep = checkoutSteps[Math.max(currentIndex - 1, 0)];

      return previousStep ?? currentStep;
    });
  }, []);

  const goToStep = useCallback(
    (nextStep: CheckoutStep) => {
      const nextIndex = checkoutSteps.indexOf(nextStep);

      if (nextIndex <= activeStepIndex) {
        setStep(nextStep);
      }
    },
    [activeStepIndex],
  );

  const submitOrder = useCallback<FormEventHandler<HTMLFormElement>>(
    (event) => {
      void form.handleSubmit(async (values) => {
        if (!selectedDelivery || checkoutCalculation.isPending) {
          setStep("delivery");
          return;
        }

        await onSubmit(toCreateOrderInput(values, selectedDelivery));
      })(event);
    },
    [checkoutCalculation.isPending, form, onSubmit, selectedDelivery],
  );

  const value = useMemo<CheckoutContextValue>(
    () => ({
      activeStepIndex,
      canContinueDelivery,
      checkoutCalculation,
      continueFromContacts,
      continueFromDelivery,
      customerDefaults,
      form,
      goBack,
      goToStep,
      isEmailLocked,
      isSubmitting,
      requiresAuth,
      selectedDelivery,
      setSelectedDelivery,
      step,
      submitLabel,
      submitOrder,
    }),
    [
      activeStepIndex,
      canContinueDelivery,
      checkoutCalculation,
      continueFromContacts,
      continueFromDelivery,
      customerDefaults,
      form,
      goBack,
      goToStep,
      isEmailLocked,
      isSubmitting,
      requiresAuth,
      selectedDelivery,
      setSelectedDelivery,
      step,
      submitLabel,
      submitOrder,
    ],
  );

  return (
    <CheckoutContext.Provider value={value}>
      <FormProvider {...form}>{children}</FormProvider>
    </CheckoutContext.Provider>
  );
}
