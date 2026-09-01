"use client";

import { useQuery } from "@tanstack/react-query";

import { workshopModerationQuery } from "./query";

export function useWorkshopModerationDetail(revisionId: string) {
  const { data, isError, isPending, refetch } = useQuery(
    workshopModerationQuery.detail(revisionId),
  );

  return { detail: data, isError, isPending, refetch };
}
