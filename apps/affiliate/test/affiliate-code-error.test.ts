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
