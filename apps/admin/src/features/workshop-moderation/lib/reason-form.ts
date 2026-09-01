import { z } from "zod";

import type { WorkshopModerationDecisionInput } from "@/entities/workshop-moderation";

export const workshopModerationReasonMaxLength = 1000;
const plainTextPattern = /^(?!.*(?:https?:\/\/|www\.|<|>))[\s\S]*$/i;

export const workshopModerationReasonFormSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Укажите причину решения")
      .max(
        workshopModerationReasonMaxLength,
        `Причина должна быть не длиннее ${workshopModerationReasonMaxLength} символов`,
      )
      .regex(plainTextPattern, "Не добавляйте ссылки или HTML"),
  })
  .strict();

export type WorkshopModerationReasonFormValues = z.infer<
  typeof workshopModerationReasonFormSchema
>;

export function getWorkshopModerationReasonInput<
  TDecision extends "REQUEST_CHANGES" | "HIDE",
>(
  decision: TDecision,
  values: WorkshopModerationReasonFormValues,
): WorkshopModerationDecisionInput & {
  decision: TDecision;
  reason: string;
} {
  return {
    decision,
    reason: values.reason.trim(),
  };
}
