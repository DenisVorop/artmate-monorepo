"use client";

import { useQuery } from "@tanstack/react-query";
import { workshopQuery } from "./query";

export function useWorkshopPreview(userId: string) {
  const { data, isPending, isError } = useQuery({
    ...workshopQuery.preview(userId),
    enabled: Boolean(userId),
  });
  return { data, isPending, isError };
}
