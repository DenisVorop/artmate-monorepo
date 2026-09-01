"use client";

import { useQuery } from "@tanstack/react-query";

import { communityWorkQuery } from "./query";

export function useCommunityWorks(slug: string, number: number) {
  const { data, isError, isPending, refetch } = useQuery(
    communityWorkQuery.forColoring(slug, number),
  );

  return { works: data ?? [], isError, isPending, refetch };
}
