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

async function createCheckoutHarness({ calculationState, promoState }) {
  const getPromoPricingState = await loadPromoPricingState();
  const checkoutForm = evaluateTypeScript(
    await readSource("src/features/checkout/lib/checkout-form.ts"),
    { zod: require("zod") },
  );
  const reactHarness = createReactHarness();
  const calculationCalls = [];
  const submitted = [];
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
        useCheckoutCalculation: (delivery, identity) => {
          calculationCalls.push({ delivery, identity });
          return calculationState;
        },
      },
      "../checkout-form": checkoutForm,
      "./checkout.context": {
        CheckoutContext: { Provider: "CheckoutContextProvider" },
        checkoutSteps: ["delivery", "contacts", "confirmation"],
      },
      "@/entities/cart": {},
      "@/entities/session": { useUser: () => ({ id: "user-1" }) },
      "@/features/promocode": {
        getCartPricingSignature: () => "cart-signature",
        getPromoPricingState,
        usePromocode: () => promoState,
      },
      "@hookform/resolvers/zod": { zodResolver: (schema) => schema },
      react: reactHarness.react,
      "react-hook-form": {
        FormProvider: "FormProvider",
        useForm: () => form,
      },
      "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
    },
  );
  const props = {
    cart: { id: "cart-1", items: [{ id: "item-1", price: 1_000, quantity: 1 }] },
    children: "checkout",
    isSubmitting: false,
    onSubmit: async (input) => {
      submitted.push(input);
    },
    requiresAuth: false,
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
  };
}

const delivery = { pickupPointId: "point-1", provider: "ozon" };
const readyCalculation = {
  calculation: { delivery: 200, discount: 0, subtotal: 1_000, total: 1_200 },
  error: null,
  isError: false,
  isPaused: false,
  isPending: false,
  retry: () => undefined,
};

async function selectDelivery(harness) {
  harness.render().setSelectedDelivery(delivery);
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

test("invalid promo calculates without a code, advances, and omits it for both payments", async () => {
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
    assert.equal(context.canContinueDelivery, true);

    context.continueFromDelivery();
    assert.equal(harness.render().step, "contacts");

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
    assert.equal(context.canContinueDelivery, false);
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

    assert.equal(context.canContinueDelivery, false);
    assert.equal(context.checkoutCalculation.error, calculationState.error);
    context.submitOrder({ preventDefault: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(harness.submitted.length, 0);
  }
});

test("checkout query key and request use the effective promo code identity", async () => {
  const queryOptions = [];
  const requests = [];
  const { useCheckoutCalculation: runCheckoutCalculation } = evaluateTypeScript(
    await readSource("src/features/checkout/model/use-checkout-calculation.ts"),
    {
      "@/shared/actions/orders": {
        calculateCheckout: async (input) => {
          requests.push(input);
          return { data: { total: 1_000 } };
        },
      },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
      },
      "@/shared/lib/query-freshness": { getFreshQueryData: (result) => result.data },
      "@/shared/lib/query-keys": { cartPricingQueryKey: ["cart-pricing"] },
      "@tanstack/react-query": {
        useQuery: (options) => {
          queryOptions.push(options);
          return {
            data: undefined,
            error: null,
            fetchStatus: "idle",
            isError: false,
            isFetching: false,
            isPaused: false,
            refetch: () => undefined,
          };
        },
      },
    },
  );

  for (const promoCode of [undefined, "SAVE10"]) {
    runCheckoutCalculation(delivery, {
      accountIdentity: "user-1",
      cartSignature: "cart-signature",
      enabled: true,
      promoCode,
    });
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
