"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { AffiliateCode } from "@/entities/affiliate-partners";

import { useUpdateAffiliateCode } from "../model";
import {
  affiliateCodeFormSchema,
  getAffiliateCodeFormValues,
  getUpdateAffiliateCodeInput,
  type AffiliateCodeFormValues,
} from "./code-form-values";

export function useAffiliateCodeFormState({
  code,
  userId,
}: {
  code: AffiliateCode;
  userId: string;
}) {
  const form = useForm<AffiliateCodeFormValues>({
    defaultValues: getAffiliateCodeFormValues(code),
    resolver: zodResolver(affiliateCodeFormSchema),
  });
  const partnerPercent = form.watch("partnerPercent");
  const buyerPreview =
    Number.isInteger(partnerPercent) &&
    partnerPercent >= 0 &&
    partnerPercent <= 15
      ? `${20 - partnerPercent}%`
      : "—";
  const { error, isPending, mutate } = useUpdateAffiliateCode({
    onSuccess: (updatedCode) => {
      form.reset(getAffiliateCodeFormValues(updatedCode));
    },
  });
  const submit = form.handleSubmit((values) =>
    mutate({
      codeId: code.id,
      input: getUpdateAffiliateCodeInput(values),
      userId,
    }),
  );

  return { buyerPreview, error, form, isPending, submit };
}
