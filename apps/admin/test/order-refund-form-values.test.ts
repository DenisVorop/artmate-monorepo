import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRefundPayload,
  calculateRefundPreviewKopecks,
  createOrderRefundFormSchema,
  createRefundRequestState,
  getRefundRequestId,
  parseRublesToKopecks,
} from "../src/features/order-refunds/lib/form-values.ts";

const items = [
  {
    productId: "product-a",
    title: "Картина",
    quantity: 3,
    returnedQuantity: 0,
    remainingQuantity: 3,
    refundableKopecks: 2_500,
    remainingPriceGroups: [
      { unitPriceKopecks: 800, quantity: 2 },
      { unitPriceKopecks: 900, quantity: 1 },
    ],
  },
];

test("refund form rejects an empty operation", () => {
  const result = createOrderRefundFormSchema(items, 0).safeParse({
    reference: "REF-1",
    reason: "Возврат подтвержден",
    quantities: [0],
    deliveryRubles: "0",
    confirmed: true,
  });

  assert.equal(result.success, false);
});

test("preview consumes remaining price groups in supplied order", () => {
  assert.equal(
    calculateRefundPreviewKopecks(items, [2], "1,25"),
    1_725,
  );
  assert.equal(
    calculateRefundPreviewKopecks(items, [3], "0"),
    2_500,
  );
});

test("payload contains incremental quantities and integer kopecks", () => {
  const payload = buildRefundPayload(
    {
      reference: " REF-2 ",
      reason: " Частичный возврат ",
      quantities: [2],
      deliveryRubles: "12,34",
      confirmed: true,
    },
    items,
    "11111111-1111-4111-8111-111111111111",
  );

  assert.deepEqual(payload, {
    requestId: "11111111-1111-4111-8111-111111111111",
    reference: "REF-2",
    reason: "Частичный возврат",
    items: [{ productId: "product-a", quantity: 2 }],
    deliveryKopecks: 1_234,
    confirmed: true,
  });
});

test("zero-priced returned items remain a valid operation", () => {
  const result = createOrderRefundFormSchema(items, 0).safeParse({
    reference: "FREE-1",
    reason: "Возврат подарка",
    quantities: [1],
    deliveryRubles: "0",
    confirmed: true,
  });

  assert.equal(result.success, true);
});

test("request id stays stable for normalized retries and changes with payload", () => {
  const first = getRefundRequestId(
    createRefundRequestState(),
    {
      reference: " REF-3 ",
      reason: " Причина ",
      quantities: [1],
      deliveryRubles: "0,00",
      confirmed: true,
    },
    items,
    () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  const retry = getRefundRequestId(
    first.state,
    {
      reference: "REF-3",
      reason: "Причина",
      quantities: [1],
      deliveryRubles: "0",
      confirmed: true,
    },
    items,
    () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  const changed = getRefundRequestId(
    retry.state,
    {
      reference: "REF-3",
      reason: "Другая причина",
      quantities: [1],
      deliveryRubles: "0",
      confirmed: true,
    },
    items,
    () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  );

  assert.equal(retry.requestId, first.requestId);
  assert.notEqual(changed.requestId, first.requestId);
});

test("money parsing rejects unsafe and arbitrarily large kopeck values", () => {
  assert.equal(parseRublesToKopecks("12,34"), 1_234);
  assert.equal(parseRublesToKopecks("90071992547409,91"), 9_007_199_254_740_991);
  assert.equal(parseRublesToKopecks("90071992547409,92"), undefined);
  assert.equal(parseRublesToKopecks("9".repeat(1000)), undefined);
  assert.equal(parseRublesToKopecks("-1"), undefined);
});

test("invalid quantities and delivery produce no numeric preview", () => {
  assert.equal(calculateRefundPreviewKopecks(items, [-1], "0"), null);
  assert.equal(calculateRefundPreviewKopecks(items, [1.5], "0"), null);
  assert.equal(calculateRefundPreviewKopecks(items, [4], "0"), null);
  assert.equal(calculateRefundPreviewKopecks(items, [1], "not-money"), null);
  assert.equal(calculateRefundPreviewKopecks(items, [1], "9".repeat(1000)), null);
});

test("form limits use human Russian quantity and delivery errors", () => {
  const result = createOrderRefundFormSchema(items, 500).safeParse({
    reference: "LIMIT-1",
    reason: "Проверка лимитов",
    quantities: [4],
    deliveryRubles: "6",
    confirmed: true,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(
      result.error.issues.map((issue) => issue.message),
      ["Доступно не больше 3 шт.", "Доступно не больше 5,00 ₽"],
    );
  }
});

test("dotted and bracketed product ids round-trip by row index", () => {
  const specialItems = [
    { ...items[0]!, productId: "product.with.dot" },
    { ...items[0]!, productId: "product[bracket]" },
    { ...items[0]!, productId: "__proto__" },
  ];
  const payload = buildRefundPayload(
    {
      reference: "SPECIAL-1",
      reason: "Точные идентификаторы",
      quantities: [1, 2, 3],
      deliveryRubles: "0",
      confirmed: true,
    },
    specialItems,
    "11111111-1111-4111-8111-111111111111",
  );

  assert.deepEqual(payload.items, [
    { productId: "__proto__", quantity: 3 },
    { productId: "product.with.dot", quantity: 1 },
    { productId: "product[bracket]", quantity: 2 },
  ]);
});

test("lost-response retry preserves key across row ordering", () => {
  const reversedItems = [
    { ...items[0]!, productId: "b" },
    { ...items[0]!, productId: "a" },
  ];
  const first = getRefundRequestId(
    createRefundRequestState(),
    {
      reference: "LOST-1",
      reason: "Ответ потерян",
      quantities: [1, 2],
      deliveryRubles: "0,00",
      confirmed: true,
    },
    reversedItems,
    () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  const retryAfterCloseAndRefresh = getRefundRequestId(
    first.state,
    {
      reference: "LOST-1",
      reason: "Ответ потерян",
      quantities: [2, 1],
      deliveryRubles: "0",
      confirmed: true,
    },
    [...reversedItems].reverse(),
    () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );

  assert.equal(retryAfterCloseAndRefresh.requestId, first.requestId);
});
