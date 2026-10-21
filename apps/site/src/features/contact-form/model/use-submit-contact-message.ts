"use client";

import { useMutation } from "@tanstack/react-query";

import {
  submitContactMessage,
  type SubmitContactMessageInputDTO,
} from "@/shared/actions/contact-form";
import { ApiResult } from "@/shared/lib/api-result";

export function useSubmitContactMessageMutation() {
  const { mutateAsync, isPending, error, reset } = useMutation({
    mutationFn: async (input: SubmitContactMessageInputDTO) => {
      const response = ApiResult.fromDTO(await submitContactMessage(input));
      if (response.isError || !response.data?.sent) {
        throw new Error("Не удалось отправить сообщение. Попробуйте ещё раз.");
      }
      return response.data;
    },
  });

  return { submitContactMessage: mutateAsync, isPending, error, reset };
}
