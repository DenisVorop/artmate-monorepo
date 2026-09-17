import { z } from "zod";

export type RefundableItem = {
  readonly productId: string;
  readonly remainingQuantity: number;
  readonly remainingPriceGroups: readonly {
    readonly unitPriceKopecks: number;
    readonly quantity: number;
  }[];
};

export type OrderRefundFormValues = {
  reference: string;
  reason: string;
  quantities: number[];
  deliveryRubles: string;
  confirmed: boolean;
};

const quantitySchema = z
  .number({ invalid_type_error: "Введите целое количество" })
  .int("Введите целое количество")
  .min(0, "Количество не может быть отрицательным");

const baseOrderRefundFormSchema = z.object({
  reference: z.string().trim().min(1, "Укажите номер операции").max(120),
  reason: z.string().trim().min(1, "Укажите причину возврата").max(1000),
  quantities: z.array(quantitySchema),
  deliveryRubles: z.string().trim(),
  confirmed: z
    .boolean()
    .refine((value) => value, "Подтвердите, что возврат уже выполнен"),
});

export function createOrderRefundFormSchema(
  items: readonly RefundableItem[],
  refundableDeliveryKopecks: number,
) {
  return baseOrderRefundFormSchema.superRefine((values, context) => {
    if (values.quantities.length !== items.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Обновите данные возврата и повторите попытку",
        path: ["quantities", "root"],
      });
      return;
    }

    values.quantities.forEach((quantity, index) => {
      const item = items[index];
      if (item && quantity > item.remainingQuantity) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Доступно не больше ${item.remainingQuantity} шт.`,
          path: ["quantities", index],
        });
      }
    });

    const deliveryKopecks = parseRublesToKopecks(values.deliveryRubles);
    if (deliveryKopecks === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите корректную сумму в рублях",
        path: ["deliveryRubles"],
      });
      return;
    }
    if (deliveryKopecks > refundableDeliveryKopecks) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Доступно не больше ${formatMoney(refundableDeliveryKopecks)}`,
        path: ["deliveryRubles"],
      });
    }
    if (
      values.quantities.every((quantity) => quantity === 0) &&
      deliveryKopecks === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите товары или сумму доставки",
        path: ["quantities", "root"],
      });
    }
  });
}

export function parseRublesToKopecks(value: string): number | undefined {
  const match = /^(\d{1,14})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return undefined;

  const kopecks =
    BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return kopecks <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(kopecks) : undefined;
}

export function calculateRefundPreviewKopecks(
  items: readonly RefundableItem[],
  quantities: readonly number[],
  deliveryRubles: string,
): number | null {
  const deliveryKopecks = parseRublesToKopecks(deliveryRubles);
  if (deliveryKopecks === undefined || quantities.length !== items.length) return null;

  let total = BigInt(deliveryKopecks);
  for (const [index, item] of items.entries()) {
    const quantity = quantities[index];
    if (
      quantity === undefined ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > item.remainingQuantity
    ) {
      return null;
    }

    let remaining = quantity;
    for (const group of item.remainingPriceGroups) {
      const consumed = Math.min(remaining, group.quantity);
      total += BigInt(consumed) * BigInt(group.unitPriceKopecks);
      remaining -= consumed;
      if (remaining === 0) break;
    }
  }

  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}

export function buildRefundPayload(
  values: OrderRefundFormValues,
  items: readonly RefundableItem[],
  requestId: string,
) {
  const deliveryKopecks = parseRublesToKopecks(values.deliveryRubles);
  if (deliveryKopecks === undefined) throw new Error("Invalid delivery amount");

  return {
    requestId,
    reference: values.reference.trim(),
    reason: values.reason.trim(),
    items: items
      .map((item, index) => ({
        productId: item.productId,
        quantity: values.quantities[index] ?? 0,
      }))
      .filter(({ quantity }) => quantity > 0)
      .sort((left, right) =>
        left.productId < right.productId
          ? -1
          : left.productId > right.productId
            ? 1
            : 0,
      ),
    deliveryKopecks,
    confirmed: true as const,
  };
}

export type RefundRequestState = {
  readonly fingerprint: string | null;
  readonly requestId: string | null;
};

export function createRefundRequestState(): RefundRequestState {
  return { fingerprint: null, requestId: null };
}

export function getRefundRequestId(
  state: RefundRequestState,
  values: OrderRefundFormValues,
  items: readonly RefundableItem[],
  generateUuid: () => string = () => crypto.randomUUID(),
) {
  const normalized = buildRefundPayload(values, items, "");
  const fingerprint = JSON.stringify(normalized);
  const requestId =
    state.fingerprint === fingerprint && state.requestId
      ? state.requestId
      : generateUuid();

  return { requestId, state: { fingerprint, requestId } };
}

export function getOrderRefundDefaultValues(
  items: readonly RefundableItem[],
): OrderRefundFormValues {
  return {
    reference: "",
    reason: "",
    quantities: items.map(() => 0),
    deliveryRubles: "0",
    confirmed: false,
  };
}

export function formatKopecksInput(value: number) {
  return `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
  }).format(value / 100);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
