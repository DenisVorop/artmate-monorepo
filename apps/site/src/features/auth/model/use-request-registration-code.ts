"use client";
import { useMutation } from "@tanstack/react-query";
import {
  requestRegistrationCode,
  type AuthFlowStateDTO,
  type RequestRegistrationCodeInputDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { FlowError } from "../lib/flow-error";

export function useRequestRegistrationCode(
  options: {
    onSuccess?: (_state: AuthFlowStateDTO | undefined) => void;
    onError?: (_error: Error) => void;
  } = {},
) {
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (input: RequestRegistrationCodeInputDTO) => {
      try {
        return ApiResult.fromDTO(await requestRegistrationCode(input)).unwrap();
      } catch (error) {
        throw FlowError.from(error, "other");
      }
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
  return { mutate, mutateAsync, isPending };
}
