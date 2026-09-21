import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadModule(name, mocks = {}) {
  const source = await readFile(
    new URL(`../src/features/checkout/lib/${name}.ts`, import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (specifier) => (Object.hasOwn(mocks, specifier) ? mocks[specifier] : require(specifier)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

test("spending form accepts whole points only within the server limit", async () => {
  const { createLoyaltyFormSchema } = await loadModule("loyalty-form");
  const schema = createLoyaltyFormSchema(100);
  for (const points of [0, 1, 25, 100]) assert.equal(schema.safeParse({ points }).success, true);
  for (const points of [-1, 0.5, 101, NaN, Infinity, "25", undefined]) {
    assert.equal(schema.safeParse({ points }).success, false);
  }
  assert.equal(createLoyaltyFormSchema(0).safeParse({ points: 1 }).success, false);
});

test("checkout attempt keeps retries stable and renews identity for points or pricing changes", async () => {
  const { createCheckoutOrderAttempt } = await loadModule("checkout-form");
  const values = {
    acceptedLegal: true,
    acceptedPersonalDataConsent: true,
    comment: "",
    email: "buyer@example.com",
    name: "Иван",
    paymentMethod: "tbank_acquiring",
    phone: "+7 (999) 123-45-67",
  };
  const delivery = { provider: "ozon", pickupPointId: "point-1" };
  const loyalty = { pointsToSpend: 5, pricingRevision: "a".repeat(64) };
  const first = createCheckoutOrderAttempt(values, delivery, "SALE", undefined, loyalty);
  assert.equal(first.input.loyaltyPointsToSpend, 5);
  assert.equal(first.input.loyaltyPricingRevision, loyalty.pricingRevision);
  const retry = createCheckoutOrderAttempt(values, delivery, "SALE", first.attempt, loyalty);
  assert.equal(retry.attempt, first.attempt);
  assert.deepEqual(retry.input, first.input);

  for (const changed of [
    { ...loyalty, pointsToSpend: 6 },
    { ...loyalty, pricingRevision: "b".repeat(64) },
    { ...loyalty, pointsToSpend: 0 },
  ]) {
    const next = createCheckoutOrderAttempt(values, delivery, "SALE", first.attempt, changed);
    assert.notEqual(next.attempt.id, first.attempt.id);
    assert.notEqual(next.attempt.payloadSignature, first.attempt.payloadSignature);
  }
  const zero = createCheckoutOrderAttempt(values, delivery, undefined, undefined, {
    pointsToSpend: 0,
    pricingRevision: loyalty.pricingRevision,
  });
  assert.equal(Object.hasOwn(zero.input, "loyaltyPointsToSpend"), false);
  assert.equal(Object.hasOwn(zero.input, "loyaltyPricingRevision"), false);
  const noPoints = createCheckoutOrderAttempt(values, delivery, undefined, zero.attempt);
  assert.equal(noPoints.attempt, zero.attempt);
});

test("loyalty selection resets for account, cart, cart content or promo changes and cannot revive old spending", async () => {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    useCallback: (callback) => callback,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (next) => {
          slots[index] = next;
        },
      ];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!slots[index] || dependencies.some((value, offset) => value !== slots[index][offset])) {
        effects.push(effect);
        slots[index] = dependencies;
      }
    },
  };
  const { useLoyaltySelection: readSelection } = await loadModule("use-loyalty-selection", {
    react,
  });
  const render = (identity) => {
    cursor = 0;
    effects = [];
    const result = readSelection(JSON.stringify(identity));
    for (const effect of effects) effect();
    return result;
  };
  const base = ["user-1", "cart-1", "cart-signature", null];
  for (const identity of [
    ["guest", "cart-1", "cart-signature", null],
    ["user-2", "cart-1", "cart-signature", null],
    ["user-1", "cart-2", "cart-signature", null],
    ["user-1", "cart-1", "changed-cart", null],
    ["user-1", "cart-1", "cart-signature", "SALE"],
  ]) {
    render(base).setPoints(25);
    assert.equal(render(base).pointsToSpend, 25);
    assert.equal(render(identity).pointsToSpend, 0);
    assert.equal(render(identity).pointsToSpend, 0);
    assert.equal(render(base).pointsToSpend, 0);
  }
  render(base).setPoints(5);
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    render(base).setPoints(invalid);
    assert.equal(render(base).pointsToSpend, 5);
  }
  render(base).setPoints(0);
  assert.equal(render(base).pointsToSpend, 0);
});
