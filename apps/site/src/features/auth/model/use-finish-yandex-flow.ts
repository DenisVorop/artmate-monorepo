"use client";
import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  finishYandexFlow,
  type YandexCallbackInputDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useFinishYandexFlow() {
  const request = useRef<YandexCallbackInputDTO | undefined>(undefined);
  const {
    mutateAsync: perform,
    reset,
    isPending,
  } = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const input = request.current;
      if (!input) throw new Error("Authentication request is unavailable");
      return ApiResult.fromDTO(await finishYandexFlow(input)).unwrap();
    },
  });
  const mutateAsync = async (input: YandexCallbackInputDTO) => {
    if (request.current)
      throw new Error("Authentication request is in progress");
    request.current = input;
    try {
      return await perform();
    } finally {
      request.current = undefined;
      reset();
    }
  };
  return { mutateAsync, isPending };
}
