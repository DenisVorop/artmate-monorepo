import { z } from "zod";

import type { CreateAffiliatePayoutInputDTO } from "@/shared/actions/affiliate";

export type PayoutFormValues = { amountRubles: string };

export function sanitizePayoutAmountInput(value: string) {
  const separatorIndex = value.search(/[,.]/);
  if (separatorIndex === -1) return value;

  return value.slice(0, separatorIndex + 3);
}

export function parseRublesToKopecks(value: string) {
  const normalized = value.trim().replaceAll(" ", "");
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(normalized);

  if (!match) return null;

  const rubles = Number(match[1]);
  const kopecks = Number((match[2] ?? "").padEnd(2, "0"));
  const amount = rubles * 100 + kopecks;

  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function createPayoutFormSchema({
  availableKopecks,
  minimumPayoutKopecks,
}: {
  availableKopecks: number;
  minimumPayoutKopecks: number;
}) {
  return z.object({
    amountRubles: z.string().superRefine((value, context) => {
      const amount = parseRublesToKopecks(value);

      if (amount === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Введите сумму в рублях.",
        });
      } else if (amount < minimumPayoutKopecks) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Сумма меньше минимальной выплаты.",
        });
      } else if (amount > availableKopecks) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Сумма больше доступного остатка.",
        });
      }
    }),
  });
}

export function buildCreateAffiliatePayoutInput(
  values: PayoutFormValues,
  requestId: string,
): CreateAffiliatePayoutInputDTO {
  const amountKopecks = parseRublesToKopecks(values.amountRubles);

  if (amountKopecks === null) {
    throw new Error("Payout amount must be validated before building input");
  }

  return { amountKopecks, requestId };
}
