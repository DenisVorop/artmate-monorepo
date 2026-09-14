import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { Project, Usage } from "./types";
export const projectsQuery = () =>
  queryOptions({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
    refetchInterval: 10000,
  });
export const projectQuery = (id: string | null) =>
  queryOptions({
    queryKey: ["project", id],
    queryFn: () => api<Project>(`/projects/${id}`),
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) =>
        p.jobs.some((j) => j.status === "queued" || j.status === "running"),
      )
        ? 2000
        : 10000,
  });
export const usageQuery = () =>
  queryOptions({
    queryKey: ["usage"],
    queryFn: () => api<Usage>("/usage"),
    refetchInterval: 5000,
  });
