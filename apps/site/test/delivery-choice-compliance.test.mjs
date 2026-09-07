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
  const [options, field] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-selector/delivery-options.ts"),
    readSource("src/features/checkout/ui/delivery-method-field.tsx"),
  ]);

  assert.match(options, /code: "cdek"/);
  assert.match(options, /label: "СДЭК"/);
  assert.match(options, /code: "ozon"/);
  assert.match(options, /label: "Ozon"/);
  assert.match(field, /RadioGroup/u);
  assert.match(field, /RadioGroupItem/u);
  assert.doesNotMatch(field, /Card/u);
  assert.match(field, /Изменить ПВЗ/u);
});

test("checkout keeps CDEK neutral until calculation and shows the server-owned Ozon minimum", async () => {
  const [field, cartTypes] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-method-field.tsx"),
    readSource("src/shared/actions/cart/cart.types.ts"),
  ]);

  assert.match(field, /company\.code\s*===\s*"cdek"\s*\?\s*"Рассчитать"/u);
  assert.match(field, /minimumDeliveryPrices\.ozon/u);
  assert.doesNotMatch(field, /Доставка от 100|formatMoney\(100\)/u);
  assert.doesNotMatch(cartTypes, /minimumDeliveryPrices\s*:\s*\{[^}]*cdek\s*:/su);
});

test("checkout payment methods are flat radio rows with card and SBP badges", async () => {
  const source = await readSource("src/features/checkout/ui/payment-method-field.tsx");

  assert.match(source, /RadioGroup/u);
  assert.match(source, /RadioGroupItem/u);
  assert.doesNotMatch(source, /<Card|\bCard,/u);
  assert.match(source, /T-Bank/u);
  assert.match(source, /Ozon Pay/u);
  assert.equal(source.match(/"Карта"/gu)?.length, 2);
  assert.equal(source.match(/"СБП"/gu)?.length, 2);
  assert.equal(source.match(/защищ[её]нную страницу/giu)?.length, 2);
  assert.doesNotMatch(source, /Оплата картой на платежной форме/u);
  assert.match(source, /"tbank_acquiring"/u);
  assert.match(source, /"ozon_acquiring"/u);
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
