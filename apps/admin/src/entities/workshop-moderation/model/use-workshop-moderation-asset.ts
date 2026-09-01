"use client";

import { useQuery } from "@tanstack/react-query";

import { workshopModerationQuery } from "./query";

export function useWorkshopModerationAsset(
  revisionId: string,
  variant: "normalized" | "web" | "thumb" | "official",
) {
  const { data, isError, isPending, refetch } = useQuery(
    workshopModerationQuery.asset(revisionId, variant),
  );

  return { dataUrl: data, isError, isPending, refetch };
}
