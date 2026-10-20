import { z } from "zod";

export const emailCodeRequestSchema = z.object({
  email: z.string().trim().min(1, "Укажите почту").email("Проверьте адрес почты"),
});

export const emailCodeConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Введите 6 цифр из письма"),
});

export const contactProfileSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(120, "Сократите имя до 120 символов"),
  phone: z
    .string()
    .trim()
    .max(80, "Проверьте номер телефона")
    .refine(
      (value) =>
        /^\+?[\d\s()-]+$/.test(value) &&
        value.replace(/\D/g, "").length >= 10 &&
        value.replace(/\D/g, "").length <= 15,
      "Укажите номер телефона целиком",
    ),
});

export const consentDecisionSchema = z.object({
  advertising: z.boolean(),
  personalData: z
    .boolean()
    .refine(Boolean, "Для продолжения нужно согласие на обработку персональных данных"),
});

export type EmailCodeRequestValues = z.infer<typeof emailCodeRequestSchema>;
export type EmailCodeConfirmValues = z.infer<typeof emailCodeConfirmSchema>;
export type ContactProfileValues = z.infer<typeof contactProfileSchema>;
export type ConsentDecisionValues = z.infer<typeof consentDecisionSchema>;
