import { z } from "zod";

import type { ConfirmTelegramLinkInputDTO } from "@/shared/actions/auth";

export const telegramLinkFormSchema = z.object({
  acceptedPersonalDataConsent: z
    .boolean()
    .refine((value) => value, "Подтвердите согласие на обработку персональных данных"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Введите 6 цифр из Telegram"),
});

export type TelegramLinkFormValues = z.infer<typeof telegramLinkFormSchema>;

export function toConfirmTelegramLinkInput(
  values: TelegramLinkFormValues,
): ConfirmTelegramLinkInputDTO {
  return {
    acceptedPersonalDataConsent: values.acceptedPersonalDataConsent,
    code: values.code.trim(),
  };
}
