"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";
import type { Project } from "@/entities/project";
export function useCreateProject() {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: (name: string) =>
      api<Project>("/projects", jsonRequest("POST", { name })),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
