import { z } from "zod";

import type { LoginInputDTO } from "@/shared/actions/auth";

export const adminLoginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Введите email")
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Введите корректный email",
    }),
  password: z.string().min(1, "Введите пароль"),
});

export type AdminLoginFormValues = z.infer<typeof adminLoginFormSchema>;

export const adminLoginFormDefaultValues = {
  email: "",
  password: "",
} satisfies AdminLoginFormValues;

export function toAdminLoginInput(values: AdminLoginFormValues): LoginInputDTO {
  return {
    email: values.email.trim(),
    password: values.password,
  };
}
