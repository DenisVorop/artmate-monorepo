"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";

export function useGenerateProject(id: string) {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: (force: boolean) =>
      api<{ queued: number }>(
        `/projects/${id}/generate`,
        jsonRequest("POST", { force }),
      ),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
