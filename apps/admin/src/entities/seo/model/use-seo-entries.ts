"use client";

import { useQuery } from "@tanstack/react-query";

import { seoQuery } from "./query";

export function useSeoEntries() {
  const { data, isError, isPending, refetch } = useQuery(seoQuery.list());

  return {
    entries: data ?? [],
    isError,
    isPending,
    refetch,
  };
}
