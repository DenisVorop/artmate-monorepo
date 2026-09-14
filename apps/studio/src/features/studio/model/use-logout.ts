"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
export function useLogout() {
  const client = useQueryClient();
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api("/session", { method: "DELETE" }),
    onSuccess: () => {
      client.clear();
      client.setQueryData(["session"], { authenticated: false });
    },
  });
  return { mutate, isPending, error };
}
