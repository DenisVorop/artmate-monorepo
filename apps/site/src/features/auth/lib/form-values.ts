import { z } from "zod";

import type {
  ConfirmPasswordResetInputDTO,
  ConfirmEmailVerificationInputDTO,
  LoginInputDTO,
  RegisterInputDTO,
  RequestPasswordResetInputDTO,
} from "@/shared/actions/auth";

const personalDataConsentSchema = z
  .boolean()
  .refine((value) => value, "Подтвердите согласие на обработку персональных данных");

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Укажите email")
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Введите корректный email",
    }),
  password: z.string().min(1, "Укажите пароль"),
});

export const registerFormSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Укажите email")
      .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
        message: "Введите корректный email",
      }),
    name: z.string().trim(),
    password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
    passwordConfirm: z.string().min(1, "Повторите пароль"),
    acceptedPersonalDataConsent: personalDataConsentSchema,
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Пароли не совпадают",
  });

export const emailVerificationFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Введите 6 цифр из письма"),
});

export const passwordResetRequestFormSchema = z.object({
  acceptedPersonalDataConsent: personalDataConsentSchema,
  email: z
    .string()
    .trim()
    .min(1, "Укажите email")
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Введите корректный email",
    }),
});

export const confirmPasswordResetFormSchema = z
  .object({
    password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
    passwordConfirm: z.string().min(1, "Повторите пароль"),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Пароли не совпадают",
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export type EmailVerificationFormValues = z.infer<typeof emailVerificationFormSchema>;

export type PasswordResetRequestFormValues = z.infer<typeof passwordResetRequestFormSchema>;

export type ConfirmPasswordResetFormValues = z.infer<typeof confirmPasswordResetFormSchema>;

export function getOptionalAuthField(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

export function toLoginInput(values: LoginFormValues): LoginInputDTO {
  return {
    email: values.email.trim(),
    password: values.password,
  };
}

export function toRegisterInput(values: RegisterFormValues): RegisterInputDTO {
  return {
    acceptedPersonalDataConsent: values.acceptedPersonalDataConsent,
    password: values.password,
    email: values.email.trim(),
    name: getOptionalAuthField(values.name),
  };
}

export function toEmailVerificationInput(
  email: string,
  values: EmailVerificationFormValues,
): ConfirmEmailVerificationInputDTO {
  return {
    email: email.trim(),
    code: values.code.trim(),
  };
}

export function toPasswordResetRequestInput(
  values: PasswordResetRequestFormValues,
): RequestPasswordResetInputDTO {
  return {
    acceptedPersonalDataConsent: values.acceptedPersonalDataConsent,
    email: values.email.trim(),
  };
}

export function toConfirmPasswordResetInput(
  token: string,
  values: ConfirmPasswordResetFormValues,
): ConfirmPasswordResetInputDTO {
  return {
    token,
    password: values.password,
  };
}
