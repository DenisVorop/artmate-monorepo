import assert from "node:assert/strict";
import test from "node:test";

import { getAffiliateCodeErrorMessage } from "../src/features/affiliate-codes/lib/error-message.ts";

test("explains a global duplicate inline", () => {
  assert.equal(
    getAffiliateCodeErrorMessage(409),
    "Такой промокод уже существует. Попробуйте другой.",
  );
});

test("uses a safe retry message for unavailable API", () => {
  assert.equal(
    getAffiliateCodeErrorMessage(503),
    "Не удалось сохранить промокод. Попробуйте ещё раз.",
  );
});

test("explains a stale create race when the server reports the code limit", () => {
  assert.equal(
    getAffiliateCodeErrorMessage(409, "affiliate_code_limit"),
    "У вас уже максимальное количество промокодов. Новый код создать нельзя.",
  );
});

test("does not expose unknown error codes or change an ordinary duplicate", () => {
  assert.equal(
    getAffiliateCodeErrorMessage(500, "untrusted_backend_detail"),
    "Не удалось сохранить промокод. Попробуйте ещё раз.",
  );
  assert.equal(
    getAffiliateCodeErrorMessage(409, "unknown_conflict"),
    "Такой промокод уже существует. Попробуйте другой.",
  );
});
