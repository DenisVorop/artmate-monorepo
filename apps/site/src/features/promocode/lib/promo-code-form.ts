import { z } from "zod";

import { normalizePromoCode, promoCodePattern } from "./promo-code";

export const promoCodeFormSchema = z.object({
  code: z
    .string()
    .transform(normalizePromoCode)
    .refine(
      (value) => value === "" || promoCodePattern.test(value),
      "Проверьте написание промокода",
    ),
});

export type PromoCodeFormValues = z.input<typeof promoCodeFormSchema>;
