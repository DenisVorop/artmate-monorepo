"use client";

import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { unsubscribeEmail, type UnsubscribeEmailInputDTO } from "@/shared/actions/consents";
import { ApiResult } from "@/shared/lib/api-result";

export function useUnsubscribe() {
  const request = useRef<UnsubscribeEmailInputDTO | undefined>(undefined);
  const {
    mutateAsync: perform,
    reset,
    isPending,
  } = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const input = request.current;
      if (!input) throw new Error("Unsubscribe request is unavailable");
      const result = ApiResult.fromDTO(await unsubscribeEmail(input));
      if (result.error?.status === 400) return "invalid" as const;
      if (result.isError || result.data?.unsubscribed !== true)
        throw new Error("Unsubscribe result is unavailable");
      return "unsubscribed" as const;
    },
  });
  return {
    isPending,
    unsubscribe: async (input: UnsubscribeEmailInputDTO) => {
      if (request.current) throw new Error("Unsubscribe request is in progress");
      request.current = input;
      try {
        return await perform();
      } finally {
        request.current = undefined;
        reset();
      }
    },
  };
}
