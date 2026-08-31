"use client";

import type { ComponentType } from "react";

import type { Cart } from "@/entities/cart";

import { PromocodeProvider } from "./promocode-provider";

export type WithPromocodeProps = {
  cart: Cart;
  onPromocodeLoginRequested?: () => void;
};

export function withPromocode<P extends { cart: Cart }>(Component: ComponentType<P>) {
  function PromocodeWithProvider({ onPromocodeLoginRequested, ...props }: P & WithPromocodeProps) {
    return (
      <PromocodeProvider cart={props.cart} onLoginRequested={onPromocodeLoginRequested}>
        <Component {...(props as P)} />
      </PromocodeProvider>
    );
  }

  return PromocodeWithProvider;
}
