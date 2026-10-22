import { z } from "zod";

export const wholesaleApplicationSchema = z.object({
  company: z.string().trim().min(1, "Укажите компанию").max(80, "Не более 80 символов"),
  email: z
    .string()
    .trim()
    .min(1, "Укажите почту")
    .email("Проверьте адрес почты")
    .max(254, "Адрес слишком длинный"),
  task: z.string().trim().min(1, "Расскажите о вашей задаче").max(2000, "Не более 2000 символов"),
  acceptedPersonalDataConsent: z
    .boolean()
    .refine((value) => value, "Подтвердите согласие на обработку персональных данных"),
});

export type WholesaleApplicationValues = z.infer<typeof wholesaleApplicationSchema>;

export const wholesaleApplicationDefaults: WholesaleApplicationValues = {
  company: "",
  email: "",
  task: "",
  acceptedPersonalDataConsent: false,
};
