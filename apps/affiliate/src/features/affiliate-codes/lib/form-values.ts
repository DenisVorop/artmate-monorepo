import { z } from "zod";

import type {
  CreateAffiliateCodeInputDTO,
  UpdateAffiliateCodeInputDTO,
} from "@/shared/actions/affiliate";

const codePattern = /^[A-Z0-9_-]+$/;

export const affiliateCodeFormSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
      (value) =>
        value.length === 0 ||
        (value.length >= 3 && value.length <= 40 && codePattern.test(value)),
      "Используйте 3–40 латинских букв, цифр, _ или -",
    ),
  comment: z.string().trim().max(500, "Не больше 500 символов"),
  partnerPercent: z.number().int("Выберите целое число").min(0).max(15),
});

export type AffiliateCodeFormValues = z.infer<typeof affiliateCodeFormSchema>;

export function getCommissionSplit(partnerPercent: number) {
  return { buyerPercent: 20 - partnerPercent, partnerPercent };
}

export function buildCreateAffiliateCodeInput(
  values: AffiliateCodeFormValues,
): CreateAffiliateCodeInputDTO {
  return {
    ...(values.code ? { code: values.code } : {}),
    comment: values.comment || null,
    partnerPercent: values.partnerPercent,
  };
}

export function buildUpdateAffiliateCodeInput(
  values: AffiliateCodeFormValues,
): UpdateAffiliateCodeInputDTO {
  const comment = values.comment.trim();

  return {
    comment: comment || null,
    partnerPercent: values.partnerPercent,
  };
}
