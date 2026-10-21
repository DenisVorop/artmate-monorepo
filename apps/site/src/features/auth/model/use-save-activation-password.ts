"use client";
import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  saveActivationPassword,
  type ActivationPasswordDraftInputDTO,
  type AuthFlowStateDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { FlowError } from "../lib/flow-error";

export function useSaveActivationPassword(
  options: {
    onSuccess?: (_state: AuthFlowStateDTO | undefined) => void;
    onError?: (_error: Error) => void;
  } = {},
) {
  const request = useRef<ActivationPasswordDraftInputDTO | undefined>(
    undefined,
  );
  const {
    mutateAsync: perform,
    reset,
    isPending,
  } = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const input = request.current;
      if (!input) throw new Error("Authentication request is unavailable");
      try {
        return ApiResult.fromDTO(await saveActivationPassword(input)).unwrap();
      } catch (error) {
        throw FlowError.from(error, "other");
      }
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
  return {
    mutateAsync: async (input: ActivationPasswordDraftInputDTO) => {
      if (request.current)
        throw new Error("Authentication request is in progress");
      request.current = input;
      try {
        return await perform();
      } finally {
        request.current = undefined;
        reset();
      }
    },
    isPending,
  };
}
