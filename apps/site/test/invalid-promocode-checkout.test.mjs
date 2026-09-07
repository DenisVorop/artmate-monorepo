import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

globalThis.window = {
  requestAnimationFrame: (callback) => callback(),
  scrollTo: () => undefined,
};

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    return require(specifier);
  };

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

async function loadPromoPricingState() {
  return evaluateTypeScript(await readSource("src/features/promocode/lib/promo-pricing-state.ts"), {
    "@/entities/promocode": {},
  }).getPromoPricingState;
}

function findNode(node, predicate) {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if (predicate(node)) {
    return node;
  }

  const children = Array.isArray(node) ? node : node.props?.children;

  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findNode(child, predicate);

    if (match) {
      return match;
    }
  }

  return undefined;
}

function renderedText(node) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  const children = Array.isArray(node) ? node : node.props?.children;

  return (Array.isArray(children) ? children : [children]).map(renderedText).join("");
}

async function renderCartSummary(promoState) {
  const getPromoPricingState = await loadPromoPricingState();
  const jsx = (type, props, key) => ({ key, props, type });
  const component = (name) => name;
  const { CartSummary } = evaluateTypeScript(
    await readSource("src/features/cart/ui/cart-summary.tsx"),
    {
      "../lib/cart-format": { formatMoney: (value) => `${value} RUB` },
      "@/features/promocode": {
        getPromoPricingState,
        PromoCodeForm: component("PromoCodeForm"),
        usePromocode: () => promoState,
      },
      "@/shared/constants": { routes: { catalog: "/catalog", checkout: "/checkout" } },
      "@/shared/lib": { cn: (...classes) => classes.filter(Boolean).join(" ") },
      "@/shared/ui": {
        Button: component("Button"),
        Card: component("Card"),
        CardContent: component("CardContent"),
        CardDescription: component("CardDescription"),
        CardFooter: component("CardFooter"),
        CardHeader: component("CardHeader"),
        CardTitle: component("CardTitle"),
        CtaGradientLink: component("CtaGradientLink"),
        Separator: component("Separator"),
      },
      "@/shared/ui/link": { Link: component("Link") },
      "lucide-react": {
        CreditCard: component("CreditCard"),
        LoaderCircle: component("LoaderCircle"),
        ShoppingBag: component("ShoppingBag"),
      },
      "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
    },
  );

  return CartSummary({
    isClearingCart: false,
    isMutating: false,
    itemsLabel: "1 товар",
    onClear: () => undefined,
    subtotal: 1_000,
  });
}

function createReactHarness() {
  const state = [];
  let cursor = 0;

  return {
    beginRender() {
      cursor = 0;
    },
    react: {
      useCallback: (callback) => callback,
      useEffect: (effect) => effect(),
      useMemo: (factory) => factory(),
      useRef(initialValue) {
        const index = cursor++;

        if (!(index in state)) {
          state[index] = { current: initialValue };
        }

        return state[index];
      },
      useState(initialValue) {
        const index = cursor++;

        if (!(index in state)) {
          state[index] = typeof initialValue === "function" ? initialValue() : initialValue;
        }

        return [
          state[index],
          (value) => {
            state[index] = typeof value === "function" ? value(state[index]) : value;
          },
        ];
      },
    },
  };
}

const validFormValues = {
  acceptedLegal: true,
  acceptedPersonalDataConsent: true,
  comment: "",
  email: "buyer@example.com",
  name: "Иван",
  paymentMethod: "ozon_acquiring",
  phone: "+7 (999) 123-45-67",
};

