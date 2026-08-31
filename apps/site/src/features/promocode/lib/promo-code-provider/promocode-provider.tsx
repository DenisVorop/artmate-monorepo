"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Cart } from "@/entities/cart";
import { promoCodeQuery, usePromoPreview } from "@/entities/promocode";
import { useUser } from "@/entities/session";

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
  onLoginRequested?: () => void;
};

export function PromocodeProvider({ cart, children, onLoginRequested }: PromocodeProviderProps) {
  const queryClient = useQueryClient();
  const user = useUser();
  const [selectedCode, setSelectedCode] = useState<string>();
  const [isHydrating, setIsHydrating] = useState(true);
  const cartSignature = getCartPricingSignature(cart);
  const preview = usePromoPreview({
    accountIdentity: user?.id ?? "guest",
    cartSignature,
    code: selectedCode,
    enabled: !isHydrating && cart.items.length > 0,
  });
  const retryPreview = preview.retry;

  useEffect(() => {
    setSelectedCode(readCartPromoCode(cart.id, cart.items.length > 0));

    setIsHydrating(false);
  }, [cart.id, cart.items.length]);

  const applyCode = useCallback(
    (value: string) => {
      const code = parsePromoCode(value);

      if (!code) {
        return;
      }

      writeStoredPromoCode({ cartId: cart.id, code });
      setSelectedCode(code);
      void queryClient.invalidateQueries({ queryKey: promoCodeQuery.baseKey });
    },
    [cart.id, queryClient],
  );

  const clearCode = useCallback(() => {
    clearStoredPromoCode();
    setSelectedCode(undefined);
    queryClient.removeQueries({ queryKey: promoCodeQuery.baseKey });
  }, [queryClient]);
  const retry = useCallback(() => {
    void retryPreview();
  }, [retryPreview]);

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
      onLoginRequested,
      preview: preview.data,
      retry,
      selectedCode,
    }),
    [
      applyCode,
      clearCode,
      isHydrating,
      onLoginRequested,
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
