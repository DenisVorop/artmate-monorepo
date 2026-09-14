"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";

export function useGeneratePage(id: string) {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      api(`/pages/${id}/generate`, jsonRequest("POST", { force: true })),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
