"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
export function useSession() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ authenticated: boolean }>("/session"),
    refetchInterval: 30000,
    retry: 1,
  });
  return { data, isPending, isError, refetch };
}
