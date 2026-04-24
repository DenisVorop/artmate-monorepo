"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";

export function CheckoutSuccessCartReset() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(cartQuery.getCart().queryKey, null);
  }, [queryClient]);

  return null;
}
