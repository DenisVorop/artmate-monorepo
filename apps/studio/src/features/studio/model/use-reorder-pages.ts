"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";

export function useReorderPages(id: string, version: number) {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: (page_ids: string[]) =>
      api(`/projects/${id}/order`, jsonRequest("PUT", { page_ids, version })),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
