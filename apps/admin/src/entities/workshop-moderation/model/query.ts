import { queryOptions } from "@tanstack/react-query";

import {
  getWorkshopModerationAsset,
  getWorkshopModerationDetail,
  getWorkshopModerationQueue,
} from "@/shared/actions/workshop-moderation";

import type { WorkshopModerationStatus } from "./types";

const workshopModerationStaleTimeMs = 30_000;

export const workshopModerationQueryKeys = {
  all: ["admin-workshop-moderation"] as const,
  queues: () => [...workshopModerationQueryKeys.all, "queue"] as const,
  queue: (status: WorkshopModerationStatus) =>
    [...workshopModerationQueryKeys.queues(), status] as const,
  details: () => [...workshopModerationQueryKeys.all, "detail"] as const,
  detail: (revisionId: string) =>
    [...workshopModerationQueryKeys.details(), revisionId] as const,
  asset: (
    revisionId: string,
    variant: "normalized" | "web" | "thumb" | "official",
  ) =>
    [
      ...workshopModerationQueryKeys.detail(revisionId),
      "asset",
      variant,
    ] as const,
};

export const workshopModerationQuery = {
  queue: (status: WorkshopModerationStatus) =>
    queryOptions({
      queryKey: workshopModerationQueryKeys.queue(status),
      queryFn: () => getWorkshopModerationQueue(status),
      staleTime: workshopModerationStaleTimeMs,
      retryOnMount: false,
    }),
  detail: (revisionId: string) =>
    queryOptions({
      queryKey: workshopModerationQueryKeys.detail(revisionId),
      queryFn: () => getWorkshopModerationDetail(revisionId),
      staleTime: workshopModerationStaleTimeMs,
      retryOnMount: false,
    }),
  asset: (
    revisionId: string,
    variant: "normalized" | "web" | "thumb" | "official",
  ) =>
    queryOptions({
      queryKey: workshopModerationQueryKeys.asset(revisionId, variant),
      queryFn: () => getWorkshopModerationAsset(revisionId, variant),
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
