"use client";
import { useQuery } from "@tanstack/react-query";
import { projectsQuery } from "./query";
export function useProjects(enabled: boolean) {
  const { data, error, isPending } = useQuery({
    ...projectsQuery(),
    enabled: enabled,
  });
  return { data, error, isPending };
}
