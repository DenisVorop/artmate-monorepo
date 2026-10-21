"use client";
import { useMutation } from "@tanstack/react-query";
import {
  requestFlowRecovery,
  type RecoveryFlowInputDTO,
  type RecoveryFlowResultDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { FlowError } from "../lib/flow-error";

export function useRequestAccountRecovery(
  options: {
    onSuccess?: (_state: RecoveryFlowResultDTO | undefined) => void;
    onError?: (_error: Error) => void;
  } = {},
) {
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (input: RecoveryFlowInputDTO) => {
      try {
        return ApiResult.fromDTO(await requestFlowRecovery(input)).unwrap();
      } catch (error) {
        throw FlowError.from(error, "recovery");
      }
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
  return { mutate, mutateAsync, isPending };
}
