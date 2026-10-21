"use client";
import { useMutation } from "@tanstack/react-query";
import { startAuthFlow } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { FlowError } from "../lib/flow-error";

export function useStartAuthFlow() {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      try {
        return ApiResult.fromDTO(await startAuthFlow()).unwrap();
      } catch (error) {
        throw FlowError.from(error, "other");
      }
    },
  });
  return { mutateAsync, isPending };
}
