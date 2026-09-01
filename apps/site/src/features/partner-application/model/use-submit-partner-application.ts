"use client";

import { useMutation } from "@tanstack/react-query";

import { submitPartnerApplication } from "@/shared/actions/partner-applications";
import { ApiResult } from "@/shared/lib/api-result";

import { buildPartnerApplicationPayload, type PartnerApplicationFormValues } from "../lib";

export function useSubmitPartnerApplication() {
  const { mutateAsync, isPending, error, reset } = useMutation({
    mutationFn: async (values: PartnerApplicationFormValues) =>
      ApiResult.fromDTO(
        await submitPartnerApplication(buildPartnerApplicationPayload(values)),
      ).unwrap(),
  });

  return {
    error,
    isPending,
    reset,
    submitPartnerApplication: mutateAsync,
  };
}
