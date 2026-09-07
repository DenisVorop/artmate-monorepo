import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadCalculationState() {
  const [source, deliveryStateSource] = await Promise.all([
    readFile(new URL("../src/features/checkout/lib/calculation-state.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/checkout/lib/delivery-picker-state.ts", import.meta.url),
      "utf8",
    ),
  ]);
  const deliveryStateOutput = ts.transpileModule(deliveryStateSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const deliveryStateModule = { exports: {} };
  new Function("require", "module", "exports", deliveryStateOutput)(
    (specifier) => {
      throw new Error(`Unexpected test module import: ${specifier}`);
    },
    deliveryStateModule,
    deliveryStateModule.exports,
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };

  new Function("require", "module", "exports", output)(
    (specifier) => {
      if (specifier === "./delivery-picker-state") return deliveryStateModule.exports;
      throw new Error(`Unexpected test module import: ${specifier}`);
    },
    loadedModule,
    loadedModule.exports,
  );

  return loadedModule.exports;
}

const delivery = { pickupPointId: "point-1", provider: "ozon" };
const calculation = {
  cartId: "cart-1",
  currency: "RUB",
  delivery: {
    pickupPoint: {
      address: "Москва, ул. Тестовая, 1",
      deliveryPrice: 200,
      id: "point-1",
      latitude: 55.75,
      longitude: 37.61,
      title: "ПВЗ",
      workHours: "09:00-21:00",
    },
    provider: "ozon",
  },
  deliveryPrice: 200,
  discount: 0,
  itemsCount: 1,
  promoCode: null,
  subtotal: 1_000,
  total: 1_200,
};
const retry = () => undefined;

function signals(overrides = {}) {
  return {
    calculation,
    cartId: "cart-1",
    confirmedDelivery: delivery,
    error: null,
    isError: false,
    isOffline: false,
    isPending: false,
    retry,
    ...overrides,
  };
}

test("calculation resolver returns each of the five discriminated states", async () => {
  const { resolveCheckoutCalculationState } = await loadCalculationState();
  const error = new Error("Calculation failed");

  assert.deepEqual(
    resolveCheckoutCalculationState(signals({ confirmedDelivery: undefined })),
    { status: "idle" },
  );
  assert.deepEqual(resolveCheckoutCalculationState(signals({ isOffline: true })), {
    retry,
    status: "offline",
  });
  assert.deepEqual(resolveCheckoutCalculationState(signals({ error, isError: true })), {
    error,
    retry,
    status: "error",
  });
  assert.deepEqual(resolveCheckoutCalculationState(signals({ isPending: true })), {
    status: "pending",
  });
  assert.deepEqual(resolveCheckoutCalculationState(signals()), {
    calculation,
    status: "ready",
  });
});

test("calculation resolver enforces idle, offline, error, pending, ready priority", async () => {
  const { resolveCheckoutCalculationState } = await loadCalculationState();
  const error = new Error("Calculation failed");
  const impossible = signals({ error, isError: true, isOffline: true, isPending: true });

  assert.equal(
    resolveCheckoutCalculationState({ ...impossible, confirmedDelivery: undefined }).status,
    "idle",
  );
  assert.equal(resolveCheckoutCalculationState(impossible).status, "offline");
  assert.equal(
    resolveCheckoutCalculationState({ ...impossible, isOffline: false }).status,
    "error",
  );
  assert.equal(
    resolveCheckoutCalculationState({
      ...impossible,
      isError: false,
      isOffline: false,
    }).status,
    "pending",
  );
  assert.equal(
    resolveCheckoutCalculationState({
      ...impossible,
      isError: false,
      isOffline: false,
      isPending: false,
    }).status,
    "ready",
  );
});

test("confirmed delivery exposes a retryable error for missing, malformed, or stale calculations", async () => {
  const { resolveCheckoutCalculationState } = await loadCalculationState();

  for (const invalidCalculation of [
    undefined,
    { ...calculation, cartId: "cart-2" },
    {
      ...calculation,
      delivery: {
        ...calculation.delivery,
        pickupPoint: { ...calculation.delivery.pickupPoint, id: "point-2" },
      },
    },
    { cartId: "cart-1", delivery: calculation.delivery },
  ]) {
    const state = resolveCheckoutCalculationState(signals({ calculation: invalidCalculation }));

    assert.equal(state.status, "error");
    assert.equal(state.error.message, "Не удалось получить актуальный расчет заказа");
    assert.equal(state.retry, retry);
  }
});

test("submit label is exhaustive and says calculating only for pending", async () => {
  const { getCheckoutSubmitLabel } = await loadCalculationState();
  const error = new Error("Calculation failed");
  const states = [
    [{ status: "idle" }, "Выберите ПВЗ"],
    [{ status: "pending" }, "Считаем доставку"],
    [{ retry, status: "offline" }, "Нет сети"],
    [{ error, retry, status: "error" }, "Расчет недоступен"],
    [{ calculation, status: "ready" }, "Перейти к оплате"],
  ];

  for (const [state, label] of states) {
    assert.equal(getCheckoutSubmitLabel(state, false), label);
  }
  assert.equal(getCheckoutSubmitLabel({ status: "pending" }, true), "Отправляем заказ");
});

test("checkout context exposes the discriminated state instead of independent flags", async () => {
  const context = await readFile(
    new URL("../src/features/checkout/lib/checkout-provider/checkout.context.tsx", import.meta.url),
    "utf8",
  );

  assert.match(context, /checkoutCalculation: CheckoutCalculationState/u);
  assert.doesNotMatch(context, /\bisPending:|\bisError:|\bisPaused:|\berror:|\bcalculation\?:/u);
});
