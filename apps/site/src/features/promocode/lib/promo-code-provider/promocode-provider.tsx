"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Cart } from "@/entities/cart";
import { promoCodeQuery, usePromoPreview, type PromoPreview } from "@/entities/promocode";
import { useUser } from "@/entities/session";

import { useAnalytics, type PromoApplyAttempt } from "../analytics";
import { getCartPricingSignature, parsePromoCode } from "../promo-code";
import {
  clearStoredPromoCode,
  readCartPromoCode,
  writeStoredPromoCode,
} from "../promo-code-storage";

import { PromocodeContext, type PromocodeContextValue } from "./promocode.context";

type PromocodeProviderProps = {
  cart: Cart;
  children: ReactNode;
  onLoginRequested?: () => Promise<string | undefined>;
};

type AuthenticatedPromoApply = {
  accountIdentity: string;
  cartId: string;
  cartSignature: string;
  code: string;
};

type CompletedPromoApply = {
  accountIdentity: string;
  attempt: PromoApplyAttempt;
  cartSignature: string;
  preview: PromoPreview;
};

let promoApplyAttemptSequence = 0;

export function PromocodeProvider({ cart, children, onLoginRequested }: PromocodeProviderProps) {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const user = useUser();
  const accountIdentity = user?.id ?? "guest";
  const [selectedCode, setSelectedCode] = useState<string>();
  const [isHydrating, setIsHydrating] = useState(true);
  const [completedApply, setCompletedApply] = useState<CompletedPromoApply>();
  const [authenticatedApply, setAuthenticatedApply] = useState<AuthenticatedPromoApply>();
  const loginAttempt = useRef<symbol | undefined>(undefined);
  const appliedAuthentication = useRef<AuthenticatedPromoApply | undefined>(undefined);
  useEffect(
    () => () => {
      loginAttempt.current = undefined;
    },
    [],
  );
  const cartSignature = getCartPricingSignature(cart);
  const activeApplyAttemptKeyRef = useRef<string | undefined>(undefined);
  const preview = usePromoPreview({
    accountIdentity,
    cartSignature,
    code: selectedCode,
    enabled: !isHydrating && cart.items.length > 0,
  });

  useEffect(() => {
    activeApplyAttemptKeyRef.current = undefined;
    setCompletedApply(undefined);
    setSelectedCode(readCartPromoCode(cart.id, cart.items.length > 0));

    setIsHydrating(false);

    return () => {
      activeApplyAttemptKeyRef.current = undefined;
    };
  }, [accountIdentity, cart.id, cart.items.length, cartSignature]);

  const startApplyAttempt = useCallback(
    (code: string) => {
      const query = promoCodeQuery.preview({ accountIdentity, cartSignature, code });
      const attempt: PromoApplyAttempt = {
        attemptKey: `${cart.id}:${++promoApplyAttemptSequence}`,
        cartId: cart.id,
        code,
      };
      activeApplyAttemptKeyRef.current = attempt.attemptKey;
      setCompletedApply(undefined);
      void (async () => {
        try {
          await queryClient.cancelQueries({ exact: true, queryKey: query.queryKey });

          if (activeApplyAttemptKeyRef.current !== attempt.attemptKey) {
            return;
          }

          const confirmedPreview = await queryClient.fetchQuery({ ...query, staleTime: 0 });

          if (!confirmedPreview || activeApplyAttemptKeyRef.current !== attempt.attemptKey) {
            return;
          }

          setCompletedApply({
            accountIdentity,
            attempt,
            cartSignature,
            preview: confirmedPreview,
          });
        } catch {
          if (activeApplyAttemptKeyRef.current === attempt.attemptKey) {
            analytics.applyFailed();
          }
        } finally {
          if (activeApplyAttemptKeyRef.current === attempt.attemptKey) {
            activeApplyAttemptKeyRef.current = undefined;
          }
        }
      })();
    },
    [accountIdentity, analytics, cart.id, cartSignature, queryClient],
  );

  const applyCode = useCallback(
    (value: string) => {
      const code = parsePromoCode(value);

      if (!code) {
        return;
      }

      writeStoredPromoCode({ cartId: cart.id, code });
      setSelectedCode(code);
      startApplyAttempt(code);
    },
    [cart.id, startApplyAttempt],
  );

  const clearCode = useCallback(() => {
    clearStoredPromoCode();
    activeApplyAttemptKeyRef.current = undefined;
    setCompletedApply(undefined);
    setSelectedCode(undefined);
    queryClient.removeQueries({ queryKey: promoCodeQuery.baseKey });
  }, [queryClient]);
  const retry = useCallback(() => {
    const code = parsePromoCode(selectedCode);

    if (code) {
      startApplyAttempt(code);
    }
  }, [selectedCode, startApplyAttempt]);

  const requestLogin = useCallback(() => {
    const code = parsePromoCode(selectedCode);
    if (!onLoginRequested || !code || loginAttempt.current) return;
    const attempt = Symbol("promo-login");
    loginAttempt.current = attempt;
    const snapshot = { cartId: cart.id, cartSignature, code };
    void (async () => {
      try {
        const signedInIdentity = await onLoginRequested();
        if (loginAttempt.current === attempt && signedInIdentity) {
          setAuthenticatedApply({ ...snapshot, accountIdentity: signedInIdentity });
        }
      } catch {
        // Auth owns its error UI. No retry or promo conversion follows a failed sign-in.
      } finally {
        if (loginAttempt.current === attempt) loginAttempt.current = undefined;
      }
    })();
  }, [cart.id, cartSignature, onLoginRequested, selectedCode]);

  useEffect(() => {
    if (!authenticatedApply || appliedAuthentication.current === authenticatedApply) return;
    // Wait for the published session to reach this provider. Never retry the guest query.
    if (accountIdentity === "guest") return;
    appliedAuthentication.current = authenticatedApply;
    if (
      authenticatedApply.accountIdentity === accountIdentity &&
      authenticatedApply.cartId === cart.id &&
      authenticatedApply.cartSignature === cartSignature &&
      authenticatedApply.code === selectedCode
    ) {
      startApplyAttempt(authenticatedApply.code);
    }
    setAuthenticatedApply(undefined);
  }, [
    accountIdentity,
    authenticatedApply,
    cart.id,
    cartSignature,
    selectedCode,
    startApplyAttempt,
  ]);

  useEffect(() => {
    if (!completedApply) {
      return;
    }

    if (
      completedApply.accountIdentity === accountIdentity &&
      completedApply.attempt.cartId === cart.id &&
      completedApply.cartSignature === cartSignature &&
      completedApply.attempt.code === selectedCode
    ) {
      analytics.promoApplied(completedApply.preview, completedApply.attempt);
    }

    setCompletedApply(undefined);
  }, [accountIdentity, analytics, cart.id, cartSignature, completedApply, selectedCode]);

  const value = useMemo<PromocodeContextValue>(
    () => ({
      applyCode,
      clearCode,
      error: preview.error,
      isError: preview.isError,
      isGuest: !user,
      isHydrating,
      isPaused: preview.isPaused,
      isPending: preview.isPending,
      onLoginRequested: onLoginRequested ? requestLogin : undefined,
      preview: preview.data,
      retry,
      selectedCode,
    }),
    [
      applyCode,
      clearCode,
      isHydrating,
      onLoginRequested,
      requestLogin,
      preview.data,
      preview.error,
      preview.isError,
      preview.isPaused,
      preview.isPending,
      retry,
      selectedCode,
      user,
    ],
  );

  return <PromocodeContext.Provider value={value}>{children}</PromocodeContext.Provider>;
}
