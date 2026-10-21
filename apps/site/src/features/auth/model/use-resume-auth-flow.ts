"use client";
import { useMutation } from "@tanstack/react-query";
import { resumeAuthFlow, type AuthReadinessDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { FlowError } from "../lib/flow-error";

export function useResumeAuthFlow(
  options: {
    onSuccess?: (_state: AuthReadinessDTO | undefined) => void;
    onError?: (_error: Error) => void;
  } = {},
) {
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      try {
        return ApiResult.fromDTO(await resumeAuthFlow()).unwrap();
      } catch (error) {
        throw FlowError.from(error, "other");
      }
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
  return { mutate, mutateAsync, isPending };
}
