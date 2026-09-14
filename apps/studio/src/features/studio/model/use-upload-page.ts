"use client";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { useRefreshProjects } from "./use-refresh-projects";
import type { Page } from "@/entities/project";
export function useUploadPage(id: string) {
  const refresh = useRefreshProjects();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (file: File) =>
      api<Page>(
        `/projects/${id}/pages?name=${encodeURIComponent(file.name.replace(/\.[^.]+$/, ""))}`,
        {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        },
      ),
    onSuccess: refresh,
  });
  return { mutateAsync, isPending, error };
}
