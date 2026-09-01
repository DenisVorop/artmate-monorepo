import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) =>
    Object.hasOwn(mocks, specifier) ? mocks[specifier] : require(specifier);

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );

  return loadedModule.exports;
}

async function loadSharedAnalytics() {
  const types = evaluateTypeScript(await readSource("src/shared/lib/analytics/types.ts"));
  const product = evaluateTypeScript(await readSource("src/shared/lib/analytics/product.ts"));
  const dedupe = evaluateTypeScript(await readSource("src/shared/lib/analytics/dedupe.ts"));
  const sanitizer = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/sanitize-analytics-url.ts"),
  );
  const factory = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/create-analytics.ts"),
    {
      "./dedupe": dedupe,
      "./product": product,
      "./sanitize-analytics-url": sanitizer,
      "./types": types,
    },
  );

  return { ...types, ...product, ...dedupe, ...factory };
}

async function loadPromocodeAnalytics(sharedAnalytics) {
  return evaluateTypeScript(await readSource("src/features/promocode/lib/analytics.ts"), {
    "@/shared/lib/analytics": sharedAnalytics,
  });
}

function createStorage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function createAnalyticsWindow() {
  return {
    dataLayer: [],
    document: { getElementById: () => null },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
  };
}

async function withWindow(value, callback) {
  const previous = globalThis.window;
  globalThis.window = value;

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previous;
    }
  }
}

function createPreview(overrides = {}) {
  return {
    cartId: "cart-promo-1",
    code: "SAVE10",
    subtotal: 5_490,
    discount: 549,
    total: 4_941,
    currency: "RUB",
    email: "must-not-leak@example.com",
    ...overrides,
  };
}

function promoSuccessEvent(discount) {
  return { event: "promo_apply_success", discount, currency: "RUB" };
}

function createDeferred() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });

  return { promise, reject, resolve };
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createComponentHarness() {
  const instances = new Map();
  const pendingEffects = [];
  let currentInstance;

  function dependenciesChanged(previous, next) {
    return (
      !previous ||
      !next ||
      previous.length !== next.length ||
      previous.some((value, index) => !Object.is(value, next[index]))
    );
  }

  function getInstance(key) {
    if (!instances.has(key)) {
      instances.set(key, { cursor: 0, effects: [], memoized: [], refs: [], states: [] });
    }

    return instances.get(key);
  }

  const react = {
    useCallback(callback, dependencies) {
      return react.useMemo(() => callback, dependencies);
    },
    useEffect(effect, dependencies) {
      const instance = currentInstance;
      const index = instance.cursor++;
      const previous = instance.effects[index];

      if (dependenciesChanged(previous, dependencies)) {
        instance.effects[index] = dependencies;
        pendingEffects.push(effect);
      }
    },
    useMemo(factory, dependencies) {
      const instance = currentInstance;
      const index = instance.cursor++;
      const previous = instance.memoized[index];

      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        instance.memoized[index] = { dependencies, value: factory() };
      }

      return instance.memoized[index].value;
    },
    useRef(initialValue) {
      const instance = currentInstance;
      const index = instance.cursor++;

      if (!instance.refs[index]) {
        instance.refs[index] = { current: initialValue };
      }

      return instance.refs[index];
    },
    useState(initialValue) {
      const instance = currentInstance;
      const index = instance.cursor++;

      if (!(index in instance.states)) {
        instance.states[index] = typeof initialValue === "function" ? initialValue() : initialValue;
      }

      return [
        instance.states[index],
        (nextValue) => {
          instance.states[index] =
            typeof nextValue === "function" ? nextValue(instance.states[index]) : nextValue;
        },
      ];
    },
  };

  return {
    flushEffects({ strict = false } = {}) {
      while (pendingEffects.length > 0) {
        const effect = pendingEffects.shift();
        effect();

        if (strict) {
          effect();
        }
      }
    },
    react,
    render(Component, props, key = Component) {
      const previousInstance = currentInstance;
      currentInstance = getInstance(key);
      currentInstance.cursor = 0;

      try {
        return Component(props);
      } finally {
        currentInstance = previousInstance;
      }
    },
  };
}

test("promo adapter sends the allowlisted goal once per manual attempt", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const { useAnalytics } = await loadPromocodeAnalytics(sharedAnalytics);
  const analytics = useAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const preview = createPreview();
  const attempt = {
    attemptKey: "promo-attempt-adapter-1",
    cartId: preview.cartId,
    code: preview.code,
  };

  await withWindow(analyticsWindow, () => {
    analytics.promoApplied(preview, attempt);
    analytics.promoApplied(preview, attempt);
    analytics.promoApplied(preview, { ...attempt, attemptKey: "promo-attempt-adapter-2" });
  });

  assert.deepEqual(analyticsWindow.dataLayer, [
    promoSuccessEvent(preview.discount),
    promoSuccessEvent(preview.discount),
  ]);
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes(preview.code), false);
});

