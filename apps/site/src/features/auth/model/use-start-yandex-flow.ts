"use client";
import { useMutation } from "@tanstack/react-query";
import { startYandexFlow } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useStartYandexFlow() {
  const {
    mutateAsync: perform,
    reset,
    isPending,
  } = useMutation({
    gcTime: 0,
    mutationFn: async () => ApiResult.fromDTO(await startYandexFlow()).unwrap(),
  });
  const mutateAsync = async () => {
    try {
      return await perform();
    } finally {
      reset();
    }
  };
  return { mutateAsync, isPending };
}
