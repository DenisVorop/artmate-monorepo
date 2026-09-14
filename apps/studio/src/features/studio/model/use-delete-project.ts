"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";

export function useDeleteProject() {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: (id: string) => api(`/projects/${id}`, jsonRequest("DELETE")),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
