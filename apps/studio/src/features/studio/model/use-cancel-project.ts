"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";

export function useCancelProject(id: string) {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api(`/projects/${id}/cancel`, jsonRequest("POST")),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
