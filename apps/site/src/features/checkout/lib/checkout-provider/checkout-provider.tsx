"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEventHandler,
  type ReactNode,
} from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { Cart } from "@/entities/cart";
import { useUser } from "@/entities/session";
import { getCartPricingSignature, getPromoPricingState, usePromocode } from "@/features/promocode";

import {
  checkoutCalculationQueryKey,
  checkoutCalculationQueryOptions,
  useCheckoutCalculation,
  type CheckoutCalculationIdentity,
} from "../../model";
import {
  checkoutFormValidationSchema,
  createCheckoutOrderAttempt,
  getDefaultCheckoutFormValues,
  type CheckoutAttempt,
  type CheckoutCustomerDefaults,
  type CheckoutFormValues,
} from "../checkout-form";
import type { CheckoutDeliverySelection } from "../checkout-form";
import { getCheckoutSubmitLabel, resolveCheckoutCalculationState } from "../calculation-state";
import {
  createDeliveryConfirmationCoordinator,
  isMatchingCheckoutCalculation,
  type DeliveryConfirmationResult,
} from "../delivery-picker-state";
import {
  clearPersistedPickupSelection,
  readPersistedPickupSelection,
  writePersistedPickupSelection,
} from "../pickup-selection-storage";

import {
  CheckoutContext,
  type CheckoutProviderSubmit,
  type CheckoutContextValue,
} from "./checkout.context";

type CheckoutProviderProps = {
  cart: Cart;
  children: ReactNode;
  customerDefaults?: CheckoutCustomerDefaults;
  isEmailLocked?: boolean;
  isSubmitting: boolean;
  onSubmit: CheckoutProviderSubmit;
};

