import { createHash } from "node:crypto";

import { BadRequestException } from "@nestjs/common";
import { isISO8601 } from "class-validator";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCreatePayoutRequest(value: unknown) {
  const input = object(value);
  const requestId = uuid(input.requestId);
  const amountKopecks = positiveSafeInteger(input.amountKopecks, "amountKopecks");
  return {
    requestId,
    amountKopecks,
    requestFingerprint: fingerprint({ amountKopecks }),
  };
}

export function parseMarkPayoutPaidRequest(value: unknown) {
  const input = object(value);
  const requestId = uuid(input.requestId);
  if (input.confirmed !== true) {
    throw new BadRequestException("Payout confirmation is required");
  }
  const paidAtText = requiredString(input.paidAt, "paidAt");
  if (
    !isISO8601(paidAtText, { strict: true, strictSeparator: true }) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(paidAtText)
  ) {
    throw new BadRequestException("paidAt must be a timezone-qualified ISO date");
  }
  const paidAt = new Date(paidAtText);
  const reference = boundedString(input.reference, "reference", 160);
  return {
    requestId,
    paidAt,
    reference,
    confirmed: true as const,
    requestFingerprint: fingerprint({
      confirmed: true,
      paidAt: paidAt.toISOString(),
      reference,
    }),
  };
}

export function parseRejectPayoutRequest(value: unknown) {
  const input = object(value);
  const requestId = uuid(input.requestId);
  const reason = boundedString(input.reason, "reason", 1000);
  return {
    requestId,
    reason,
    requestFingerprint: fingerprint({ reason }),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Payout request body is invalid");
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown) {
  const result = requiredString(value, "requestId");
  if (!uuidPattern.test(result)) throw new BadRequestException("requestId must be a UUID");
  return result.toLowerCase();
}

function positiveSafeInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new BadRequestException(`${field} must be a positive safe integer`);
  }
  return value as number;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequestException(`${field} is required`);
  }
  return value;
}

function boundedString(value: unknown, field: string, max: number) {
  const result = requiredString(value, field).trim();
  if (result.length === 0 || result.length > max) {
    throw new BadRequestException(`${field} must contain 1 to ${max} characters`);
  }
  return result;
}

function fingerprint(payload: object) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