test("promo adapter rejects mismatched or invalid server previews and is SSR-safe", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const { useAnalytics } = await loadPromocodeAnalytics(sharedAnalytics);
  const analytics = useAnalytics();
  const attempt = {
    attemptKey: "promo-attempt-invalid",
    cartId: "cart-promo-1",
    code: "SAVE10",
  };

  assert.doesNotThrow(() => analytics.promoApplied(createPreview(), attempt));

  const analyticsWindow = createAnalyticsWindow();
  await withWindow(analyticsWindow, () => {
    analytics.promoApplied(createPreview({ cartId: "another-cart" }), attempt);
    analytics.promoApplied(createPreview({ code: "OTHER10" }), attempt);
    analytics.promoApplied(createPreview({ currency: "USD" }), attempt);
    analytics.promoApplied(createPreview({ discount: 0 }), attempt);
    analytics.promoApplied(createPreview({ discount: Number.NaN }), attempt);
    analytics.promoApplied(undefined, attempt);
  });

  assert.deepEqual(analyticsWindow.dataLayer, []);
});

test("provider attributes only its explicit post-click fetch to the current manual attempt", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const promocodeAnalytics = await loadPromocodeAnalytics(sharedAnalytics);
  const promoCode = evaluateTypeScript(
    await readSource("src/features/promocode/lib/promo-code.ts"),
    { "@/entities/cart": {} },
  );
  const componentHarness = createComponentHarness();
  const analyticsWindow = createAnalyticsWindow();
  let cart = {
    id: "cart-promo-1",
    items: [{ id: "markers", price: 5_490, quantity: 1 }],
  };
  let userId = "account-1";
  let storedCode = "SAVED10";
  let previewResult = {
    data: createPreview({ code: storedCode }),
    error: null,
    isError: false,
    isPaused: false,
    isPending: false,
    retry: () => Promise.resolve(createPreview()),
  };
  const previewQuery = ({ accountIdentity, cartSignature, code }) => ({
    queryKey: ["promocode-preview", cartSignature, code, accountIdentity],
  });
  const fetchOutcomes = [];
  const operations = [];
  const queryClient = {
    cancelQueries(options) {
      operations.push(["cancel", options]);
      return Promise.resolve();
    },
    fetchQuery(options) {
      operations.push(["fetch", options]);
      const outcome = fetchOutcomes.shift();

      if (!outcome) {
        throw new Error("Missing mocked fetch outcome");
      }

      return outcome;
    },
    removeQueries() {},
  };
  const jsx = (type, props, key) => ({ key, props, type });
  const { PromocodeProvider } = evaluateTypeScript(
    await readSource("src/features/promocode/lib/promo-code-provider/promocode-provider.tsx"),
    {
      "../analytics": promocodeAnalytics,
      "../promo-code": promoCode,
      "../promo-code-storage": {
        clearStoredPromoCode: () => {
          storedCode = undefined;
        },
        readCartPromoCode: () => storedCode,
        writeStoredPromoCode: ({ code }) => {
          storedCode = code;
        },
      },
      "./promocode.context": { PromocodeContext: { Provider: "PromocodeProvider" } },
      "@/entities/cart": {},
      "@/entities/promocode": {
        promoCodeQuery: { baseKey: ["promocode-preview"], preview: previewQuery },
        usePromoPreview: () => previewResult,
      },
      "@/entities/session": { useUser: () => ({ id: userId }) },
      "@tanstack/react-query": { useQueryClient: () => queryClient },
      react: componentHarness.react,
      "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
    },
  );
  const renderProvider = (key = "provider-1") =>
    componentHarness.render(PromocodeProvider, { cart, children: "children" }, key);

  await withWindow(analyticsWindow, async () => {
    renderProvider();
    componentHarness.flushEffects();
    renderProvider();
    componentHarness.flushEffects();
    assert.deepEqual(analyticsWindow.dataLayer, [], "hydrated stored code is not a manual apply");

    const sameCodeRequest = createDeferred();
    fetchOutcomes.push(sameCodeRequest.promise);
    renderProvider().props.value.applyCode(" save10 ");
    await flushPromises();
    renderProvider();
    componentHarness.flushEffects();
    assert.deepEqual(
      analyticsWindow.dataLayer,
      [],
      "cached or already in-flight same-key data cannot satisfy the click",
    );
    assert.equal(operations[0][0], "cancel");
    assert.equal(operations[1][0], "fetch");
    assert.equal(operations[0][1].exact, true);
    assert.equal(operations[1][1].staleTime, 0);

    sameCodeRequest.resolve(createPreview());
    await flushPromises();
    renderProvider();
    componentHarness.flushEffects({ strict: true });
    assert.deepEqual(analyticsWindow.dataLayer, [promoSuccessEvent(549)]);

    previewResult = { ...previewResult, data: createPreview({ discount: 777 }) };
    renderProvider();
    componentHarness.flushEffects();
    assert.deepEqual(
      analyticsWindow.dataLayer,
      [promoSuccessEvent(549)],
      "background preview changes do not reuse a completed manual attempt",
    );

    renderProvider("provider-2");
    componentHarness.flushEffects();
    renderProvider("provider-2");
    componentHarness.flushEffects();
    assert.deepEqual(analyticsWindow.dataLayer, [promoSuccessEvent(549)], "remount is hydration");

    const oldCartRequest = createDeferred();
    fetchOutcomes.push(oldCartRequest.promise);
    renderProvider("provider-2").props.value.applyCode("SAVE10");
    await flushPromises();
    cart = {
      ...cart,
      items: [{ ...cart.items[0], quantity: 2 }],
    };
    renderProvider("provider-2");
    componentHarness.flushEffects();
    oldCartRequest.resolve(createPreview());
    await flushPromises();
    renderProvider("provider-2");
    componentHarness.flushEffects();
    assert.deepEqual(
      analyticsWindow.dataLayer,
      [promoSuccessEvent(549)],
      "quantity or price changes invalidate the old cart-signature attempt",
    );

    const oldAccountRequest = createDeferred();
    fetchOutcomes.push(oldAccountRequest.promise);
    renderProvider("provider-2").props.value.applyCode("SAVE10");
    await flushPromises();
    userId = "account-2";
    renderProvider("provider-2");
    componentHarness.flushEffects();
    oldAccountRequest.resolve(createPreview());
    await flushPromises();
    renderProvider("provider-2");
    componentHarness.flushEffects();
    assert.deepEqual(
      analyticsWindow.dataLayer,
      [promoSuccessEvent(549)],
      "account changes invalidate the old attempt",
    );

    const clearedRequest = createDeferred();
    fetchOutcomes.push(clearedRequest.promise);
    let provider = renderProvider("provider-2");
    provider.props.value.applyCode("SAVE10");
    await flushPromises();
    provider = renderProvider("provider-2");
    provider.props.value.clearCode();
    clearedRequest.resolve(createPreview());
    await flushPromises();
    renderProvider("provider-2");
    componentHarness.flushEffects();
    assert.deepEqual(
      analyticsWindow.dataLayer,
      [promoSuccessEvent(549)],
      "clearing the code invalidates the attempt",
    );

    const failedRequest = createDeferred();
    fetchOutcomes.push(failedRequest.promise);
    renderProvider("provider-2").props.value.applyCode("SAVE10");
    await flushPromises();
    failedRequest.reject(new Error("offline"));
    await flushPromises();
    renderProvider("provider-2");
    componentHarness.flushEffects();
    const retryRequest = createDeferred();
    fetchOutcomes.push(retryRequest.promise);
    renderProvider("provider-2").props.value.retry();
    await flushPromises();
    retryRequest.resolve(createPreview({ discount: 575 }));
    await flushPromises();
    renderProvider("provider-2");
    componentHarness.flushEffects({ strict: true });
    assert.deepEqual(
      analyticsWindow.dataLayer,
      [promoSuccessEvent(549), promoSuccessEvent(575)],
      "an explicit retry becomes a new manual attempt after fresh success",
    );

    const doubleSubmitRequest = createDeferred();
    fetchOutcomes.push(doubleSubmitRequest.promise);
    provider = renderProvider("provider-2");
    provider.props.value.applyCode("SAVE10");
    provider.props.value.applyCode("SAVE10");
    await flushPromises();
    doubleSubmitRequest.resolve(createPreview({ discount: 600 }));
    await flushPromises();
    renderProvider("provider-2");
    componentHarness.flushEffects({ strict: true });
    assert.deepEqual(analyticsWindow.dataLayer, [
      promoSuccessEvent(549),
      promoSuccessEvent(575),
      promoSuccessEvent(600),
    ]);
  });

  const cancelOperations = operations.filter(([operation]) => operation === "cancel");
  const fetchOperations = operations.filter(([operation]) => operation === "fetch");
  assert.equal(cancelOperations.length, 8);
  assert.equal(fetchOperations.length, 7, "the first half of a double submit is superseded");
  assert.ok(cancelOperations.every(([, options]) => options.exact === true));
});
