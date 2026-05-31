import { z } from "zod";

const nameMaxLength = 80;
const emailMaxLength = 254;
const topicMaxLength = 80;
const orderMaxLength = 80;
const messageMaxLength = 2000;

export const contactFormSchema = z.object({
  acceptedPersonalDataConsent: z
    .boolean()
    .refine((value) => value, "Подтвердите согласие на обработку персональных данных"),
  email: z
    .string()
    .trim()
    .min(1, "Укажите email")
    .email("Введите корректный email")
    .max(emailMaxLength, "Email слишком длинный"),
  message: z
    .string()
    .trim()
    .min(1, "Напишите сообщение")
    .max(messageMaxLength, "Сообщение слишком длинное"),
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(nameMaxLength, "Имя слишком длинное"),
  order: z.string().trim().max(orderMaxLength, "Номер заказа слишком длинный"),
  topic: z.string().trim().max(topicMaxLength, "Тема слишком длинная"),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const contactFormDefaultValues = {
  acceptedPersonalDataConsent: false,
  email: "",
  message: "",
  name: "",
  order: "",
  topic: "",
} satisfies ContactFormValues;
