import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("order refunds keep query, form state, mutation and page composition in FSD layers", async () => {
  const [page, feature, dialog, formState, entityHook, mutation] = await Promise.all([
    source("src/_pages/order-history/ui/order-history-page.tsx"),
    source("src/features/order-refunds/ui/order-refunds.tsx"),
    source("src/features/order-refunds/ui/refund-dialog.tsx"),
    source("src/features/order-refunds/lib/use-refund-form.ts"),
    source("src/entities/order-refund/model/use-order-refunds-data.ts"),
    source("src/features/order-refunds/model/use-record-order-refund.ts"),
  ]);

  assert.match(page, /<OrderRefunds orderId={orderId} \/>/);
  assert.doesNotMatch(page, /useQuery|useMutation/);
  assert.match(feature, /useOrderRefundsData\(orderId\)/);
  assert.match(dialog, /useRefundForm/);
  assert.match(formState, /useForm/);
  assert.match(formState, /useRef/);
  assert.match(formState, /useRecordOrderRefund/);
  assert.match(formState, /mode: "onChange"/);
  assert.doesNotMatch(
    `${feature}\n${dialog}`,
    /useForm\s*\(|useMutation\s*\(|useRef\s*\(/,
  );
  assert.match(
    entityHook,
    /useQuery\(\s*orderRefundsQuery\(orderId\),?\s*\)/,
  );
  assert.match(mutation, /ordersQueryKeys\.detail\(data\.orderId\)/);
  assert.match(mutation, /orderRefundsQueryKeys\.detail\(data\.orderId\)/);
});

test("refund dialog communicates accounting-only action and pending safety", async () => {
  const feature = await source(
    "src/features/order-refunds/ui/refund-dialog.tsx",
  );

  assert.match(feature, /Учесть возврат/);
  assert.match(feature, /Сохранение не переводит деньги покупателю\./);
  assert.match(feature, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(feature, /disabled={isPending}/);
  assert.match(feature, /field-sizing-fixed/);
  assert.match(feature, /useId\(\)/);
});

test("order history presents refund events and long item names safely", async () => {
  const history = await source("src/features/order-history/ui/order-history.tsx");

  assert.match(history, /refund_recorded/);
  assert.match(history, /Возврат учтен/);
  assert.match(history, /break-words font-medium/);
  assert.match(
    history,
    /grid min-w-0 grid-cols-\[minmax\(0,1fr\)\] gap-4/,
  );
  assert.match(history, /<div className="min-w-0 space-y-4">/);
  assert.match(history, /<aside className="min-w-0 space-y-4">/);
  assert.doesNotMatch(history, /overflow-x-hidden/);
});
