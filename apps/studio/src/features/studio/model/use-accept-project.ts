"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";

export function useAcceptProject(id: string) {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api(`/projects/${id}/accept`, jsonRequest("POST")),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
