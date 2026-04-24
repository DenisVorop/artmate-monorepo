"use client";

import { useQuery } from "@tanstack/react-query";

import { cartQuery } from "./query";

export function useCartData() {
  const { data, isError, isPending } = useQuery(cartQuery.getCart());

  return { data, isError, isPending };
}
