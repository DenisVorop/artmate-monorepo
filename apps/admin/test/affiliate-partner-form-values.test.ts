import assert from "node:assert/strict";
import test from "node:test";

import {
  affiliatePartnerFormSchema,
  getAffiliatePartnerFormValues,
  getAffiliatePartnerInput,
  getTodayDateInputValue,
  parseRublesToKopecks,
} from "../src/features/partners-management/lib/form-values.ts";

const validValues = {
  contractNumber: " AM-42 ",
  paymentDetails: " ИП Иванов\nСчёт 123 ",
  partnerApplicationId: "application-id",
  signedAt: "2026-09-16",
  status: "active" as const,
  userId: "user-id",
};

test("rubles parser converts comma and dot decimals without floating point", () => {
  assert.equal(parseRublesToKopecks(" 1234,56 "), 123456);
  assert.equal(parseRublesToKopecks("0.01"), 1);
  assert.equal(parseRublesToKopecks("90071992547409.91"), 9007199254740991);
});

test("rubles parser maps blank input to null and rejects invalid amounts", () => {
  assert.equal(parseRublesToKopecks("   "), null);
  assert.equal(parseRublesToKopecks("0"), undefined);
  assert.equal(parseRublesToKopecks("1.001"), undefined);
  assert.equal(parseRublesToKopecks("90071992547409.92"), undefined);
  assert.equal(parseRublesToKopecks("-1"), undefined);
});

test("partner form validates nullable minimum payout and maps a trimmed DTO", () => {
  const values = {
    ...validValues,
    minimumPayoutRubles: " 1500,25 ",
  };

  assert.equal(affiliatePartnerFormSchema.safeParse(values).success, true);
  assert.deepEqual(getAffiliatePartnerInput(values), {
    contract: {
      number: "AM-42",
      paymentDetails: "ИП Иванов\nСчёт 123",
      signedAt: "2026-09-16T00:00:00.000Z",
    },
    minimumPayoutKopecks: 150025,
    partnerApplicationId: "application-id",
    status: "active",
  });

  assert.equal(
    affiliatePartnerFormSchema.safeParse({
      ...values,
      minimumPayoutRubles: " ",
    }).success,
    true,
  );
  assert.equal(
    getAffiliatePartnerInput({ ...values, minimumPayoutRubles: " " })
      .minimumPayoutKopecks,
    null,
  );
});

test("partner form rejects incomplete contract and malformed payout", () => {
  assert.equal(
    affiliatePartnerFormSchema.safeParse({
      ...validValues,
      minimumPayoutRubles: "10.999",
    }).success,
    false,
  );
  assert.equal(
    affiliatePartnerFormSchema.safeParse({
      ...validValues,
      contractNumber: "A".repeat(121),
      minimumPayoutRubles: "10",
    }).success,
    false,
  );
  assert.equal(
    affiliatePartnerFormSchema.safeParse({
      ...validValues,
      contractNumber: " ",
      minimumPayoutRubles: "10",
    }).success,
    false,
  );
});

test("new partner requires an existing user selection", () => {
  assert.equal(
    affiliatePartnerFormSchema.safeParse({
      ...validValues,
      minimumPayoutRubles: "10",
      userId: "",
    }).success,
    false,
  );
});

test("contract date must be a real calendar date that is not in the future", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const futureDate = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-");

  assert.equal(
    affiliatePartnerFormSchema.safeParse({
      ...validValues,
      minimumPayoutRubles: "10",
      signedAt: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    affiliatePartnerFormSchema.safeParse({
      ...validValues,
      minimumPayoutRubles: "10",
      signedAt: futureDate,
    }).success,
    false,
  );
});

test("contract date boundary follows the Moscow calendar", () => {
  assert.equal(
    getTodayDateInputValue(new Date("2026-09-16T21:30:00.000Z")),
    "2026-09-17",
  );
});

test("mapper preserves the current application while selector data is unavailable", () => {
  const input = getAffiliatePartnerInput(
    {
      ...validValues,
      minimumPayoutRubles: "10",
      partnerApplicationId: "",
    },
    { partnerApplicationIdOverride: "existing-application" },
  );

  assert.equal(input.partnerApplicationId, "existing-application");
});

test("mapper preserves the original signedAt timestamp when the date is unchanged", () => {
  const originalSignedAt = "2026-09-16T14:25:36.789Z";

  assert.equal(
    getAffiliatePartnerInput(
      { ...validValues, minimumPayoutRubles: "10" },
      { originalSignedAt },
    ).contract.signedAt,
    originalSignedAt,
  );
  assert.equal(
    getAffiliatePartnerInput(
      {
        ...validValues,
        minimumPayoutRubles: "10",
        signedAt: "2026-09-15",
      },
      { originalSignedAt },
    ).contract.signedAt,
    "2026-09-15T00:00:00.000Z",
  );
});

test("DTO to form mapper stays outside UI and keeps calendar form values", () => {
  assert.deepEqual(
    getAffiliatePartnerFormValues({
      id: "partner-id",
      userId: "user-id",
      userName: "Иван",
      userEmail: "ivan@example.com",
      status: "suspended",
      partnerApplicationId: "application-id",
      minimumPayoutKopecks: 500_001,
      effectiveMinimumPayoutKopecks: 500_001,
      contractVersion: 2,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
      contract: {
        number: "AM-42",
        signedAt: "2026-09-10T14:25:36.789Z",
        paymentDetails: "Реквизиты",
      },
    }),
    {
      contractNumber: "AM-42",
      minimumPayoutRubles: "5000,01",
      partnerApplicationId: "application-id",
      paymentDetails: "Реквизиты",
      signedAt: "2026-09-10",
      status: "suspended",
      userId: "user-id",
    },
  );
});
