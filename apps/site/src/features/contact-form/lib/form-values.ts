import { z } from "zod";

export const contactFormSchema = z.object({
  email: z.string().trim().min(1, "Укажите email").email("Введите корректный email"),
  message: z.string().trim().min(1, "Напишите сообщение"),
  name: z.string().trim().min(1, "Укажите имя"),
  order: z.string().trim(),
  topic: z.string().trim(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const contactFormDefaultValues = {
  email: "",
  message: "",
  name: "",
  order: "",
  topic: "",
} satisfies ContactFormValues;
