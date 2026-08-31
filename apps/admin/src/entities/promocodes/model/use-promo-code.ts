"use client";

import { useQuery } from "@tanstack/react-query";

import { promoCodesQuery } from "./query";

export function usePromoCode(promoCodeId: string) {
  const { data, isError, isPending, refetch } = useQuery(
    promoCodesQuery.detail(promoCodeId),
  );

  return { isError, isPending, promoCode: data, refetch };
}
