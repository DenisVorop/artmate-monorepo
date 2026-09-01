"use client";

import { useQuery } from "@tanstack/react-query";

import { communityWorkQuery } from "./query";

export function usePublicWorkshop(handle: string) {
  const { data, isError, isPending, refetch } = useQuery(communityWorkQuery.workshop(handle));

  return { workshop: data, isError, isPending, refetch };
}
