"use client";

import { useMutation } from "@tanstack/react-query";

import { submitContactMessage } from "@/shared/actions/contact-form";
import { ApiResult } from "@/shared/lib/api-result";

import { buildWholesaleApplicationPayload } from "../lib/application-payload";
import { wholesaleApplicationAnalytics } from "../lib/analytics";
import type { WholesaleApplicationValues } from "../lib/form-values";

export function useSubmitApplication() {
  const { mutateAsync, isPending, error, reset } = useMutation({
    mutationFn: async (values: WholesaleApplicationValues) => {
      const result = ApiResult.fromDTO(
        await submitContactMessage(buildWholesaleApplicationPayload(values)),
      ).unwrap();

      if (!result?.sent) {
        throw new Error("Wholesale application was not sent");
      }

      return result;
    },
    onSuccess: () => wholesaleApplicationAnalytics.send("sent"),
  });

  return { submitApplication: mutateAsync, isPending, error, reset };
}