async function createCheckoutHarness({ calculationState, persistedDelivery, promoState }) {
  const getPromoPricingState = await loadPromoPricingState();
  const checkoutForm = evaluateTypeScript(
    await readSource("src/features/checkout/lib/checkout-form.ts"),
    { zod: require("zod") },
  );
  const reactHarness = createReactHarness();
  const checkoutCalculationState = evaluateTypeScript(
    await readSource("src/features/checkout/lib/calculation-state.ts"),
    {
      "./delivery-picker-state": {
        isMatchingCheckoutCalculation: (value, candidate, cartId) =>
          value?.cartId === cartId &&
          value?.delivery?.provider === candidate.provider &&
          value?.delivery?.pickupPoint?.id === candidate.pickupPointId,
      },
    },
  );
  const calculationCalls = [];
  const submitted = [];
  const submitVariables = [];
  let formValues = validFormValues;
  const form = {
    formState: { isDirty: false },
    handleSubmit: (submit) => (event) => submit(formValues, event),
    reset: () => undefined,
    trigger: async () => true,
  };
  const jsx = (type, props, key) => ({ key, props, type });
  const { CheckoutProvider } = evaluateTypeScript(
    await readSource("src/features/checkout/lib/checkout-provider/checkout-provider.tsx"),
    {
      "../../model": {
        checkoutCalculationQueryKey: (candidate, identity) => [candidate, identity],
        checkoutCalculationQueryOptions: (candidate, identity) => ({
          queryKey: [candidate, identity],
        }),
        useCheckoutCalculation: (delivery, identity) => {
          calculationCalls.push({ delivery, identity });
          return calculationState;
        },
      },
      "../checkout-form": checkoutForm,
      "../calculation-state": checkoutCalculationState,
      "../delivery-picker-state": {
        createDeliveryConfirmationCoordinator: () => {
          let token = 0;

          return {
            confirm: async ({ calculate, candidate, cartId, commit }) => {
              const ownToken = ++token;
              const calculation = await calculate();

              if (ownToken !== token) return { status: "stale" };
              if (
                calculation?.cartId !== cartId ||
                calculation?.delivery?.provider !== candidate.provider ||
                calculation?.delivery?.pickupPoint?.id !== candidate.pickupPointId
              ) {
                return { status: "error", message: "mismatch" };
              }

              commit({ calculation, candidate });
              return { status: "confirmed", calculation };
            },
            invalidate: () => {
              token += 1;
            },
          };
        },
        isMatchingCheckoutCalculation: (calculation, candidate, cartId) =>
          calculation?.cartId === cartId &&
          calculation?.delivery?.provider === candidate.provider &&
          calculation?.delivery?.pickupPoint?.id === candidate.pickupPointId,
      },
      "../pickup-selection-storage": {
        clearPersistedPickupSelection: () => undefined,
        readPersistedPickupSelection: () => persistedDelivery,
        writePersistedPickupSelection: () => undefined,
      },
      "./checkout.context": {
        CheckoutContext: { Provider: "CheckoutContextProvider" },
      },
      "@/entities/cart": {},
      "@/entities/session": { useUser: () => ({ id: "user-1" }) },
      "@/features/promocode": {
        getCartPricingSignature: () => "cart-signature",
        getPromoPricingState,
        usePromocode: () => promoState,
      },
      "@hookform/resolvers/zod": { zodResolver: (schema) => schema },
      "@tanstack/react-query": {
        useQueryClient: () => ({
          fetchQuery: async () => calculationState.calculation,
          setQueryData: () => undefined,
        }),
      },
      react: reactHarness.react,
      "react-hook-form": {
        FormProvider: "FormProvider",
        useForm: () => form,
      },
      "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
    },
  );
  const props = {
    cart: {
      id: "cart-1",
      isOzonDeliveryAvailable: true,
      items: [{ id: "item-1", price: 1_000, quantity: 1 }],
    },
    children: "checkout",
    isSubmitting: false,
    onSubmit: async (variables) => {
      const { input } = variables;
      submitVariables.push(variables);
      submitted.push(input);
    },
  };
  const render = () => {
    reactHarness.beginRender();
    return CheckoutProvider(props).props.value;
  };

  return {
    calculationCalls,
    render,
    setFormValues: (values) => {
      formValues = values;
    },
    submitted,
    submitVariables,
  };
}

const delivery = { pickupPointId: "point-1", provider: "ozon" };
const readyCalculation = {
  calculation: {
    cartId: "cart-1",
    delivery: { pickupPoint: { id: "point-1" }, provider: "ozon" },
    deliveryPrice: 200,
    discount: 0,
    subtotal: 1_000,
    total: 1_200,
  },
  error: null,
  isError: false,
  isPaused: false,
  isPending: false,
  retry: () => undefined,
};

async function selectDelivery(harness) {
  await harness.render().confirmDelivery(delivery);
  return harness.render();
}

test("rejected promo stays visible but cart uses base total and enables checkout", async () => {
  const tree = await renderCartSummary({
    error: new Error("Промокод истек"),
    isError: true,
    isHydrating: false,
    isPaused: false,
    isPending: false,
    preview: { code: "OLD10", discount: 100, total: 900 },
    selectedCode: "OLD10",
  });
  const text = renderedText(tree);

  assert.ok(findNode(tree, (node) => node.type === "PromoCodeForm"));
  assert.match(text, /1000 RUB/u);
  assert.doesNotMatch(text, /Скидка|900 RUB|Недоступно/u);
  assert.equal(
    findNode(tree, (node) => node.type?.name === "CheckoutButton").props.disabled,
    false,
  );
});

