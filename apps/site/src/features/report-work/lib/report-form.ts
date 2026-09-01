import { z } from "zod";

export const reportWorkFormSchema = z.object({
  reason: z.enum(["COPYRIGHT", "OFFICIAL_COPY", "INAPPROPRIATE", "SPAM", "PERSONAL_DATA", "OTHER"]),
  details: z
    .string()
    .trim()
    .max(500, "Не более 500 символов")
    .refine((value) => !/(?:https?:\/\/|www\.|<|>)/i.test(value), {
      message: "Ссылки и HTML в комментарии недопустимы",
    }),
});

export type ReportWorkFormValues = z.infer<typeof reportWorkFormSchema>;
