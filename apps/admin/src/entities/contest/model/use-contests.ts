"use client";
import { useQuery } from "@tanstack/react-query";
import { contestsQuery } from "./query";
export function useContests() {
  const { data, isPending, isError, refetch } = useQuery(contestsQuery.list());
  return { contests: data ?? [], isPending, isError, refetch };
}
export function useContest(id?: string) {
  const { data, isPending, isError, refetch } = useQuery({
    ...contestsQuery.detail(id ?? ""),
    enabled: Boolean(id),
  });
  return { contest: data, isPending, isError, refetch };
}
