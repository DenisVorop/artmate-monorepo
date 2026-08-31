import { z } from "zod";

import type { ReleasePromoCodeRedemptionInputDTO } from "@/shared/actions/promocodes";

export const releasePromoCodeFormSchema = z.object({
  confirmed: z.boolean().refine((value) => value, {
    message: "Подтвердите проверку окончательного статуса оплаты",
  }),
  reason: z
    .string()
    .trim()
    .min(10, "Укажите причину минимум из 10 символов")
    .max(500, "Максимум 500 символов"),
});

export type ReleasePromoCodeFormValues = z.infer<
  typeof releasePromoCodeFormSchema
>;

export const releasePromoCodeDefaultValues = {
  confirmed: false,
  reason: "",
} satisfies ReleasePromoCodeFormValues;

export function getReleasePromoCodeInput(
  values: ReleasePromoCodeFormValues,
): ReleasePromoCodeRedemptionInputDTO {
  return {
    confirmation: "payment_closed_without_charge",
    reason: values.reason.trim(),
  };
}
