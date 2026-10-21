"use client";

import { useMutation } from "@tanstack/react-query";

import {
  submitPartnerApplication,
  type SubmitPartnerApplicationInputDTO,
} from "@/shared/actions/partner-applications";
import { ApiResult } from "@/shared/lib/api-result";

export function useSubmitPartnerApplication() {
  const { mutateAsync, isPending, error, reset } = useMutation({
    mutationFn: async (input: SubmitPartnerApplicationInputDTO) => {
      const response = ApiResult.fromDTO(await submitPartnerApplication(input));
      if (response.isError || !response.data?.accepted) {
        throw new Error("Не удалось отправить заявку. Попробуйте ещё раз.");
      }
      return response.data;
    },
  });

  return { error, isPending, reset, submitPartnerApplication: mutateAsync };
}
