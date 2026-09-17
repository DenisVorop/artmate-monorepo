import assert from "node:assert/strict";
import test from "node:test";

import {
  getLedgerAvailabilityLabel,
  getLedgerHoldReasonLabel,
  getLedgerStatusLabel,
  getNewestFinanceDays,
} from "../src/features/partners-management/lib/finance-presenters.ts";

const availableAt = "2026-09-17T09:00:00.000Z";

test("reversal entries never show an availability date", () => {
  assert.equal(
    getLedgerAvailabilityLabel({
      availableAt,
      kind: "reversal",
      status: "available",
    }),
    null,
  );
  assert.equal(
    getLedgerAvailabilityLabel({
      availableAt,
      kind: "reversal",
      status: "pending",
    }),
    null,
  );
});

test("held and reversed credits do not claim availability", () => {
  assert.equal(
    getLedgerAvailabilityLabel({
      availableAt,
      kind: "credit",
      status: "held",
    }),
    null,
  );
  assert.equal(
    getLedgerAvailabilityLabel({
      availableAt,
      kind: "credit",
      status: "reversed",
    }),
    null,
  );
});

test("credit availability distinguishes planned and actual dates", () => {
  assert.match(
    getLedgerAvailabilityLabel({
      availableAt,
      kind: "credit",
      status: "pending",
    }) ?? "",
    /^Будет доступно /,
  );
  assert.match(
    getLedgerAvailabilityLabel({
      availableAt,
      kind: "credit",
      status: "available",
    }) ?? "",
    /^Доступно с /,
  );
});

test("pending credit without a date explains the completion waiting period", () => {
  assert.equal(
    getLedgerAvailabilityLabel({
      availableAt: null,
      kind: "credit",
      status: "pending",
    }),
    "Станет доступно через 14 дней после завершения заказа",
  );
});

test("financial statuses use precise admin labels", () => {
  assert.equal(getLedgerStatusLabel("pending"), "Ожидает подтверждения");
  assert.equal(getLedgerStatusLabel("held"), "Приостановлено");
});

test("held credits explain the concrete hold reason only", () => {
  assert.equal(
    getLedgerHoldReasonLabel({
      holdReason: "order_cancelled",
      kind: "credit",
      status: "held",
    }),
    "Заказ отменён",
  );
  assert.equal(
    getLedgerHoldReasonLabel({
      holdReason: "payment_not_confirmed",
      kind: "credit",
      status: "held",
    }),
    "Оплата заказа не подтверждена",
  );
  assert.equal(
    getLedgerHoldReasonLabel({
      holdReason: "order_not_completed",
      kind: "credit",
      status: "held",
    }),
    "Заказ ещё не завершён",
  );
  assert.equal(
    getLedgerHoldReasonLabel({
      holdReason: "order_cancelled",
      kind: "reversal",
      status: "reversed",
    }),
    null,
  );
});

test("daily details are newest first without mutating chart data", () => {
  const daily = [
    { date: "2026-09-15" },
    { date: "2026-09-16" },
    { date: "2026-09-17" },
  ] as const;

  assert.deepEqual(
    getNewestFinanceDays(daily).map((day) => day.date),
    ["2026-09-17", "2026-09-16", "2026-09-15"],
  );
  assert.deepEqual(
    daily.map((day) => day.date),
    ["2026-09-15", "2026-09-16", "2026-09-17"],
  );
});
