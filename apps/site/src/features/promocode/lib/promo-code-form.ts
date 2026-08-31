import { z } from "zod";

import { normalizePromoCode, promoCodePattern } from "./promo-code";

export const promoCodeFormSchema = z.object({
  code: z
    .string()
    .transform(normalizePromoCode)
    .refine(
      (value) => promoCodePattern.test(value),
      "Введите от 3 до 40 латинских букв, цифр, _ или -",
    ),
});

export type PromoCodeFormValues = z.input<typeof promoCodeFormSchema>;
