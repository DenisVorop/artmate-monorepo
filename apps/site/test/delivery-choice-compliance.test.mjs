import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("cart explains that CDEK or Ozon is selected on the checkout step", async () => {
  const source = await readSource("src/features/cart/ui/cart-summary.tsx");

  assert.match(
    source,
    /<CardFooter\b[^>]*>\s*<p\b[^>]*>\s*Службу\s+доставки\s+и\s+ПВЗ\s+СДЭК\s+или\s+Ozon\s+выберете\s+на\s+следующем\s+шаге\.\s*Доступность\s+Ozon\s+зависит\s+от\s+товаров\s+в\s+корзине\.\s*<\/p>/u,
  );
  assert.match(source, /<CtaGradientLink\s+href=\{routes\.checkout\}>/u);
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

  assert.match(
    source,
    /const\s+deliveryProviderName\s*=\s*calculation\?\.delivery\.provider\s*===\s*"cdek"\s*\?\s*"СДЭК"\s*:\s*calculation\?\.delivery\.provider\s*===\s*"ozon"\s*\?\s*"Ozon"\s*:\s*undefined\s*;/u,
  );
  assert.match(
    source,
    /<p\b[^>]*className="font-medium"[^>]*>\s*\{\s*deliveryProviderName\s*\?\s*`\$\{deliveryProviderName\},\s*пункт\s+выдачи`\s*:\s*hasDelivery\s*\?\s*"Пункт выбран"\s*:\s*"Доставка не выбрана"\s*\}\s*<\/p>/u,
  );
});
