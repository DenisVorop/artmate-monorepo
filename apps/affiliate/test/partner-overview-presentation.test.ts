import assert from "node:assert/strict";
import test from "node:test";

import {
  getDailyTableRows,
  getEarningsChartGeometry,
  getLedgerPresentation,
  getLedgerStatusHint,
} from "../src/features/partner-overview/lib/finance-presentation.ts";

test("shows a reversal only as a return without an availability status", () => {
  assert.deepEqual(
    getLedgerPresentation({
      amountKopecks: -1_000,
      availableAt: null,
      code: "ARTM-RETURN",
      createdAt: "2026-01-02T08:00:00.000Z",
      holdReason: null,
      id: "entry-1",
      isSelfPurchase: false,
      kind: "reversal",
      partnerPercent: 10,
      status: "available",
    }),
    { kindLabel: "Возврат", note: null, statusLabel: null },
  );
});

test("uses human labels and treats availability as an expected date", () => {
  const baseCredit = {
    amountKopecks: 1_000,
    code: "ARTM-CREDIT",
    createdAt: "2026-01-02T08:00:00.000Z",
    holdReason: null,
    id: "entry-2",
    isSelfPurchase: false,
    kind: "credit" as const,
    partnerPercent: 10,
  };

  assert.deepEqual(
    getLedgerPresentation({
      ...baseCredit,
      availableAt: null,
      status: "reversed",
    }),
    { kindLabel: "Начисление", note: null, statusLabel: "Отменено" },
  );
  assert.deepEqual(
    getLedgerPresentation({
      ...baseCredit,
      availableAt: "2026-01-01T21:30:00.000Z",
      status: "pending",
    }),
    {
      kindLabel: "Начисление",
      note: "Будет доступно 2 января, 00:30 МСК",
      statusLabel: "Ожидает подтверждения",
    },
  );
});

test("explains pending credits without inventing an availability date", () => {
  assert.deepEqual(
    getLedgerPresentation({
      amountKopecks: 1_000,
      availableAt: null,
      code: "ARTM-PENDING",
      createdAt: "2026-01-02T08:00:00.000Z",
      holdReason: null,
      id: "entry-pending",
      isSelfPurchase: false,
      kind: "credit",
      partnerPercent: 10,
      status: "pending",
    }),
    {
      kindLabel: "Начисление",
      note: "Станет доступно через 14 дней после завершения заказа",
      statusLabel: "Ожидает подтверждения",
    },
  );
});

test("shows a plain-language reason for every held credit", () => {
  const expectedReasons = {
    order_cancelled: "Заказ отменён",
    order_not_completed: "Заказ ещё не завершён",
    payment_not_confirmed: "Оплата заказа не подтверждена",
  } as const;

  for (const [holdReason, note] of Object.entries(expectedReasons)) {
    assert.deepEqual(
      getLedgerPresentation({
        amountKopecks: 1_000,
        availableAt: null,
        code: "ARTM-HELD",
        createdAt: "2026-01-02T08:00:00.000Z",
        holdReason: holdReason as keyof typeof expectedReasons,
        id: `entry-${holdReason}`,
        isSelfPurchase: false,
        kind: "credit",
        partnerPercent: 10,
        status: "held",
      }),
      {
        kindLabel: "Начисление",
        note,
        statusLabel: "Приостановлено",
      },
    );
  }
});

test("explains pending credits with and without an expected date", () => {
  const pendingCredit = {
    amountKopecks: 1_000,
    code: "ARTM-PENDING",
    createdAt: "2026-01-02T08:00:00.000Z",
    holdReason: null,
    id: "entry-pending-hint",
    isSelfPurchase: false,
    kind: "credit" as const,
    partnerPercent: 10,
    status: "pending" as const,
  };

  assert.equal(
    getLedgerStatusHint({ ...pendingCredit, availableAt: null }),
    "Заказ ещё не завершён или 14 дней после завершения ещё не прошли.",
  );
  assert.equal(
    getLedgerStatusHint({
      ...pendingCredit,
      availableAt: "2026-01-01T21:30:00.000Z",
    }),
    "Заказ ещё не завершён или 14 дней после завершения ещё не прошли. Ожидаемая дата: 2 января, 00:30 МСК.",
  );
});

