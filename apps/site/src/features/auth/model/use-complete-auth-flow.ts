"use client";
import { useMutation } from "@tanstack/react-query";
import {
  completeAuthFlow,
  type CompleteAuthFlowInputDTO,
  type AuthReadinessDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { FlowError } from "../lib/flow-error";

export function useCompleteAuthFlow(
  options: {
    onSuccess?: (_state: AuthReadinessDTO | undefined) => void;
    onError?: (_error: Error) => void;
  } = {},
) {
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (input: CompleteAuthFlowInputDTO) => {
      try {
        return ApiResult.fromDTO(await completeAuthFlow(input)).unwrap();
      } catch (error) {
        throw FlowError.from(error, "other");
      }
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
  return { mutate, mutateAsync, isPending };
}
