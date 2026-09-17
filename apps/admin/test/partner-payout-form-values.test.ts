import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaidPayoutPayload,
  buildRejectPayoutPayload,
  createPaidPayoutFormSchema,
  createPayoutRequestState,
  getPaidPayoutRequestId,
  getRejectPayoutRequestId,
  toLocalDateTimeInput,
} from "../src/features/partners-management/lib/payout-form-values.ts";

const createdAt = "2026-09-17T10:30:45.250Z";
const now = new Date("2026-09-17T12:00:00.000Z");

test("paid payout payload trims reference and preserves seconds in ISO time", () => {
  const localValue = toLocalDateTimeInput(new Date(createdAt));
  const payload = buildPaidPayoutPayload(
    { paidAt: localValue, reference: " OP-42 ", confirmed: true },
    "11111111-1111-4111-8111-111111111111",
  );

  assert.deepEqual(payload, {
    requestId: "11111111-1111-4111-8111-111111111111",
    paidAt: new Date(createdAt).toISOString(),
    reference: "OP-42",
    confirmed: true,
  });
  assert.match(localValue, /:\d{2}\.\d{3}$/);
});

test("paid payout form rejects times before request, in future and missing confirmation", () => {
  const schema = createPaidPayoutFormSchema(createdAt, now);
  const before = schema.safeParse({
    paidAt: toLocalDateTimeInput(new Date("2026-09-17T10:30:44.000Z")),
    reference: "OP-1",
    confirmed: true,
  });
  const future = schema.safeParse({
    paidAt: toLocalDateTimeInput(new Date("2026-09-17T12:00:01.000Z")),
    reference: "OP-1",
    confirmed: true,
  });
  const unconfirmed = schema.safeParse({
    paidAt: toLocalDateTimeInput(new Date("2026-09-17T11:00:00.000Z")),
    reference: "OP-1",
    confirmed: false,
  });

  assert.equal(before.success, false);
  assert.equal(future.success, false);
  assert.equal(unconfirmed.success, false);
});

test("paid payout form reads the current time when validation runs", () => {
  let currentTime = new Date("2026-09-17T10:40:00.000Z");
  const schema = createPaidPayoutFormSchema(createdAt, () => currentTime);
  const values = {
    paidAt: toLocalDateTimeInput(new Date("2026-09-17T10:45:00.000Z")),
    reference: "OP-1",
    confirmed: true,
  };

  assert.equal(schema.safeParse(values).success, false);
  currentTime = new Date("2026-09-17T10:50:00.000Z");
  assert.equal(schema.safeParse(values).success, true);
});

test("paid request id is stable for normalized retry and changes with payload", () => {
  const values = {
    paidAt: toLocalDateTimeInput(new Date("2026-09-17T11:00:00.000Z")),
    reference: " OP-1 ",
    confirmed: true,
  };
  const first = getPaidPayoutRequestId(
    createPayoutRequestState(),
    values,
    () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  const retry = getPaidPayoutRequestId(
    first.state,
    { ...values, reference: "OP-1" },
    () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  const changed = getPaidPayoutRequestId(
    retry.state,
    { ...values, reference: "OP-2" },
    () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  );

  assert.equal(retry.requestId, first.requestId);
  assert.notEqual(changed.requestId, first.requestId);
});

test("reject payload requires a trimmed reason and keeps retry id stable", () => {
  const first = getRejectPayoutRequestId(
    createPayoutRequestState(),
    { reason: " Нарушены реквизиты " },
    () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  const retry = getRejectPayoutRequestId(
    first.state,
    { reason: "Нарушены реквизиты" },
    () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );

  assert.equal(retry.requestId, first.requestId);
  assert.deepEqual(
    buildRejectPayoutPayload(
      { reason: " Нарушены реквизиты " },
      first.requestId,
    ),
    {
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      reason: "Нарушены реквизиты",
    },
  );
});
