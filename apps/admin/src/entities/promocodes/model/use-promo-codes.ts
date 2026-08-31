"use client";

import { useQuery } from "@tanstack/react-query";

import { promoCodesQuery } from "./query";

export function usePromoCodes() {
  const { data, isError, isPending } = useQuery(promoCodesQuery.list());

  return { isError, isPending, promoCodes: data ?? [] };
}
