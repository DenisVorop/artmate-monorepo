import { z } from "zod";

import type { ConfirmOrderActivationInputDTO } from "@/shared/actions/auth";

export const orderActivationFormSchema = z
  .object({
    password: z.string().min(8, "Пароль должен содержать не менее 8 символов"),
    passwordConfirm: z.string().min(1, "Повторите пароль"),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "Пароли не совпадают",
    path: ["passwordConfirm"],
  });

export type OrderActivationFormValues = z.infer<typeof orderActivationFormSchema>;

export function toOrderActivationInput(
  values: OrderActivationFormValues,
  token: string,
): ConfirmOrderActivationInputDTO {
  return {
    password: values.password,
    token: token.trim(),
  };
}
