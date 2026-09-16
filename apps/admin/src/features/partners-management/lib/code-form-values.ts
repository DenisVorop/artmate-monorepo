import { z } from "zod";

import type { AffiliateCode } from "@/entities/affiliate-partners";
import type { UpdateAffiliateCodeInputDTO } from "@/shared/actions/affiliate-partners";

export const affiliateCodeFormSchema = z.object({
  comment: z.string().trim().max(500, "Не больше 500 символов"),
  partnerPercent: z
    .number({ message: "Укажите целое число" })
    .int("Укажите целое число")
    .min(0, "Минимум 0%")
    .max(15, "Максимум 15%"),
  isActive: z.boolean(),
});

export type AffiliateCodeFormValues = z.infer<typeof affiliateCodeFormSchema>;

export function getAffiliateCodeFormValues(
  code: AffiliateCode,
): AffiliateCodeFormValues {
  return {
    comment: code.comment ?? "",
    partnerPercent: code.partnerPercent,
    isActive: code.isActive,
  };
}

export function getUpdateAffiliateCodeInput(
  values: AffiliateCodeFormValues,
): UpdateAffiliateCodeInputDTO {
  return {
    comment: values.comment.trim() || null,
    partnerPercent: values.partnerPercent,
    isActive: values.isActive,
  };
}
