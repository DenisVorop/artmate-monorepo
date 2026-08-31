import { z } from "zod";

import type {
  PromoCodeAdminDTO,
  PromoCodeInputDTO,
  UpdatePromoCodeInputDTO,
} from "@/shared/actions/promocodes";

const optionalValueSchema = z.string().trim();
const maxPostgresInteger = 2_147_483_647;

export const promoCodeFormSchema = z
  .object({
    amount: optionalValueSchema,
    code: z
      .string()
      .trim()
      .min(3, "Код должен содержать минимум 3 символа")
      .max(40),
    description: optionalValueSchema,
    endsAt: optionalValueSchema,
    isActive: z.boolean(),
    maxDiscount: optionalValueSchema,
    maxUses: optionalValueSchema,
    maxUsesPerUser: optionalValueSchema,
    minSubtotal: optionalValueSchema,
    name: z
      .string()
      .trim()
      .min(1, "Укажите название")
      .max(160, "Максимум 160 символов"),
    startsAt: optionalValueSchema,
    type: z.enum(["percentage", "fixed"]),
  })
  .superRefine((values, context) => {
    const normalizedCode = normalizePromoCode(values.code);

    if (!/^[A-Z0-9_-]{3,40}$/.test(normalizedCode)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Используйте латинские буквы, цифры, _ или -",
        path: ["code"],
      });
    }

    if (values.type === "percentage") {
      const basisPoints = parseDecimalToInteger(values.amount, 2);

      if (basisPoints === null || basisPoints <= 0 || basisPoints > 10_000) {
        addFieldIssue(
          context,
          "amount",
          "Введите процент больше 0 и не больше 100",
        );
      }

      if (values.maxDiscount && !isPositiveMoney(values.maxDiscount)) {
        addFieldIssue(context, "maxDiscount", "Введите сумму больше 0");
      }
    } else if (!isPositiveMoney(values.amount)) {
      addFieldIssue(context, "amount", "Введите сумму больше 0");
    }

    if (values.minSubtotal && !isNonNegativeMoney(values.minSubtotal)) {
      addFieldIssue(context, "minSubtotal", "Введите сумму не меньше 0");
    }

    for (const field of ["maxUses", "maxUsesPerUser"] as const) {
      if (values[field] && parsePositiveInteger(values[field]) === null) {
        addFieldIssue(
          context,
          field,
          `Введите целое число от 1 до ${maxPostgresInteger}`,
        );
      }
    }

    const startsAt = values.startsAt
      ? moscowDateTimeToUtc(values.startsAt)
      : null;
    const endsAt = values.endsAt ? moscowDateTimeToUtc(values.endsAt) : null;

    if (values.startsAt && !startsAt) {
      addFieldIssue(context, "startsAt", "Укажите корректные дату и время");
    }

    if (values.endsAt && !endsAt) {
      addFieldIssue(context, "endsAt", "Укажите корректные дату и время");
    }

    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      addFieldIssue(context, "endsAt", "Окончание должно быть позже начала");
    }
  });

export type PromoCodeFormValues = z.infer<typeof promoCodeFormSchema>;

export const createPromoCodeDefaultValues = {
  amount: "",
  code: "",
  description: "",
  endsAt: "",
  isActive: true,
  maxDiscount: "",
  maxUses: "",
  maxUsesPerUser: "",
  minSubtotal: "0",
  name: "",
  startsAt: "",
  type: "percentage",
} satisfies PromoCodeFormValues;

export function getPromoCodeDefaultValues(
  promoCode: PromoCodeAdminDTO,
): PromoCodeFormValues {
  return {
    amount:
      promoCode.type === "percentage"
        ? formatIntegerAsDecimal(promoCode.basisPoints ?? 0, 2)
        : formatIntegerAsDecimal(promoCode.amountKopecks ?? 0, 2),
    code: promoCode.code,
    description: promoCode.description ?? "",
    endsAt: utcToMoscowDateTime(promoCode.endsAt),
    isActive: promoCode.isActive,
    maxDiscount: formatOptionalMoney(promoCode.maxDiscountKopecks),
    maxUses: formatOptionalInteger(promoCode.maxUses),
    maxUsesPerUser:
      promoCode.kind === "welcome"
        ? "1"
        : formatOptionalInteger(promoCode.maxUsesPerUser),
    minSubtotal: formatIntegerAsDecimal(promoCode.minSubtotalKopecks ?? 0, 2),
    name: promoCode.name,
    startsAt: utcToMoscowDateTime(promoCode.startsAt),
    type: promoCode.type,
  };
}

export function getCreatePromoCodeInput(
  values: PromoCodeFormValues,
): PromoCodeInputDTO {
  return {
    code: normalizePromoCode(values.code),
    ...getEditablePromoCodeInput(values),
  };
}

export function getUpdatePromoCodeInput(
  values: PromoCodeFormValues,
  originalPromoCode: PromoCodeAdminDTO,
): UpdatePromoCodeInputDTO {
  return getEditablePromoCodeInput(values, originalPromoCode);
}