test("explains available and reversed credit statuses", () => {
  const credit = {
    amountKopecks: 1_000,
    availableAt: null,
    code: "ARTM-CREDIT",
    createdAt: "2026-01-02T08:00:00.000Z",
    holdReason: null,
    id: "entry-credit-hint",
    isSelfPurchase: false,
    kind: "credit" as const,
    partnerPercent: 10,
  };

  assert.equal(
    getLedgerStatusHint({ ...credit, status: "available" }),
    "14 дней после завершения заказа прошли, вознаграждение учтено в доступном балансе.",
  );
  assert.equal(
    getLedgerStatusHint({ ...credit, status: "reversed" }),
    "Вознаграждение отменено из-за возврата товаров.",
  );
});

test("includes each actual order reason in a held status hint", () => {
  const expectedReasons = {
    order_cancelled: "Заказ отменён",
    order_not_completed: "Заказ ещё не завершён",
    payment_not_confirmed: "Оплата заказа не подтверждена",
  } as const;

  for (const [holdReason, reason] of Object.entries(expectedReasons)) {
    assert.equal(
      getLedgerStatusHint({
        amountKopecks: 1_000,
        availableAt: null,
        code: "ARTM-HELD",
        createdAt: "2026-01-02T08:00:00.000Z",
        holdReason: holdReason as keyof typeof expectedReasons,
        id: `entry-held-hint-${holdReason}`,
        isSelfPurchase: false,
        kind: "credit",
        partnerPercent: 10,
        status: "held",
      }),
      `Начисление временно недоступно. ${reason}.`,
    );
  }
});

test("explains every not-earned reason and its fallback", () => {
  const notEarnedCredit = {
    amountKopecks: 0,
    availableAt: null,
    code: "ARTM-NOT-EARNED",
    createdAt: "2026-01-02T08:00:00.000Z",
    holdReason: null,
    id: "entry-not-earned-hint",
    kind: "credit" as const,
    status: "not_earned" as const,
  };

  assert.equal(
    getLedgerStatusHint({
      ...notEarnedCredit,
      isSelfPurchase: true,
      partnerPercent: 10,
    }),
    "Это собственная покупка: скидка сохранена, вознаграждение не начисляется.",
  );
  assert.equal(
    getLedgerStatusHint({
      ...notEarnedCredit,
      isSelfPurchase: false,
      partnerPercent: 0,
    }),
    "Доля партнёра 0%, поэтому вознаграждение не начисляется.",
  );
  assert.equal(
    getLedgerStatusHint({
      ...notEarnedCredit,
      isSelfPurchase: false,
      partnerPercent: 10,
    }),
    "По этому заказу партнёрское вознаграждение не начисляется.",
  );
});

test("does not create a credit status hint for reversal ledger events", () => {
  assert.equal(
    getLedgerStatusHint({
      amountKopecks: -1_000,
      availableAt: null,
      code: "ARTM-RETURN",
      createdAt: "2026-01-02T08:00:00.000Z",
      holdReason: null,
      id: "entry-return-hint",
      isSelfPurchase: false,
      kind: "reversal",
      partnerPercent: 10,
      status: "reversed",
    }),
    null,
  );
});

test("sorts daily table rows newest first without changing chart data", () => {
  const daily = [
    { date: "2026-01-01", netKopecks: 100 },
    { date: "2026-01-03", netKopecks: 300 },
    { date: "2026-01-02", netKopecks: 200 },
  ];
  const originalOrder = daily.map(({ date }) => date);

  assert.deepEqual(
    getDailyTableRows(daily).map(({ date }) => date),
    ["2026-01-03", "2026-01-02", "2026-01-01"],
  );
  assert.deepEqual(
    daily.map(({ date }) => date),
    originalOrder,
  );
});

test("chart geometry keeps zero between positive and negative values", () => {
  const geometry = getEarningsChartGeometry([
    { date: "2026-01-01", netKopecks: 2_000 },
    { date: "2026-01-02", netKopecks: -1_000 },
  ]);

  assert.deepEqual(geometry.domain, { max: 2_000, min: -1_000 });
  assert.ok(geometry.zeroY > geometry.plotTop);
  assert.ok(geometry.zeroY < geometry.plotBottom);
  assert.equal(geometry.firstDate, "2026-01-01");
  assert.equal(geometry.lastDate, "2026-01-02");
});
