import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(
  new URL(
    "../src/entities/orders/ui/order-discount-summary.tsx",
    import.meta.url,
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = {
  exports: {} as Record<
    string,
    (props: unknown) => Parameters<typeof renderToStaticMarkup>[0]
  >,
};
new Function("require", "module", "exports", compiled)(
  (id: string) =>
    id === "@/shared/lib/utils"
      ? { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") }
      : require(id),
  loaded,
  loaded.exports,
);
const summary = loaded.exports.OrderDiscountSummary!;
const mixed = {
  promoCode: "ARTMSTART",
  discount: 245,
  payment: { status: "paid" },
  discountBreakdown: {
    promoDiscount: 140,
    loyaltyDiscount: 105,
    loyaltyPoints: 525,
  },
};
const render = (order: unknown) =>
  renderToStaticMarkup(summary({ order })).replaceAll(/\s+/g, " ");

test("mixed discount displays code, its own amount, point count, point amount and total separately", () => {
  const html = render(mixed);
  for (const value of [
    "Промокод",
    "ARTMSTART",
    "− 140 ₽",
    "Списанные баллы",
    "525 баллов",
    "− 105 ₽",
    "Общая скидка",
    "− 245 ₽",
  ])
    assert.ok(html.includes(value), value);
  assert.ok(!html.includes("Скидка заказа"));
});

test("points-only and promo-only orders retain their actual sources", () => {
  const points = render({
    ...mixed,
    promoCode: null,
    discount: 230.2,
    discountBreakdown: {
      promoDiscount: 0,
      loyaltyDiscount: 230.2,
      loyaltyPoints: 1151,
    },
  });
  assert.match(points, /Не применён/);
  assert.match(points, /1 151 балл/);
  assert.match(points, /230,20 ₽/);
  const promo = render({
    ...mixed,
    discount: 140,
    discountBreakdown: {
      promoDiscount: 140,
      loyaltyDiscount: 0,
      loyaltyPoints: 0,
    },
  });
  assert.match(promo, /Не использованы/);
  assert.ok(!promo.includes("525"));
});

test("pending payments do not claim that points have already been spent", () => {
  const html = render({ ...mixed, payment: { status: "pending" } });
  assert.match(html, /Баллы в расчёте/);
  assert.ok(!html.includes("Списанные баллы"));
});

test("missing breakdown preserves the total without inventing points or promo amounts", () => {
  const html = render({ ...mixed, discountBreakdown: null });
  assert.match(html, /Разбивка скидки для этого заказа недоступна/);
  assert.match(html, /Сумма не указана/);
  assert.match(html, /Нет данных/);
  assert.match(html, /− 245 ₽/);
  assert.ok(!html.includes("525"));
});

test("zero discount without a code is hidden and codes are escaped", () => {
  assert.equal(render({ ...mixed, promoCode: null, discount: 0 }), "");
  assert.ok(
    !render({ ...mixed, promoCode: "<script>alert(1)</script>" }).includes(
      "<script>",
    ),
  );
});
