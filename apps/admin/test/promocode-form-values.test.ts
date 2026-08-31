import assert from "node:assert/strict";
import test from "node:test";

import {
  getCreatePromoCodeInput,
  getTogglePromoCodeInput,
  getUpdatePromoCodeInput,
  moscowDateTimeToUtc,
  normalizePromoCode,
  parseDecimalToInteger,
  promoCodeFormSchema,
  utcToMoscowDateTime,
  type PromoCodeFormValues,
} from "../src/features/promocodes-management/lib/form-values.ts";
import {
  getReleasePromoCodeInput,
  releasePromoCodeFormSchema,
} from "../src/features/promocodes-management/lib/release-form-values.ts";

const validValues: PromoCodeFormValues = {
  amount: "10.01",
  code: " summer_10 ",
  description: " ",
  endsAt: "2026-09-01T00:00",
  isActive: true,
  maxDiscount: "1500.45",
  maxUses: "100",
  maxUsesPerUser: "1",
  minSubtotal: "0",
  name: " Летняя скидка ",
  startsAt: "2026-08-31T12:30",
  type: "percentage",
};

test("decimal inputs convert exactly to basis points and kopecks", () => {
  assert.equal(parseDecimalToInteger("10.01", 2), 1001);
  assert.equal(parseDecimalToInteger("0,29", 2), 29);
  assert.equal(parseDecimalToInteger("1234.56", 2), 123456);
  assert.equal(parseDecimalToInteger("1.001", 2), null);
});

test("percentage mapper normalizes code, nulls empty fields and converts Moscow dates", () => {
  assert.deepEqual(getCreatePromoCodeInput(validValues), {
    amountKopecks: null,
    basisPoints: 1001,
    code: "SUMMER_10",
    description: null,
    endsAt: "2026-08-31T21:00:00.000Z",
    isActive: true,
    maxDiscountKopecks: 150045,
    maxUses: 100,
    maxUsesPerUser: 1,
    minSubtotalKopecks: 0,
    name: "Летняя скидка",
    startsAt: "2026-08-31T09:30:00.000Z",
    type: "percentage",
  });
});

test("fixed mapper always removes percentage cap", () => {
  const result = getCreatePromoCodeInput({
    ...validValues,
    amount: "499.99",
    maxDiscount: "100",
    type: "fixed",
  });

  assert.equal(result.amountKopecks, 49999);
  assert.equal(result.basisPoints, null);
  assert.equal(result.maxDiscountKopecks, null);
});

test("validation accepts zero minimum subtotal but rejects zero discount and limits", () => {
  assert.equal(promoCodeFormSchema.safeParse(validValues).success, true);
  assert.equal(
    promoCodeFormSchema.safeParse({ ...validValues, amount: "0" }).success,
    false,
  );
  assert.equal(
    promoCodeFormSchema.safeParse({ ...validValues, maxUses: "0" }).success,
    false,
  );
});

test("validation limits percentages and requires an exclusive end after start", () => {
  assert.equal(
    promoCodeFormSchema.safeParse({ ...validValues, amount: "100.01" }).success,
    false,
  );
  assert.equal(
    promoCodeFormSchema.safeParse({
      ...validValues,
      endsAt: validValues.startsAt,
    }).success,
    false,
  );
});

test("Moscow local values round-trip through UTC without host timezone dependence", () => {
  const utc = moscowDateTimeToUtc("2026-12-15T08:05");

  assert.equal(utc, "2026-12-15T05:05:00.000Z");
  assert.equal(utcToMoscowDateTime(utc), "2026-12-15T08:05:00.000");
  assert.equal(moscowDateTimeToUtc("2026-02-30T10:00"), null);
});

test("unchanged date fields preserve original seconds, milliseconds and ISO representation", () => {
  const promoCode = {
    ...getCreatePromoCodeInput(validValues),
    createdAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-08-31T21:00:59.999Z",
    id: "promo-with-precise-dates",
    reservedCount: 0,
    startsAt: "2026-08-31T09:30:59.999+00:00",
    updatedAt: "2026-08-01T00:00:00.000Z",
    usedCount: 0,
  };
  const values = {
    ...validValues,
    endsAt: utcToMoscowDateTime(promoCode.endsAt),
    startsAt: utcToMoscowDateTime(promoCode.startsAt),
  };
  const input = getUpdatePromoCodeInput(values, promoCode);

  assert.equal(values.endsAt, "2026-09-01T00:00:59.999");
  assert.equal(input.endsAt, "2026-08-31T21:00:59.999Z");
  assert.equal(input.startsAt, "2026-08-31T09:30:59.999+00:00");
});

test("edited date fields retain millisecond precision when converted to UTC", () => {
  assert.equal(
    moscowDateTimeToUtc("2026-09-01T00:00:59.999"),
    "2026-08-31T21:00:59.999Z",
  );
});

test("promo code normalization uppercases ASCII lowercase only", () => {
  assert.equal(normalizePromoCode(" save_10 "), "SAVE_10");
  assert.equal(normalizePromoCode("ſAVE"), "ſAVE");
  assert.equal(normalizePromoCode("ßA"), "ßA");
  assert.equal(
    promoCodeFormSchema.safeParse({ ...validValues, code: "ſAVE" }).success,
    false,
  );
  assert.equal(
    promoCodeFormSchema.safeParse({ ...validValues, code: "ßA" }).success,
    false,
  );
});

test("name and usage limits match API and PostgreSQL boundaries", () => {
  assert.equal(
    promoCodeFormSchema.safeParse({
      ...validValues,
      maxUses: "2147483647",
      maxUsesPerUser: "2147483647",
      name: "x".repeat(160),
    }).success,
    true,
  );
  assert.equal(
    promoCodeFormSchema.safeParse({ ...validValues, maxUses: "2147483648" })
      .success,
    false,
  );
  assert.equal(
    promoCodeFormSchema.safeParse({ ...validValues, name: "x".repeat(161) })
      .success,
    false,
  );
  assert.equal(
    promoCodeFormSchema.safeParse({ ...validValues, maxDiscount: "0" }).success,
    false,
  );
});

test("release form requires explicit confirmation and a trimmed reason", () => {
  assert.equal(
    releasePromoCodeFormSchema.safeParse({
      confirmed: false,
      reason: "Достаточная причина",
    }).success,
    false,
  );
  assert.equal(
    releasePromoCodeFormSchema.safeParse({ confirmed: true, reason: "коротко" })
      .success,
    false,
  );
  assert.deepEqual(
    getReleasePromoCodeInput({
      confirmed: true,
      reason: "  Оплата закрыта провайдером без списания  ",
    }),
    {
      confirmation: "payment_closed_without_charge",
      reason: "Оплата закрыта провайдером без списания",
    },
  );
});

test("toggle mapper sends the full editable payload and preserves nullable settings", () => {
  const input = getTogglePromoCodeInput(
    {
      ...getCreatePromoCodeInput(validValues),
      createdAt: "2026-08-01T00:00:00.000Z",
      id: "promo-id",
      reservedCount: 2,
      updatedAt: "2026-08-01T00:00:00.000Z",
      usedCount: 4,
    },
    false,
  );

  assert.equal(input.isActive, false);
  assert.equal(input.basisPoints, 1001);
  assert.equal(input.amountKopecks, null);
  assert.equal(input.description, null);
  assert.equal("code" in input, false);
  assert.equal(Object.keys(input).length, 12);
});
