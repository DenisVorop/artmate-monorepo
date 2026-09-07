import { z } from "zod";

import type { RequestAccountRecoveryInputDTO } from "@/shared/actions/auth";

export const recoveryFormSchema = z.object({
  email: z.string().trim().min(1, "Укажите email").email("Введите корректный email"),
  acceptedPersonalDataConsent: z
    .boolean()
    .refine((value) => value, "Подтвердите согласие на обработку персональных данных"),
});

export type RecoveryFormValues = z.infer<typeof recoveryFormSchema>;

export function toRecoveryInput(values: RecoveryFormValues): RequestAccountRecoveryInputDTO {
  return {
    email: values.email.trim(),
    acceptedPersonalDataConsent: values.acceptedPersonalDataConsent,
  };
}
