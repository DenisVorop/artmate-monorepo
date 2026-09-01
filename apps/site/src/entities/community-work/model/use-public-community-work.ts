"use client";

import { useQuery } from "@tanstack/react-query";

import { communityWorkQuery } from "./query";

export function usePublicCommunityWork(publicId: string) {
  const { data, isError, isPending, refetch } = useQuery(communityWorkQuery.work(publicId));

  return { work: data, isError, isPending, refetch };
}
