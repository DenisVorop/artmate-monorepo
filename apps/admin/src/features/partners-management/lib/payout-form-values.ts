import { z } from "zod";

export type PaidPayoutFormValues = {
  paidAt: string;
  reference: string;
  confirmed: boolean;
};

export type RejectPayoutFormValues = { reason: string };

export type PayoutRequestState = {
  readonly fingerprint: string | null;
  readonly requestId: string | null;
};

export const rejectPayoutFormSchema = z.object({
  reason: z.string().trim().min(1, "Укажите причину отказа").max(1000),
});

export function createPaidPayoutFormSchema(
  payoutCreatedAt: string,
  now: Date | (() => Date) = () => new Date(),
) {
  return z
    .object({
      paidAt: z.string().min(1, "Укажите дату выплаты"),
      reference: z
        .string()
        .trim()
        .min(1, "Укажите номер операции")
        .max(160, "Не больше 160 символов"),
      confirmed: z
        .boolean()
        .refine((value) => value, "Подтвердите выполненную выплату"),
    })
    .superRefine((values, context) => {
      const paidAt = new Date(values.paidAt);
      if (Number.isNaN(paidAt.getTime())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите корректную дату выплаты",
          path: ["paidAt"],
        });
      } else if (paidAt < new Date(payoutCreatedAt)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Дата выплаты не может быть раньше заявки",
          path: ["paidAt"],
        });
      } else if (paidAt > (typeof now === "function" ? now() : now)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Дата выплаты не может быть в будущем",
          path: ["paidAt"],
        });
      }
    });
}

export function buildPaidPayoutPayload(
  values: PaidPayoutFormValues,
  requestId: string,
) {
  return {
    requestId,
    paidAt: new Date(values.paidAt).toISOString(),
    reference: values.reference.trim(),
    confirmed: true as const,
  };
}

export function buildRejectPayoutPayload(
  values: RejectPayoutFormValues,
  requestId: string,
) {
  return { requestId, reason: values.reason.trim() };
}

export function createPayoutRequestState(): PayoutRequestState {
  return { fingerprint: null, requestId: null };
}

export function getPaidPayoutRequestId(
  state: PayoutRequestState,
  values: PaidPayoutFormValues,
  generateUuid: () => string = () => crypto.randomUUID(),
) {
  return getPayoutRequestId(
    state,
    buildPaidPayoutPayload(values, ""),
    generateUuid,
  );
}

export function getRejectPayoutRequestId(
  state: PayoutRequestState,
  values: RejectPayoutFormValues,
  generateUuid: () => string = () => crypto.randomUUID(),
) {
  return getPayoutRequestId(
    state,
    buildRejectPayoutPayload(values, ""),
    generateUuid,
  );
}

function getPayoutRequestId(
  state: PayoutRequestState,
  normalizedPayload: object,
  generateUuid: () => string,
) {
  const fingerprint = JSON.stringify(normalizedPayload);
  const requestId =
    state.fingerprint === fingerprint && state.requestId
      ? state.requestId
      : generateUuid();
  return { requestId, state: { fingerprint, requestId } };
}

export function toLocalDateTimeInput(value: Date) {
  const pad = (part: number, length = 2) => String(part).padStart(length, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`;
}
