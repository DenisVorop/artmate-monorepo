import { z } from "zod";

import type { ConfirmTelegramLinkInputDTO } from "@/shared/actions/auth";

export const telegramLinkFormSchema = z.object({
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
    code: values.code.trim(),
  };
}