export function getTogglePromoCodeInput(
  promoCode: PromoCodeAdminDTO,
  isActive: boolean,
): UpdatePromoCodeInputDTO {
  return {
    amountKopecks:
      promoCode.type === "fixed" ? (promoCode.amountKopecks ?? null) : null,
    basisPoints:
      promoCode.type === "percentage" ? (promoCode.basisPoints ?? null) : null,
    description: promoCode.description ?? null,
    endsAt: promoCode.endsAt ?? null,
    isActive,
    maxDiscountKopecks:
      promoCode.type === "percentage"
        ? (promoCode.maxDiscountKopecks ?? null)
        : null,
    maxUses: promoCode.maxUses ?? null,
    maxUsesPerUser:
      promoCode.kind === "welcome" ? 1 : (promoCode.maxUsesPerUser ?? null),
    minSubtotalKopecks: promoCode.minSubtotalKopecks ?? 0,
    name: promoCode.name,
    startsAt: promoCode.startsAt ?? null,
    type: promoCode.type,
  };
}

export function parseDecimalToInteger(value: string, scaleDigits: number) {
  const normalized = value.trim().replace(",", ".");
  const match = new RegExp(`^(\\d+)(?:\\.(\\d{1,${scaleDigits}}))?$`).exec(
    normalized,
  );

  if (!match) {
    return null;
  }

  const factor = 10 ** scaleDigits;
  const integerPart = Number(match[1]);
  const fractionPart = Number((match[2] ?? "").padEnd(scaleDigits, "0"));
  const result = integerPart * factor + fractionPart;

  return Number.isSafeInteger(result) ? result : null;
}

export function moscowDateTimeToUtc(value: string) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
      value.trim(),
    );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const millisecond = Number((match[7] ?? "").padEnd(3, "0"));
  const localTime = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  const check = new Date(localTime);

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second ||
    check.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }

  return new Date(localTime - 3 * 60 * 60 * 1000).toISOString();
}

export function utcToMoscowDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const utcDate = new Date(value);

  if (Number.isNaN(utcDate.getTime())) {
    return "";
  }

  return new Date(utcDate.getTime() + 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 23);
}

export function normalizePromoCode(value: string) {
  return value.trim().replace(/[a-z]/g, (character) => character.toUpperCase());
}

function getEditablePromoCodeInput(
  values: PromoCodeFormValues,
  originalPromoCode?: PromoCodeAdminDTO,
): UpdatePromoCodeInputDTO {
  const isPercentage = values.type === "percentage";

  return {
    amountKopecks: isPercentage ? null : parseRequiredDecimal(values.amount),
    basisPoints: isPercentage ? parseRequiredDecimal(values.amount) : null,
    description: getNullableText(values.description),
    endsAt: getDateInput(values.endsAt, originalPromoCode?.endsAt),
    isActive: values.isActive,
    maxDiscountKopecks:
      isPercentage && values.maxDiscount
        ? parseRequiredDecimal(values.maxDiscount)
        : null,
    maxUses: values.maxUses
      ? parseRequiredPositiveInteger(values.maxUses)
      : null,
    maxUsesPerUser:
      originalPromoCode?.kind === "welcome"
        ? 1
        : values.maxUsesPerUser
          ? parseRequiredPositiveInteger(values.maxUsesPerUser)
          : null,
    minSubtotalKopecks: values.minSubtotal
      ? parseRequiredDecimal(values.minSubtotal)
      : 0,
    name: values.name.trim(),
    startsAt: getDateInput(values.startsAt, originalPromoCode?.startsAt),
    type: values.type,
  };
}

function isPositiveMoney(value: string) {
  const kopecks = parseDecimalToInteger(value, 2);

  return kopecks !== null && kopecks > 0;
}

function isNonNegativeMoney(value: string) {
  return parseDecimalToInteger(value, 2) !== null;
}

function parsePositiveInteger(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const result = Number(value);

  return Number.isSafeInteger(result) &&
    result > 0 &&
    result <= maxPostgresInteger
    ? result
    : null;
}

function getDateInput(value: string, originalValue: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (originalValue && value === utcToMoscowDateTime(originalValue)) {
    return originalValue;
  }

  return moscowDateTimeToUtc(value);
}

function parseRequiredDecimal(value: string) {
  const result = parseDecimalToInteger(value, 2);

  if (result === null) {
    throw new Error("Invalid decimal form value");
  }

  return result;
}

function parseRequiredPositiveInteger(value: string) {
  const result = parsePositiveInteger(value);

  if (result === null) {
    throw new Error("Invalid positive integer form value");
  }

  return result;
}

function getNullableText(value: string) {
  const trimmed = value.trim();

  return trimmed || null;
}

function formatOptionalMoney(value: number | null | undefined) {
  return value == null ? "" : formatIntegerAsDecimal(value, 2);
}

function formatOptionalInteger(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function formatIntegerAsDecimal(value: number, scaleDigits: number) {
  const factor = 10 ** scaleDigits;
  const integer = Math.trunc(value / factor);
  const fraction = String(Math.abs(value % factor)).padStart(scaleDigits, "0");

  return fraction === "0".repeat(scaleDigits)
    ? String(integer)
    : `${integer}.${fraction.replace(/0+$/, "")}`;
}

function addFieldIssue(
  context: z.RefinementCtx,
  field: keyof PromoCodeFormValues,
  message: string,
) {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] });
}
