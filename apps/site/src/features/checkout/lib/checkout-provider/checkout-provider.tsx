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

import type { Cart } from "@/entities/cart";
import { useUser } from "@/entities/session";
import { getCartPricingSignature, getPromoPricingState, usePromocode } from "@/features/promocode";

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
  cart: Cart;
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
  cart,
  children,
  customerDefaults,
  isEmailLocked = false,
  isSubmitting,
  onSubmit,
  requiresAuth,
}: CheckoutProviderProps) {
  const user = useUser();
  const promoCode = usePromocode();
  const promoPricing = getPromoPricingState(promoCode);
  const [step, setStep] = useState<CheckoutStep>("delivery");
  const [selectedDelivery, setSelectedDeliveryState] = useState<CheckoutDeliverySelection>();
  const serverCheckoutCalculation = useCheckoutCalculation(selectedDelivery, {
    accountIdentity: user?.id ?? "guest",
    cartSignature: getCartPricingSignature(cart),
    enabled: promoPricing.isReady,
    promoCode: promoPricing.code,
  });
  const checkoutCalculation = useMemo(
    () =>
      promoPricing.isReady
        ? serverCheckoutCalculation
        : {
            calculation: undefined,
            error: promoCode.error,
            isError: promoCode.isError,
            isPaused: Boolean(selectedDelivery) && promoCode.isPaused,
            isPending: Boolean(selectedDelivery) && (promoCode.isHydrating || promoCode.isPending),
            retry: promoCode.retry,
          },
    [
      promoPricing.isReady,
      promoCode.error,
      promoCode.isError,
      promoCode.isHydrating,
      promoCode.isPaused,
      promoCode.isPending,
      promoCode.retry,
      selectedDelivery,
      serverCheckoutCalculation,
    ],
  );
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
    Boolean(selectedDelivery) &&
    Boolean(checkoutCalculation.calculation) &&
    !checkoutCalculation.isPending &&
    !checkoutCalculation.isError;
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
    scrollViewportToTop();
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
        if (
          !selectedDelivery ||
          !checkoutCalculation.calculation ||
          checkoutCalculation.isPending ||
          checkoutCalculation.isError
        ) {
          setStep("delivery");
          return;
        }

        await onSubmit(toCreateOrderInput(values, selectedDelivery, promoPricing.code));
      })(event);
    },
    [
      checkoutCalculation.calculation,
      checkoutCalculation.isError,
      checkoutCalculation.isPending,
      form,
      onSubmit,
      promoPricing.code,
      selectedDelivery,
    ],
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
