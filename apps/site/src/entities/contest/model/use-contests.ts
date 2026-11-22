"use client";
import { useQuery } from "@tanstack/react-query";
import { contestsQuery } from "./query";
export function useContests() {
  const { data, isError, isPending } = useQuery(contestsQuery.list());
  return { contests: data ?? [], isError, isPending };
}
export function useContest(slug: string) {
  const { data, isError, isPending } = useQuery(contestsQuery.detail(slug));
  return { contest: data, isError, isPending };
}
