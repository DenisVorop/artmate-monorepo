"use client";

import { useQuery } from "@tanstack/react-query";

import { loyaltyQuery } from "./query";
import type { LoyaltyOverview } from "./types";

export function loyaltyRefreshInterval(data: LoyaltyOverview | undefined, isError: boolean) {
  return !isError && data?.member?.status === "active" && data.member.historyState === "pending"
    ? 15_000
    : false;
}

export function useLoyaltyData(userId: string, enabled: boolean) {
  const { data, isPending, isError, dataUpdatedAt } = useQuery({
    ...loyaltyQuery.overview(userId),
    enabled,
    refetchInterval: (query) =>
      enabled ? loyaltyRefreshInterval(query.state.data, query.state.status === "error") : false,
    refetchIntervalInBackground: false,
  });
  return { data, isPending, isError, dataUpdatedAt };
}

export function useLoyaltyDashboard(userId: string, enabled: boolean) {
  const { data, isPending, isError } = useQuery({ ...loyaltyQuery.dashboard(userId), enabled });
  return { data, isPending, isError };
}

export function useLoyaltyOperations(userId: string, enabled: boolean, cursor?: string) {
  const { data, isPending, isError } = useQuery({
    ...loyaltyQuery.operations(userId, cursor),
    enabled,
  });
  return { data, isPending, isError };
}
