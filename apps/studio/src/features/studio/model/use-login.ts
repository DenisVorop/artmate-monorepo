"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, jsonRequest } from "@/shared/api/client";
export function useLogin() {
  const client = useQueryClient();
  const { mutate, isPending, error } = useMutation({
    mutationFn: (password: string) =>
      api("/session", jsonRequest("POST", { password })),
    onSuccess: () => client.invalidateQueries(),
  });
  return { mutate, isPending, error };
}
