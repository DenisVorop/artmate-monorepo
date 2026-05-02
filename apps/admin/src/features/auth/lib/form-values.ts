import { z } from "zod";

import type { LoginInputDTO } from "@/shared/actions/auth";

export const adminLoginFormSchema = z.object({
  login: z.string().trim().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
});

export type AdminLoginFormValues = z.infer<typeof adminLoginFormSchema>;

export const adminLoginFormDefaultValues = {
  login: "",
  password: "",
} satisfies AdminLoginFormValues;

export function toAdminLoginInput(values: AdminLoginFormValues): LoginInputDTO {
  return {
    login: values.login.trim(),
    password: values.password,
  };
}
