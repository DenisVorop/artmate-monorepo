import { z } from "zod";

import type { LoginInputDTO, RegisterInputDTO } from "@/shared/actions/auth";

export const loginFormSchema = z.object({
  login: z.string().trim().min(3, "Логин должен быть длиннее 2 символов"),
  password: z.string().min(1, "Укажите пароль"),
});

export const registerFormSchema = z
  .object({
    login: z.string().trim().min(3, "Логин должен быть длиннее 2 символов"),
    email: z
      .string()
      .trim()
      .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
        message: "Введите корректный email",
      }),
    name: z.string().trim(),
    password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
    passwordConfirm: z.string().min(1, "Повторите пароль"),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Пароли не совпадают",
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export function getOptionalAuthField(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

export function toLoginInput(values: LoginFormValues): LoginInputDTO {
  return {
    login: values.login.trim(),
    password: values.password,
  };
}

export function toRegisterInput(values: RegisterFormValues): RegisterInputDTO {
  return {
    login: values.login.trim(),
    password: values.password,
    email: getOptionalAuthField(values.email),
    name: getOptionalAuthField(values.name),
  };
}
