import crypto from "node:crypto";

import { BadRequestException } from "@nestjs/common";

export type ParsedOrderRefundRequest = Readonly<{
  confirmed: true;
  deliveryKopecks: number;
  items: readonly Readonly<{ productId: string; quantity: number }>[];
  reason: string;
  reference: string;
  requestFingerprint: string;
  requestId: string;
}>;

export function parseOrderRefundRequest(
  value: unknown,
): ParsedOrderRefundRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Данные возврата заполнены неверно");
  }
  const input = value as Record<string, unknown>;
  if (input.confirmed !== true) {
    throw new BadRequestException("Подтвердите, что возврат уже выполнен");
  }
  const requestId = parseUuid(input.requestId);
  const reference = parseTrimmed(input.reference, "reference", 120);
  const reason = parseTrimmed(input.reason, "reason", 1000);
  const deliveryKopecks = parseNonnegativeInteger(
    input.deliveryKopecks,
    "Сумма возврата доставки",
  );
  if (!Array.isArray(input.items)) {
    throw new BadRequestException("Позиции возврата должны быть массивом");
  }
  const seen = new Set<string>();
  const items = input.items.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException(
        `Позиция возврата ${index + 1} заполнена неверно`,
      );
    }
    const item = value as Record<string, unknown>;
    const productId = parseTrimmed(item.productId, "productId", 191);
    if (seen.has(productId)) {
      throw new BadRequestException("Один товар нельзя указать дважды");
    }
    seen.add(productId);
    if (!Number.isSafeInteger(item.quantity) || Number(item.quantity) <= 0) {
      throw new BadRequestException(
        "Количество возврата должно быть целым положительным числом",
      );
    }
    return { productId, quantity: item.quantity as number };
  });
  if (items.length === 0 && deliveryKopecks === 0) {
    throw new BadRequestException(
      "Укажите товары или сумму доставки для возврата",
    );
  }
  items.sort((left, right) => left.productId.localeCompare(right.productId));
  const normalized = {
    confirmed: true as const,
    deliveryKopecks,
    items,
    reason,
    reference,
    requestId,
  };
  return {
    ...normalized,
    requestFingerprint: crypto
      .createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex"),
  };
}

function parseUuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new BadRequestException("requestId должен быть UUID");
  }
  return value.toLowerCase();
}

function parseTrimmed(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} должен быть строкой`);
  }
  const result = value.trim();
  if (!result || result.length > maxLength) {
    throw new BadRequestException(`${field} заполнен неверно`);
  }
  return result;
}

function parseNonnegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new BadRequestException(`${label} должна быть целым числом копеек`);
  }
  return value as number;
}
