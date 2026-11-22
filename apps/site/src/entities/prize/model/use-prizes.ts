"use client";
import { useQuery } from "@tanstack/react-query";
import { prizesQuery } from "./query";
export function usePrizes(owner: string) {
  const { data, isError, isPending, refetch } = useQuery({
    ...prizesQuery.list(owner),
    enabled: Boolean(owner),
  });
  return { data, isError, isPending, refetch };
}
export function usePrize(owner: string, id: string) {
  const { data, isError, isPending, refetch } = useQuery({
    ...prizesQuery.detail(owner, id),
    enabled: Boolean(owner && id),
  });
  return { data, isError, isPending, refetch };
}