export function CheckoutProvider({
  cart,
  children,
  customerDefaults,
  isEmailLocked = false,
  isSubmitting,
  onSubmit,
}: CheckoutProviderProps) {
  const user = useUser();
  const queryClient = useQueryClient();
  const promoCode = usePromocode();
  const promoPricing = getPromoPricingState(promoCode);
  const [selectedDelivery, setSelectedDeliveryState] = useState<CheckoutDeliverySelection>();
  const checkoutAttemptRef = useRef<CheckoutAttempt | undefined>(undefined);
  const confirmationCoordinatorRef = useRef<
    ReturnType<typeof createDeliveryConfirmationCoordinator> | undefined
  >(undefined);
  confirmationCoordinatorRef.current ??= createDeliveryConfirmationCoordinator();
  const cartSignature = getCartPricingSignature(cart);
  const accountIdentity = user?.id ?? "guest";
  const calculationIdentity = useMemo<CheckoutCalculationIdentity>(
    () => ({ accountIdentity, cartId: cart.id, cartSignature, promoCode: promoPricing.code }),
    [accountIdentity, cart.id, cartSignature, promoPricing.code],
  );
  const confirmationIdentity = JSON.stringify([
    cart.id,
    cartSignature,
    calculationIdentity.accountIdentity,
    promoPricing.code ?? null,
    promoPricing.isReady,
    cart.isOzonDeliveryAvailable,
  ]);
  const latestConfirmationIdentityRef = useRef(confirmationIdentity);
  latestConfirmationIdentityRef.current = confirmationIdentity;
  const serverCheckoutCalculation = useCheckoutCalculation(selectedDelivery, {
    ...calculationIdentity,
    enabled: promoPricing.isReady,
  });
  const checkoutCalculation = useMemo(
    () =>
      resolveCheckoutCalculationState({
        calculation: promoPricing.isReady ? serverCheckoutCalculation.calculation : undefined,
        cartId: cart.id,
        confirmedDelivery: selectedDelivery,
        error: serverCheckoutCalculation.error,
        isError: promoPricing.isReady && serverCheckoutCalculation.isError,
        isOffline: promoPricing.isReady
          ? serverCheckoutCalculation.isPaused
          : promoCode.isPaused,
        isPending: promoPricing.isReady
          ? serverCheckoutCalculation.isPending
          : promoCode.isHydrating || promoCode.isPending,
        retry: promoPricing.isReady ? serverCheckoutCalculation.retry : promoCode.retry,
      }),
    [
      cart.id,
      promoPricing.isReady,
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
  const submitLabel = getCheckoutSubmitLabel(checkoutCalculation, isSubmitting);

  useEffect(() => {
    if (!isDirty) {
      reset(defaultValues);
    }
  }, [defaultValues, isDirty, reset]);

  useEffect(() => {
    const persistedSelection = readPersistedPickupSelection(cart.id);

    if (persistedSelection?.provider === "ozon" && !cart.isOzonDeliveryAvailable) {
      clearPersistedPickupSelection(cart.id);
      setSelectedDeliveryState(undefined);
      return;
    }

    setSelectedDeliveryState(persistedSelection);
  }, [cart.id, cart.isOzonDeliveryAvailable]);

  useEffect(() => {
    confirmationCoordinatorRef.current?.invalidate("checkout identity changed");
  }, [confirmationIdentity]);

  useEffect(() => () => confirmationCoordinatorRef.current?.invalidate("checkout unmounted"), []);

  const invalidateDeliveryConfirmation = useCallback(() => {
    confirmationCoordinatorRef.current?.invalidate("picker closed");
  }, []);

  const confirmDelivery = useCallback(
    async (delivery: CheckoutDeliverySelection): Promise<DeliveryConfirmationResult> => {
      if (
        !promoPricing.isReady ||
        (delivery.provider === "ozon" && !cart.isOzonDeliveryAvailable) ||
        (typeof navigator !== "undefined" && navigator.onLine === false)
      ) {
        return {
          status: "error",
          message: "Не удалось подтвердить пункт выдачи. Попробуйте еще раз.",
        };
      }

      const requestIdentity = confirmationIdentity;
      const queryOptions = checkoutCalculationQueryOptions(delivery, calculationIdentity);

      return confirmationCoordinatorRef.current!.confirm({
        calculate: () => queryClient.fetchQuery({ ...queryOptions, staleTime: 0 }),
        candidate: delivery,
        cartId: cart.id,
        commit: ({ calculation, candidate }) => {
          queryClient.setQueryData(
            checkoutCalculationQueryKey(candidate, calculationIdentity),
            calculation,
          );
          setSelectedDeliveryState(candidate);
          writePersistedPickupSelection(cart.id, candidate);
        },
        isCurrent: () => latestConfirmationIdentityRef.current === requestIdentity,
      });
    },
    [
      calculationIdentity,
      cart.id,
      cart.isOzonDeliveryAvailable,
      confirmationIdentity,
      promoPricing.isReady,
      queryClient,
    ],
  );

  const submitOrder = useCallback<FormEventHandler<HTMLFormElement>>(
    (event) => {
      void form.handleSubmit(async (values) => {
        if (
          !selectedDelivery ||
          checkoutCalculation.status !== "ready" ||
          !isMatchingCheckoutCalculation(checkoutCalculation.calculation, selectedDelivery, cart.id)
        ) {
          return;
        }

        const checkoutAttempt = createCheckoutOrderAttempt(
          values,
          selectedDelivery,
          promoPricing.code,
          checkoutAttemptRef.current,
        );
        checkoutAttemptRef.current = checkoutAttempt.attempt;
        await onSubmit({
          input: checkoutAttempt.input,
        });
      })(event);
    },
    [
      checkoutCalculation,
      cart.id,
      form,
      onSubmit,
      promoPricing.code,
      selectedDelivery,
    ],
  );

  const value = useMemo<CheckoutContextValue>(
    () => ({
      checkoutCalculation,
      confirmDelivery,
      customerDefaults,
      form,
      isEmailLocked,
      isSubmitting,
      invalidateDeliveryConfirmation,
      selectedDelivery,
      submitLabel,
      submitOrder,
    }),
    [
      checkoutCalculation,
      confirmDelivery,
      customerDefaults,
      form,
      isEmailLocked,
      isSubmitting,
      invalidateDeliveryConfirmation,
      selectedDelivery,
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
