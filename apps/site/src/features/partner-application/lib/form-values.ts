import { z } from "zod";

import {
  partnerAudienceSizes,
  partnerPreferredContacts,
  partnerTypes,
} from "@/shared/actions/partner-applications";

import { normalizeTelegramContact } from "./telegram-contact";

const nameMaxLength = 120;
const emailMaxLength = 254;
const contactHandleMaxLength = 120;
const channelUrlMaxLength = 500;
const commentMaxLength = 1200;

export const partnerApplicationFormSchema = z
  .object({
    acceptedPersonalDataConsent: z
      .boolean()
      .refine((value) => value, "Подтвердите согласие на обработку персональных данных"),
    audienceSize: z.enum(partnerAudienceSizes, {
      required_error: "Укажите размер аудитории",
    }),
    channelUrl: z
      .string()
      .trim()
      .min(1, "Добавьте ссылку на основную площадку")
      .max(channelUrlMaxLength, "Ссылка слишком длинная")
      .refine(isHttpUrl, "Введите полную ссылку, например https://t.me/your_channel"),
    comment: z.string().trim().max(commentMaxLength, "Комментарий слишком длинный"),
    contactHandle: z.string().trim().max(contactHandleMaxLength, "Контакт слишком длинный"),
    email: z
      .string()
      .trim()
      .min(1, "Укажите email")
      .email("Введите корректный email")
      .max(emailMaxLength, "Email слишком длинный"),
    name: z
      .string()
      .trim()
      .min(2, "Имя должно содержать минимум 2 символа")
      .max(nameMaxLength, "Имя слишком длинное"),
    partnerType: z.enum(partnerTypes, {
      required_error: "Выберите формат партнёрства",
    }),
    preferredContact: z.enum(partnerPreferredContacts, {
      required_error: "Выберите удобный способ связи",
    }),
    website: z.string().max(0).optional(),
  })
  .superRefine((values, context) => {
    if (values.preferredContact === "telegram" && !normalizeTelegramContact(values.contactHandle)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите @username или ссылку t.me/username",
        path: ["contactHandle"],
      });
    }
  });

export type PartnerApplicationFormValues = z.infer<typeof partnerApplicationFormSchema>;

export const partnerApplicationFormDefaultValues = {
  acceptedPersonalDataConsent: false,
  audienceSize: "up_to_1000",
  channelUrl: "",
  comment: "",
  contactHandle: "",
  email: "",
  name: "",
  partnerType: "creator",
  preferredContact: "telegram",
  website: "",
} satisfies PartnerApplicationFormValues;

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
