"use client";

import { useQuery } from "@tanstack/react-query";

import { workshopQuery } from "./query";

export function useOwnerAsset(
  revisionId: string | undefined,
  variant: "normalized" | "web" | "thumb" = "thumb",
) {
  const { data, isError, isPending } = useQuery({
    ...workshopQuery.ownerAsset(revisionId ?? "missing", variant),
    enabled: Boolean(revisionId),
  });

  return { dataUrl: data, isError, isPending };
}
