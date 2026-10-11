import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("cart links directly to checkout", async () => {
  const source = await readSource("src/features/cart/ui/cart-summary.tsx");
  assert.match(source, /<CtaGradientLink\s+href=\{routes\.checkout\}>/u);
});

test("checkout offers both declared delivery companies", async () => {
  const [options, field] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-selector/delivery-options.ts"),
    readSource("src/features/checkout/ui/delivery-method-field.tsx"),
  ]);

  assert.deepEqual(
    [...options.matchAll(/code: "(ozon|cdek)"/gu)].map((match) => match[1]),
    ["ozon", "cdek"],
  );
  assert.match(options, /label: "СДЭК"/);
  assert.match(options, /code: "ozon"/);
  assert.match(options, /label: "Ozon"/);
  assert.match(field, /RadioGroup/u);
  assert.match(field, /RadioGroupItem/u);
  assert.doesNotMatch(field, /Card/u);
  assert.doesNotMatch(field, /Выбрать ПВЗ|Изменить ПВЗ/u);
});

test("checkout shows the CDEK starting price and the server-owned Ozon minimum", async () => {
  const [field, cartTypes] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-method-field.tsx"),
    readSource("src/shared/actions/cart/cart.types.ts"),
  ]);

  assert.match(field, /company\.code\s*===\s*"cdek"\s*\?\s*"Доставка от 150 ₽"/u);
  assert.match(field, /minimumDeliveryPrices\.ozon/u);
  assert.doesNotMatch(field, /Доставка от 100|formatMoney\(100\)/u);
  assert.doesNotMatch(cartTypes, /minimumDeliveryPrices\s*:\s*\{[^}]*cdek\s*:/su);
});

test("checkout payment methods show bank logos and supported payment badges", async () => {
  const source = await readSource("src/features/checkout/ui/payment-method-field.tsx");
  assert.match(source, /RadioGroupItem/u);
  assert.match(source, /<PaymentLogo brand=\{option\.bankBrand\}/u);
  assert.match(source, /brands: \["mir", "sbp", "dolyame"\]/u);
  assert.match(source, /brands: \["mir", "sbp"\]/u);
  assert.match(source, /"tbank_acquiring"/u);
  assert.match(source, /"ozon_acquiring"/u);
});

test("order summary identifies the confirmed provider next to the pickup address", async () => {
  const source = await readSource("src/features/checkout/ui/order-summary.tsx");
  assert.match(source, /calculation\.delivery\.provider === "cdek" \? "СДЭК" : "Ozon"/u);
  assert.match(source, /calculation\.delivery\.pickupPoint\.address/u);
  assert.match(source, /calculation\?\.delivery\.pickupPoint/u);
});
