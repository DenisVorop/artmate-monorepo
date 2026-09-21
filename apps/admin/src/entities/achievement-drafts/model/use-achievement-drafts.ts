"use client";

import { useQuery } from "@tanstack/react-query";

import { achievementDraftsQuery } from "./query";

export function useAchievementDrafts() {
  const { data, isError, isPending, refetch } = useQuery(
    achievementDraftsQuery.list(),
  );

  return {
    achievements: data ?? [],
    isError,
    isPending,
    refetch,
  };
}
