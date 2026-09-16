import { z } from "zod";

import type { AffiliatePartner } from "@/entities/affiliate-partners";

export const affiliatePartnerFormSchema = z.object({
  contractNumber: z
    .string()
    .trim()
    .min(1, "Укажите номер договора")
    .max(120, "Номер договора не должен превышать 120 символов"),
  minimumPayoutRubles: z
    .string()
    .refine(
      (value) => parseRublesToKopecks(value) !== undefined,
      "Укажите положительную сумму с максимум двумя знаками после запятой",
    ),
  partnerApplicationId: z.string(),
  paymentDetails: z.string().trim().min(1, "Укажите платёжные реквизиты"),
  signedAt: z
    .string()
    .min(1, "Укажите дату подписания")
    .refine(
      isValidContractDate,
      "Укажите реальную дату не позднее сегодняшней",
    ),
  status: z.enum(["active", "suspended"]),
  userId: z.string().min(1, "Выберите пользователя"),
});

export type AffiliatePartnerFormValues = z.infer<
  typeof affiliatePartnerFormSchema
>;

type AffiliatePartnerInputOptions = {
  readonly originalSignedAt?: string;
  readonly partnerApplicationIdOverride?: string | null;
};

export function getAffiliatePartnerFormValues(
  partner?: AffiliatePartner,
): AffiliatePartnerFormValues {
  return {
    contractNumber: partner?.contract.number ?? "",
    minimumPayoutRubles:
      partner?.minimumPayoutKopecks == null
        ? ""
        : `${Math.floor(partner.minimumPayoutKopecks / 100)},${String(partner.minimumPayoutKopecks % 100).padStart(2, "0")}`,
    partnerApplicationId: partner?.partnerApplicationId ?? "",
    paymentDetails: partner?.contract.paymentDetails ?? "",
    signedAt: partner?.contract.signedAt.slice(0, 10) ?? "",
    status: partner?.status ?? "active",
    userId: partner?.userId ?? "",
  };
}

export function getTodayDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Moscow",
    year: "numeric",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((values, part) => {
      values[part.type] = part.value;
      return values;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isValidContractDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    value <= getTodayDateInputValue()
  );
}

export function parseRublesToKopecks(value: string): number | null | undefined {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);

  if (!match) {
    return undefined;
  }

  const kopecks = Number(`${match[1]}${(match[2] ?? "").padEnd(2, "0")}`);

  return Number.isSafeInteger(kopecks) && kopecks > 0 ? kopecks : undefined;
}

export function getAffiliatePartnerInput(
  values: AffiliatePartnerFormValues,
  options: AffiliatePartnerInputOptions = {},
) {
  const minimumPayoutKopecks = parseRublesToKopecks(values.minimumPayoutRubles);

  if (minimumPayoutKopecks === undefined) {
    throw new Error("Invalid minimum payout");
  }

  return {
    contract: {
      number: values.contractNumber.trim(),
      paymentDetails: values.paymentDetails.trim(),
      signedAt:
        options.originalSignedAt?.slice(0, 10) === values.signedAt
          ? options.originalSignedAt
          : `${values.signedAt}T00:00:00.000Z`,
    },
    minimumPayoutKopecks,
    partnerApplicationId:
      options.partnerApplicationIdOverride !== undefined
        ? options.partnerApplicationIdOverride
        : values.partnerApplicationId || null,
    status: values.status,
  };
}
