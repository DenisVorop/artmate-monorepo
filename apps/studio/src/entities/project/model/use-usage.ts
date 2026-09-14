"use client";
import { useQuery } from "@tanstack/react-query";
import { usageQuery } from "./query";
export function useUsage(enabled: boolean) {
  const { data, error, isPending } = useQuery({
    ...usageQuery(),
    enabled: enabled,
  });
  return { data, error, isPending };
}
