import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("cart explains that CDEK or Ozon is selected on the checkout step", async () => {
  const source = await readSource("src/features/cart/ui/cart-summary.tsx");

  assert.match(source, /routes\.checkout/);
  assert.match(source, /СДЭК/);
  assert.match(source, /Ozon/);
  assert.match(source, /следующем шаге/);
});

test("checkout offers both declared delivery companies", async () => {
  const source = await readSource("src/features/checkout/ui/delivery-selector/delivery-options.ts");

  assert.match(source, /code: "cdek"/);
  assert.match(source, /label: "СДЭК"/);
  assert.match(source, /code: "ozon"/);
  assert.match(source, /label: "Ozon"/);
});

test("order summary derives the visible company from the checkout calculation", async () => {
  const source = await readSource("src/features/checkout/ui/order-summary.tsx");

  assert.match(source, /calculation\?\.delivery\.provider/);
  assert.match(source, /СДЭК/);
  assert.match(source, /Ozon/);
  assert.doesNotMatch(source, /calculation\s*\?\s*"СДЭК, пункт выдачи"/);
});
