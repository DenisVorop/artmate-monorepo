"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { AffiliateCode } from "@/entities/affiliate-code";

import { useCreateAffiliateCode } from "../model/use-create-affiliate-code";
import { useUpdateAffiliateCode } from "../model/use-update-affiliate-code";
import { getAffiliateCodeErrorMessage } from "./error-message";
import {
  affiliateCodeFormSchema,
  buildCreateAffiliateCodeInput,
  buildUpdateAffiliateCodeInput,
  type AffiliateCodeFormValues,
} from "./form-values";
import { generateAffiliateCode } from "./generate-code";

type AffiliateCodeFormConfig =
  | {
      readonly code?: never;
      readonly mode: "create";
      readonly onComplete: () => void;
    }
  | {
      readonly code: AffiliateCode;
      readonly mode: "edit";
      readonly onComplete: () => void;
    };

export function useAffiliateCodeForm(config: AffiliateCodeFormConfig) {
  const { isPending: isCreating, mutate: createCode } =
    useCreateAffiliateCode();
  const { isPending: isUpdating, mutate: updateCode } =
    useUpdateAffiliateCode();
  const form = useForm<AffiliateCodeFormValues>({
    defaultValues:
      config.mode === "edit"
        ? {
            code: config.code.code,
            comment: config.code.comment ?? "",
            partnerPercent: config.code.partnerPercent,
          }
        : { code: "", comment: "", partnerPercent: 10 },
    resolver: zodResolver(affiliateCodeFormSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    form.clearErrors("root");

    try {
      const result =
        config.mode === "create"
          ? await createCode(buildCreateAffiliateCodeInput(values))
          : await updateCode({
              codeId: config.code.id,
              input: buildUpdateAffiliateCodeInput(values),
            });

      if (!result.ok) {
        form.setError("root", {
          message: getAffiliateCodeErrorMessage(result.error.status),
        });
        return;
      }

      if (config.mode === "create") {
        form.reset({ code: "", comment: "", partnerPercent: 10 });
      }
      config.onComplete();
    } catch {
      form.setError("root", { message: getAffiliateCodeErrorMessage(503) });
    }
  });

  const generateCode = () => {
    form.clearErrors("code");
    form.clearErrors("root");
    form.setValue("code", generateAffiliateCode(), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return {
    form,
    generateCode,
    isPending: isCreating || isUpdating,
    onSubmit,
  };
}
