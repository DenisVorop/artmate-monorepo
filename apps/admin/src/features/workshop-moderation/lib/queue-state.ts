"use client";

import { useState } from "react";

import type { WorkshopModerationStatus } from "@/entities/workshop-moderation";

export const workshopModerationStatusFilters = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "CHANGES_REQUESTED",
  "HIDDEN",
] as const satisfies readonly WorkshopModerationStatus[];

export function useWorkshopModerationQueueState() {
  const [status, setStatus] = useState<WorkshopModerationStatus>("PENDING");

  return { setStatus, status };
}