test("valid matching promo keeps its discount while stale and unresolved previews stay guarded", async () => {
  const getPromoPricingState = await loadPromoPricingState();
  const preview = { code: "SAVE10", discount: 100, total: 900 };

  assert.deepEqual(
    getPromoPricingState({
      isError: false,
      isHydrating: false,
      isPaused: false,
      isPending: false,
      preview,
      selectedCode: "SAVE10",
    }),
    { code: "SAVE10", isReady: true, preview },
  );

  for (const guardedState of [
    { isHydrating: true, preview },
    { isPending: true, preview },
    { isPaused: true, preview },
    {},
    { preview, selectedCode: "NEW10" },
  ]) {
    const state = getPromoPricingState({
      isError: false,
      isHydrating: false,
      isPaused: false,
      isPending: false,
      selectedCode: "SAVE10",
      ...guardedState,
    });

    assert.deepEqual(state, { code: undefined, isReady: false, preview: undefined });

    const guardedCart = await renderCartSummary({
      isError: false,
      isHydrating: false,
      isPaused: false,
      isPending: false,
      selectedCode: "SAVE10",
      ...guardedState,
    });
    assert.equal(
      findNode(guardedCart, (node) => node.type?.name === "CheckoutButton").props.disabled,
      true,
    );
    assert.doesNotMatch(renderedText(guardedCart), /Скидка|900 RUB/u);
  }

  const tree = await renderCartSummary({
    isError: false,
    isHydrating: false,
    isPaused: false,
    isPending: false,
    preview,
    selectedCode: "SAVE10",
  });
  assert.match(renderedText(tree), /Скидка \(SAVE10\).*100 RUB.*900 RUB/u);
});

