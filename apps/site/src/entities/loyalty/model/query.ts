import { queryOptions } from "@tanstack/react-query";

import {
  getMyLoyalty,
  getMyLoyaltyDashboard,
  getMyLoyaltyOperations,
} from "@/shared/actions/loyalty";
import { ApiResult } from "@/shared/lib/api-result";

import { loyaltyDashboardSchema, loyaltyOperationsSchema, loyaltyOverviewSchema } from "./types";

export const loyaltyQuery = {
  baseKey: ["loyalty"] as const,
  userKey: (userId: string) => ["loyalty", userId] as const,
  overview: (userId: string) =>
    queryOptions({
      queryKey: ["loyalty", userId, "overview"] as const,
      queryFn: async ({ signal }) => {
        const result = await getMyLoyalty(userId);
        signal.throwIfAborted();
        return loyaltyOverviewSchema.parse(ApiResult.fromDTO(result).unwrap());
      },
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: false,
      retryOnMount: false,
    }),
  dashboard: (userId: string) =>
    queryOptions({
      queryKey: ["loyalty", userId, "dashboard"] as const,
      queryFn: async ({ signal }) => {
        const result = await getMyLoyaltyDashboard(userId);
        signal.throwIfAborted();
        return loyaltyDashboardSchema.parse(ApiResult.fromDTO(result).unwrap());
      },
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: false,
      retryOnMount: false,
    }),
  operations: (userId: string, cursor?: string) =>
    queryOptions({
      queryKey: ["loyalty", userId, "operations", cursor ?? null] as const,
      queryFn: async ({ signal }) => {
        const result = await getMyLoyaltyOperations(userId, cursor);
        signal.throwIfAborted();
        return loyaltyOperationsSchema.parse(ApiResult.fromDTO(result).unwrap());
      },
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: false,
      retryOnMount: false,
    }),
};
