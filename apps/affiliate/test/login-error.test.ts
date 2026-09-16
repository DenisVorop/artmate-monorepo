import assert from "node:assert/strict";
import test from "node:test";

import { getAuthErrorMessage } from "../src/features/auth/lib/login-form.ts";

test("maps serialized invalid credentials status to a useful message", () => {
  assert.equal(getAuthErrorMessage(401), "Неверный email или пароль.");
});

test("maps rate limiting and infrastructure failures without exposing API messages", () => {
  assert.equal(
    getAuthErrorMessage(429),
    "Слишком много попыток. Попробуйте немного позже.",
  );
  assert.equal(
    getAuthErrorMessage(503),
    "Не удалось войти. Проверьте соединение и попробуйте ещё раз.",
  );
});
