"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { workshopModerationQuery } from "./query";
import type { WorkshopModerationStatus } from "./types";

export function useWorkshopModerationQueue(status: WorkshopModerationStatus) {
  const { data, isError, isFetching, isPending, refetch } = useQuery({
    ...workshopModerationQuery.queue(status),
    placeholderData: keepPreviousData,
  });

  return {
    isError,
    isFetching,
    isPending,
    items: data ?? [],
    refetch,
  };
}
