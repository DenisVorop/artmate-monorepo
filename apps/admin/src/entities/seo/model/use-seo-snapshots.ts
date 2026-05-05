"use client";

import { useQuery } from "@tanstack/react-query";

import { seoQuery } from "./query";

export function useSeoSnapshots(entryId: string) {
  const { data, isError, isPending, refetch } = useQuery(
    seoQuery.snapshots(entryId),
  );

  return {
    isError,
    isPending,
    refetch,
    snapshots: data ?? [],
  };
}
