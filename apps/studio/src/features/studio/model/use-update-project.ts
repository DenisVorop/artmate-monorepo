"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";
import type { Project } from "@/entities/project";
import type { ProjectValues } from "../lib/schema";
export function useUpdateProject(id: string, version: number) {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: (values: ProjectValues) =>
      api<Project>(
        `/projects/${id}`,
        jsonRequest("PATCH", { ...values, version }),
      ),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
