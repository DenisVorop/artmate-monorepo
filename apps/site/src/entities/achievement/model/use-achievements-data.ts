"use client";

import { useQuery } from "@tanstack/react-query";

import { achievementQuery } from "./query";

export function useAchievementsData(userId: string) {
  const { data, isPending, isError } = useQuery(achievementQuery.list(userId));
  return { data, isPending, isError };
}
