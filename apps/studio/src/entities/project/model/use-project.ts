"use client";
import { useQuery } from "@tanstack/react-query";
import { projectQuery } from "./query";
export function useProject(id: string | null, enabled: boolean) {
  const { data, error, isPending } = useQuery({
    ...projectQuery(id),
    enabled: enabled && !!id,
  });
  return { data, error, isPending };
}
