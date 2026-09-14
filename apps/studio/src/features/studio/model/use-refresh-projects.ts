"use client";
import { useQueryClient } from "@tanstack/react-query";
export function useRefreshProjects() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["project"] });
    void client.invalidateQueries({ queryKey: ["projects"] });
    void client.invalidateQueries({ queryKey: ["usage"] });
  };
}
