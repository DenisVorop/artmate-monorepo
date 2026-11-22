"use client";
import { useQuery } from "@tanstack/react-query";
import { contestDrawQuery } from "./query";
export function useContestDraw(id: string) {
  const { data, isPending, isError, refetch } = useQuery(
    contestDrawQuery.detail(id),
  );
  return { data, isPending, isError, refetch };
}
