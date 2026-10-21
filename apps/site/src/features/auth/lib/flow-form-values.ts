import { z } from "zod";

export const emailCodeRequestSchema = z.object({
  email: z.string().trim().min(1, "Укажите почту").email("Проверьте адрес почты"),
});

export const emailCodeConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Введите 6 цифр из письма"),
});

export const passwordLoginSchema = emailCodeRequestSchema.extend({
  password: z.string().min(1, "Укажите пароль"),
});

export const contactProfileSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(120, "Не более 120 символов"),
  phone: z
    .string()
    .trim()
    .max(80, "Проверьте номер телефона")
    .refine(
      (value) =>
        /^\+?[\d\s()-]+$/.test(value) &&
        value.replace(/\D/g, "").length >= 10 &&
        value.replace(/\D/g, "").length <= 15,
      "Введите номер целиком",
    )
    .refine(
      (value) => !value.includes("(") || /^\+7 \(\d{3}\) \d{3} \d{2} \d{2}$/.test(value),
      "Введите номер целиком",
    ),
});

const passwordFields = z.object({
  password: z.string().min(8, "Не менее 8 символов"),
  passwordConfirm: z.string().min(1, "Повторите пароль"),
});

const passwordMatch = {
  path: ["passwordConfirm"],
  message: "Пароли не совпадают",
};

export const passwordCreationSchema = passwordFields.refine(
  (values) => values.password === values.passwordConfirm,
  passwordMatch,
);

export const registrationSchema = passwordFields
  .extend(contactProfileSchema.shape)
  .refine((values) => values.password === values.passwordConfirm, passwordMatch);

export const consentDecisionSchema = z.object({
  advertising: z.boolean(),
  personalData: z.boolean().refine(Boolean, "Для продолжения нужно согласие."),
});

export type EmailCodeRequestValues = z.infer<typeof emailCodeRequestSchema>;
export type PasswordLoginValues = z.infer<typeof passwordLoginSchema>;
export type PasswordCreationValues = z.infer<typeof passwordCreationSchema>;
export type RegistrationValues = z.infer<typeof registrationSchema>;
export type EmailCodeConfirmValues = z.infer<typeof emailCodeConfirmSchema>;
export type ContactProfileValues = z.infer<typeof contactProfileSchema>;
export type ConsentDecisionValues = z.infer<typeof consentDecisionSchema>;
