import { z } from "zod";
export const decisionFormSchema = z
  .object({
    status: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED", "HIDDEN"]),
    reason: z.string().trim().max(1000, "Не больше 1000 символов"),
  })
  .refine((value) => value.status === "APPROVED" || Boolean(value.reason), {
    path: ["reason"],
    message: "Укажите причину",
  });
export type DecisionFormValues = z.infer<typeof decisionFormSchema>;
