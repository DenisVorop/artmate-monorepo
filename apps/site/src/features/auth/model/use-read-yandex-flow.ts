"use client";
import { useMutation } from "@tanstack/react-query";
import { readYandexFlow } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useReadYandexFlow() {
  const {
    mutateAsync: perform,
    reset,
    isPending,
  } = useMutation({
    gcTime: 0,
    mutationFn: async (attemptId: string) =>
      ApiResult.fromDTO(await readYandexFlow(attemptId)).unwrap(),
  });
  const mutateAsync = async (attemptId: string) => {
    try {
      return await perform(attemptId);
    } finally {
      reset();
    }
  };
  return { mutateAsync, isPending };
}
