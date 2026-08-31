import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const managementSource = readFileSync(
  new URL(
    "../src/features/promocodes-management/ui/promo-codes-management.tsx",
    import.meta.url,
  ),
  "utf8",
);
const detailsSource = readFileSync(
  new URL(
    "../src/features/promocodes-management/ui/promo-code-details.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("welcome promo is identified in both list and details", () => {
  assert.match(managementSource, /promoCode\.kind === "welcome"/);
  assert.match(managementSource, /Приветственный/);
  assert.match(detailsSource, /promoCode\.kind === "welcome"/);
  assert.match(detailsSource, /Приветственный/);
});
