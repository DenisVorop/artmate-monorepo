"use client";
import { useMutation } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";
import type { PageValues } from "../lib/schema";
import { pagePayload } from "../lib/settings-values";
export function useUpdatePage(id: string) {
  const refresh = useRefreshProjects();
  const { mutate, isPending, error } = useMutation({
    mutationFn: (values: PageValues) =>
      api(`/pages/${id}`, jsonRequest("PATCH", pagePayload(values))),
    onSuccess: refresh,
  });
  return { mutate, isPending, error };
}
