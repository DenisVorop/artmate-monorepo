import { z } from "zod";

export const orderAdminCommentFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Комментарий не должен быть пустым")
    .max(1000, "Комментарий должен быть не длиннее 1000 символов"),
});

export type OrderAdminCommentFormValues = z.infer<
  typeof orderAdminCommentFormSchema
>;
