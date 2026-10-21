"use client";
import { useMutation } from "@tanstack/react-query";
import { saveAuthProfileDraft, type AuthFlowStateDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { FlowError } from "../lib/flow-error";
import { toProfileDraft } from "../lib/to-profile-draft";
import type { ContactProfileValues } from "../lib/flow-form-values";

export function useSaveProfileDraft(
  options: {
    onSuccess?: (_state: AuthFlowStateDTO | undefined) => void;
    onError?: (_error: Error) => void;
  } = {},
) {
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (values: ContactProfileValues) => {
      try {
        return ApiResult.fromDTO(await saveAuthProfileDraft(toProfileDraft(values))).unwrap();
      } catch (error) {
        throw FlowError.from(error, "other");
      }
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
  return { mutate, mutateAsync, isPending };
}
