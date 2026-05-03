"use client";

import { useMutation } from "@tanstack/react-query";

import { submitContactMessage } from "@/shared/actions/contact-form";
import { ApiResult } from "@/shared/lib/api-result";

import { buildContactMessagePayload, type ContactFormValues } from "../lib";

export function useSubmitContactMessageMutation() {
  const {
    mutateAsync: submitContactMessageMutation,
    isPending,
    error,
    reset,
  } = useMutation({
    mutationFn: async (values: ContactFormValues) =>
      ApiResult.fromDTO(
        await submitContactMessage(buildContactMessagePayload(values)),
      ).unwrap(),
  });

  return {
    submitContactMessage: submitContactMessageMutation,
    isPending,
    error,
    reset,
  };
}