test("invalid promo calculates without a code and omits it for both payments", async () => {
  const promoState = {
    error: new Error("Промокод истек"),
    isError: true,
    isHydrating: false,
    isPaused: false,
    isPending: false,
    preview: { code: "OLD10", discount: 100, total: 900 },
    selectedCode: "OLD10",
  };

  for (const paymentMethod of ["ozon_acquiring", "tbank_acquiring"]) {
    const harness = await createCheckoutHarness({ calculationState: readyCalculation, promoState });
    const context = await selectDelivery(harness);
    const latestCall = harness.calculationCalls.at(-1);

    assert.equal(latestCall.identity.enabled, true);
    assert.equal(latestCall.identity.promoCode, undefined);
    harness.setFormValues({ ...validFormValues, paymentMethod });
    context.submitOrder({ preventDefault: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(harness.submitted.length, 1);
    assert.equal(harness.submitted[0].payment.method, paymentMethod);
    assert.equal(harness.submitted[0].promoCode, undefined);
    assert.equal(
      Object.hasOwn(JSON.parse(JSON.stringify(harness.submitted[0])), "promoCode"),
      false,
    );
  }
});

test("valid promo calculation and order use the matching code", async () => {
  const harness = await createCheckoutHarness({
    calculationState: {
      ...readyCalculation,
      calculation: { ...readyCalculation.calculation, discount: 100, total: 1_100 },
    },
    promoState: {
      isError: false,
      isHydrating: false,
      isPaused: false,
      isPending: false,
      preview: { code: "SAVE10", discount: 100, total: 900 },
      selectedCode: "SAVE10",
    },
  });
  const context = await selectDelivery(harness);

  assert.equal(harness.calculationCalls.at(-1).identity.promoCode, "SAVE10");
  context.submitOrder({ preventDefault: () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(harness.submitted[0].promoCode, "SAVE10");
});

test("hydration, pending, paused and unresolved promo disable calculation and submission", async () => {
  const states = [
    { isHydrating: true, selectedCode: "SAVE10" },
    { isPending: true, selectedCode: "SAVE10" },
    { isPaused: true, selectedCode: "SAVE10" },
    { selectedCode: "SAVE10" },
  ];

  for (const state of states) {
    const harness = await createCheckoutHarness({
      calculationState: readyCalculation,
      promoState: {
        error: null,
        isError: false,
        isHydrating: false,
        isPaused: false,
        isPending: false,
        ...state,
      },
    });
    const context = await selectDelivery(harness);

    assert.equal(harness.calculationCalls.at(-1).identity.enabled, false);
    context.submitOrder({ preventDefault: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(harness.submitted.length, 0);
  }
});

test("pending or failed actual checkout calculation still prevents order submission", async () => {
  for (const calculationState of [
    { ...readyCalculation, isPending: true },
    { ...readyCalculation, error: new Error("Delivery failed"), isError: true },
  ]) {
    const harness = await createCheckoutHarness({
      calculationState,
      promoState: {
        error: null,
        isError: false,
        isHydrating: false,
        isPaused: false,
        isPending: false,
      },
    });
    const context = await selectDelivery(harness);

    assert.equal(context.checkoutCalculation.status, calculationState.isPending ? "pending" : "error");
    context.submitOrder({ preventDefault: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(harness.submitted.length, 0);
  }
});

test("checkout submits only a ready calculation matching the confirmed delivery", async () => {
  const promoState = {
    error: null,
    isError: false,
    isHydrating: false,
    isPaused: false,
    isPending: false,
  };

  for (const calculationState of [
    { ...readyCalculation, isPending: true },
    { ...readyCalculation, isPaused: true },
    { ...readyCalculation, error: new Error("Delivery failed"), isError: true },
  ]) {
    const harness = await createCheckoutHarness({ calculationState, promoState });
    const context = await selectDelivery(harness);

    context.submitOrder({ preventDefault: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(harness.submitted.length, 0, context.checkoutCalculation.status);
  }

  const idleHarness = await createCheckoutHarness({
    calculationState: { ...readyCalculation, calculation: undefined },
    promoState,
  });
  idleHarness.render().submitOrder({ preventDefault: () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(idleHarness.submitted.length, 0);

  const mismatchHarness = await createCheckoutHarness({
    calculationState: {
      ...readyCalculation,
      calculation: {
        ...readyCalculation.calculation,
        delivery: {
          ...readyCalculation.calculation.delivery,
          pickupPoint: { id: "point-2" },
        },
      },
    },
    persistedDelivery: delivery,
    promoState,
  });
  mismatchHarness.render();
  const mismatchContext = mismatchHarness.render();
  mismatchContext.submitOrder({ preventDefault: () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(mismatchContext.checkoutCalculation.status, "error");
  assert.equal(
    mismatchContext.checkoutCalculation.error.message,
    "Не удалось получить актуальный расчет заказа",
  );
  assert.equal(mismatchContext.checkoutCalculation.retry, readyCalculation.retry);
  assert.equal(mismatchHarness.submitted.length, 0);

  const readyHarness = await createCheckoutHarness({ calculationState: readyCalculation, promoState });
  const readyContext = await selectDelivery(readyHarness);
  readyContext.submitOrder({ preventDefault: () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(readyContext.checkoutCalculation.status, "ready");
  assert.equal(readyHarness.submitted.length, 1);
  assert.deepEqual(Object.keys(readyHarness.submitVariables[0]), ["input"]);
});

test("unresolved promo cannot reuse a cached base calculation for confirmed delivery", async () => {
  const harness = await createCheckoutHarness({
    calculationState: readyCalculation,
    persistedDelivery: delivery,
    promoState: {
      error: null,
      isError: false,
      isHydrating: false,
      isPaused: false,
      isPending: false,
      retry: readyCalculation.retry,
      selectedCode: "SAVE10",
    },
  });

  harness.render();
  const context = harness.render();
  assert.equal(context.checkoutCalculation.status, "error");
  assert.equal(
    context.checkoutCalculation.error.message,
    "Не удалось получить актуальный расчет заказа",
  );
  assert.equal(context.checkoutCalculation.retry, readyCalculation.retry);
  context.submitOrder({ preventDefault: () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(harness.submitted.length, 0);
});

test("checkout query key and request use the effective promo code identity", async () => {
  const requests = [];
  const { checkoutCalculationQueryOptions } = evaluateTypeScript(
    await readSource("src/features/checkout/model/query.ts"),
    {
      "@/shared/actions/orders": {
        calculateCheckout: async (input) => {
          requests.push(input);
          return { data: readyCalculation.calculation };
        },
      },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
      },
      "@/shared/lib/query-freshness": { getFreshQueryData: (result) => result.data },
      "@/shared/lib/query-keys": { cartPricingQueryKey: ["cart-pricing"] },
      "../lib/delivery-picker-state": {
        isMatchingCheckoutCalculation: (calculation, candidate, cartId) =>
          calculation?.cartId === cartId &&
          calculation?.delivery?.provider === candidate.provider &&
          calculation?.delivery?.pickupPoint?.id === candidate.pickupPointId,
      },
      "@tanstack/react-query": {
        queryOptions: (options) => options,
      },
    },
  );
  const queryOptions = [];

  for (const promoCode of [undefined, "SAVE10"]) {
    queryOptions.push(
      checkoutCalculationQueryOptions(delivery, {
        accountIdentity: "user-1",
        cartId: "cart-1",
        cartSignature: "cart-signature",
        promoCode,
      }),
    );
  }

  assert.notDeepEqual(queryOptions[0].queryKey, queryOptions[1].queryKey);
  assert.equal(queryOptions[0].queryKey[3], null);
  assert.equal(queryOptions[1].queryKey[3], "SAVE10");

  await queryOptions[0].queryFn();
  await queryOptions[1].queryFn();
  assert.deepEqual(requests, [
    { delivery, promoCode: undefined },
    { delivery, promoCode: "SAVE10" },
  ]);
});
