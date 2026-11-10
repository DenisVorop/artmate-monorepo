import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import process from "node:process";
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

async function loadAnalytics({ consent = true } = {}) {
  const types = evaluateTypeScript(await readSource("src/shared/lib/analytics/types.ts"));
  const product = evaluateTypeScript(await readSource("src/shared/lib/analytics/product.ts"));
  const dedupe = evaluateTypeScript(await readSource("src/shared/lib/analytics/dedupe.ts"));
  const sanitizer = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/sanitize-analytics-url.ts"),
  );
  const factory = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/create-analytics.ts"),
    {
      "@/shared/lib/cookie-consent": { getCookieConsentSnapshot: () => consent },
      "./dedupe": dedupe,
      "./product": product,
      "./sanitize-analytics-url": sanitizer,
      "./types": types,
    },
  );

  return { ...types, ...product, ...dedupe, ...factory };
}

function createStorage({ throws = false } = {}) {
  const values = new Map();

  return {
    values,
    getItem(key) {
      if (throws) throw new Error("storage is blocked");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (throws) throw new Error("storage is blocked");
      values.set(key, value);
    },
  };
}

function createAnalyticsWindow({ counterId, ym, sessionStorage, localStorage } = {}) {
  return {
    document: {
      getElementById(id) {
        assert.equal(id, "yandex-metrika");

        if (counterId === undefined) {
          return null;
        }

        return {
          getAttribute(name) {
            assert.equal(name, "data-counter-id");
            return counterId;
          },
        };
      },
    },
    sessionStorage: sessionStorage ?? createStorage(),
    localStorage: localStorage ?? createStorage(),
    ...(ym ? { ym } : {}),
  };
}

function withWindow(value, callback) {
  const previous = globalThis.window;

  if (value === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = value;
  }

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previous;
    }
  }
}

function withoutCounterEnv(callback) {
  const previous = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  delete process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
    } else {
      process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID = previous;
    }
  }
}

test("site behavior sends only approved dimensions after consent", async () => {
  const ymCalls = [];
  const analyticsWindow = createAnalyticsWindow({
    counterId: "109148727",
    ym: (...args) => ymCalls.push(args),
  });

  for (const consent of [false, true]) {
    const { createAnalytics, createGoalCommand, createInteractionCommand } = await loadAnalytics({
      consent,
    });
    const analytics = createAnalytics({
      navigation: (params) => createGoalCommand("site_navigation", params),
      scroll: (params) => createGoalCommand("site_scroll_depth", params),
      interaction: (params) => createGoalCommand("site_interaction", params),
      feedback: (params) => createGoalCommand("feedback_submit_success", params),
      paymentReturn: (params) => createInteractionCommand("payment_return_guest", params),
      sort: (params) => createInteractionCommand("catalog_sort", params),
      unregistered: () => createInteractionCommand("unregistered_action", {}),
    });

    withWindow(analyticsWindow, () => {
      analytics.send("navigation", {
        from_section: "home",
        to_section: "catalog",
        placement: "header",
        href: "/catalog?q=buyer@example.com",
      });
      analytics.send("navigation", {
        from_section: "home",
        to_section: "/account/unknown",
        placement: "header",
      });
      analytics.send("scroll", { section: "catalog", percent: 51 });
      analytics.send("interaction", { section: "checkout", action: "payment_return_guest" });
      analytics.send("paymentReturn", { order_id: "PRIVATE-ORDER" });
      analytics.send("sort", { sort: "price-asc", query: "buyer@example.com" });
      analytics.send("sort", { sort: "not-a-sort" });
      analytics.send("unregistered");
      analytics.send("feedback", { form: "checkout" });
      analytics.send("feedback", { form: "contact", email: "buyer@example.com" });
    });

    if (!consent) assert.deepEqual(ymCalls, []);
  }

  assert.deepEqual(ymCalls, [
    [
      109148727,
      "reachGoal",
      "site_navigation",
      {
        from_section: "home",
        to_section: "catalog",
        placement: "header",
      },
    ],
    [109148727, "params", { artmate_action: "payment_return_guest" }],
    [
      109148727,
      "params",
      {
        artmate_action: "catalog_sort",
        artmate_action_context: { catalog_sort: { sort: "price-asc" } },
      },
    ],
    [109148727, "reachGoal", "feedback_submit_success", { form: "contact" }],
  ]);
  assert.deepEqual(
    analyticsWindow.dataLayer.filter(
      ({ event }) => event === "catalog_sort" || event === "payment_return_guest",
    ),
    [{ event: "payment_return_guest" }, { event: "catalog_sort", sort: "price-asc" }],
  );
  assert.doesNotMatch(
    JSON.stringify(analyticsWindow.dataLayer),
    /buyer@example\.com|PRIVATE-ORDER/u,
  );
});

test("site navigation classifies destinations without emitting private paths or search values", async () => {
  const routes = evaluateTypeScript(await readSource("src/shared/constants/routes.ts"));
  const sensitivePaths = evaluateTypeScript(
    await readSource("src/shared/lib/is-sensitive-path.ts"),
    {
      "@/shared/constants": routes,
    },
  );
  const sharedAnalytics = await loadAnalytics();
  const { getSiteSection, getNavigationDestination } = evaluateTypeScript(
    await readSource("src/_app/lib/site-analytics.ts"),
    {
      "@/shared/constants": routes,
      "@/shared/lib/analytics": sharedAnalytics,
      "@/shared/lib/is-sensitive-path": sensitivePaths,
    },
  );
  const location = new URL("https://artmate.ru/catalog");
  assert.equal(getSiteSection("/auth/reset-password"), undefined);
  assert.equal(getSiteSection("/catalog/raskraski/flowers/album"), "product");
  assert.equal(getSiteSection("/blog/article"), "article");
  assert.equal(
    getNavigationDestination("https://artmate.ru/auth/oauth/yandex/callback", location, false),
    undefined,
  );
  assert.equal(
    getNavigationDestination("https://artmate.ru/catalog?query=buyer@example.com", location, false),
    "catalog",
  );
  assert.equal(
    getNavigationDestination("https://artmate.ru/catalog#list", location, false),
    undefined,
  );
  assert.equal(
    getNavigationDestination("https://ozon.ru/product/example", location, false),
    "marketplace_ozon",
  );
  assert.equal(
    getNavigationDestination("https://fake-ozon.ru/product/example", location, false),
    undefined,
  );
});

test("analytics is an SSR-safe no-op and does not execute builders without window", async () => {
  const { createAnalytics, createGoalCommand } = await loadAnalytics();
  let builderCalls = 0;
  const analytics = createAnalytics({
    productViewed: () => {
      builderCalls += 1;
      return createGoalCommand("product_view", {
        product_id: "product-1",
        price: 100,
        currency: "RUB",
      });
    },
  });

  withWindow(undefined, () => {
    assert.doesNotThrow(() => analytics.send("productViewed"));
  });
  assert.equal(builderCalls, 0);
});

test("goal still reaches dataLayer when counter and ym are unavailable", async () => {
  const { createAnalytics, createGoalCommand } = await loadAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const analytics = createAnalytics({
    checkoutStarted: () =>
      createGoalCommand("begin_checkout", {
        cart_id: "cart-1",
        items_count: 2,
        value: 499,
        currency: "RUB",
      }),
  });

  withoutCounterEnv(() =>
    withWindow(analyticsWindow, () => {
      assert.doesNotThrow(() => analytics.send("checkoutStarted"));
    }),
  );

  assert.deepEqual(analyticsWindow.dataLayer, [
    {
      event: "begin_checkout",
      cart_id: "cart-1",
      items_count: 2,
      value: 499,
      currency: "RUB",
    },
  ]);
});

test("goal uses script counter id for both dataLayer and reachGoal", async () => {
  const { createAnalytics, createGoalCommand } = await loadAnalytics();
  const ymCalls = [];
  const analyticsWindow = createAnalyticsWindow({
    counterId: "109148727",
    ym: (...args) => ymCalls.push(args),
  });
  const params = {
    product_id: "product-1",
    category: "markers",
    price: 1200,
    currency: "RUB",
  };
  const analytics = createAnalytics({
    productViewed: () => createGoalCommand("product_view", params),
  });

  withWindow(analyticsWindow, () => analytics.send("productViewed"));

  assert.deepEqual(analyticsWindow.dataLayer, [{ event: "product_view", ...params }]);
  assert.deepEqual(ymCalls, [[109148727, "reachGoal", "product_view", params]]);
});

test("counter id falls back to the public client environment", async () => {
  const { createAnalytics, createGoalCommand } = await loadAnalytics();
  const ymCalls = [];
  const analyticsWindow = createAnalyticsWindow({
    ym: (...args) => ymCalls.push(args),
  });
  const analytics = createAnalytics({
    signedUp: () => createGoalCommand("sign_up", {}),
  });
  const previous = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID = "109148727";

  try {
    withWindow(analyticsWindow, () => analytics.send("signedUp"));
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
    } else {
      process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID = previous;
    }
  }

  assert.deepEqual(ymCalls, [[109148727, "reachGoal", "sign_up", {}]]);
});

test("all ecommerce actions use the official RUB payload shape", async () => {
  const { createAnalytics, createEcommerceCommand, mapAnalyticsProduct } = await loadAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const product = mapAnalyticsProduct({
    id: "markers-168",
    name: "Artmate 168",
    price: 5490,
    category: "markers",
    quantity: 2,
    list: "catalog",
    position: 3,
  });
  assert.ok(product);

  const analytics = createAnalytics({
    productAction: (action) => createEcommerceCommand(action, { products: [product] }),
    promotionAction: (action) =>
      createEcommerceCommand(action, {
        promotions: [
          {
            id: "welcome",
            name: "Welcome offer",
            creative: "welcome-sheet",
            position: "overlay",
          },
        ],
      }),
    purchased: () =>
      createEcommerceCommand("purchase", {
        actionField: { id: "order-1", revenue: 10_480, coupon: "WELCOME" },
        products: [product],
      }),
  });

  withWindow(analyticsWindow, () => {
    for (const action of ["click", "detail", "add", "remove"]) {
      analytics.send("productAction", action);
    }

    analytics.send("promotionAction", "promoView");
    analytics.send("promotionAction", "promoClick");
    analytics.send("purchased");
  });

  const expectedProduct = {
    id: "markers-168",
    name: "Artmate 168",
    price: 5490,
    quantity: 2,
    category: "markers",
    list: "catalog",
    position: 3,
  };
  const expectedPromotion = {
    id: "welcome",
    name: "Welcome offer",
    creative: "welcome-sheet",
    position: "overlay",
  };

  assert.deepEqual(analyticsWindow.dataLayer, [
    { ecommerce: { currencyCode: "RUB", click: { products: [expectedProduct] } } },
    { ecommerce: { currencyCode: "RUB", detail: { products: [expectedProduct] } } },
    { ecommerce: { currencyCode: "RUB", add: { products: [expectedProduct] } } },
    { ecommerce: { currencyCode: "RUB", remove: { products: [expectedProduct] } } },
    {
      ecommerce: {
        currencyCode: "RUB",
        promoView: { promotions: [expectedPromotion] },
      },
    },
    {
      ecommerce: {
        currencyCode: "RUB",
        promoClick: { promotions: [expectedPromotion] },
      },
    },
    {
      ecommerce: {
        currencyCode: "RUB",
        purchase: {
          actionField: { id: "order-1", revenue: 10_480, coupon: "WELCOME" },
          products: [expectedProduct],
        },
      },
    },
  ]);
});

test("product mapper normalizes fields and rejects unsafe ecommerce values", async () => {
  const { mapAnalyticsProduct } = await loadAnalytics();

  assert.deepEqual(
    mapAnalyticsProduct({
      id: " product-1 ",
      name: " Markers ",
      price: 0,
      category: " ",
      list: " catalog ",
    }),
    {
      id: "product-1",
      name: "Markers",
      price: 0,
      quantity: 1,
      list: "catalog",
    },
  );

  const validBase = { id: "product-1", name: "Markers", price: 100 };
  const invalidInputs = [
    { ...validBase, id: " " },
    { ...validBase, name: "" },
    { ...validBase, price: "100" },
    { ...validBase, price: Number.NaN },
    { ...validBase, price: Number.POSITIVE_INFINITY },
    { ...validBase, price: -1 },
    { ...validBase, quantity: 0 },
    { ...validBase, quantity: 1.5 },
    { ...validBase, position: 0 },
  ];

  for (const input of invalidInputs) {
    assert.equal(mapAnalyticsProduct(input), null, JSON.stringify(input));
  }
});

test("runtime param sanitization removes PII, nested values and invalid scalars", async () => {
  const { createAnalytics, createGoalCommand } = await loadAnalytics();
  const ymCalls = [];
  const analyticsWindow = createAnalyticsWindow({
    counterId: "109148727",
    ym: (...args) => ymCalls.push(args),
  });
  const analytics = createAnalytics({
    checkoutStarted: () =>
      createGoalCommand("begin_checkout", {
        cart_id: "cart-1",
        items_count: 2,
        value: 599,
        currency: "RUB",
        email: "person@example.com",
        customer_name: "Person",
        user_id: "user-1",
        access_token: "secret",
        verification_code: "123456",
        phone: "+79990000000",
        campaign: "person@example.com",
        contact: "+7 999 000-00-00",
        negative: -1,
        nested: { address: "hidden" },
        invalid_number: Number.NaN,
        infinity: Number.POSITIVE_INFINITY,
        empty: " ",
        missing: undefined,
      }),
  });

  withWindow(analyticsWindow, () => analytics.send("checkoutStarted"));

  const safeParams = {
    cart_id: "cart-1",
    items_count: 2,
    value: 599,
    currency: "RUB",
  };
  assert.deepEqual(analyticsWindow.dataLayer, [{ event: "begin_checkout", ...safeParams }]);
  assert.deepEqual(ymCalls, [[109148727, "reachGoal", "begin_checkout", safeParams]]);
});

test("goal runtime allowlist removes structurally valid extra fields", async () => {
  const { createAnalytics, createGoalCommand } = await loadAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const productParamsWithExtras = {
    product_id: "product-1",
    category: "markers",
    price: 599,
    currency: "RUB",
    contact_name: "Denis",
    buyer_first_name: "Denis",
    shipping_street: "Tverskaya",
    auth_hash: "secret",
    harmless_extra: "must-not-pass",
  };
  const analytics = createAnalytics({
    productViewed: () => createGoalCommand("product_view", productParamsWithExtras),
  });

  withWindow(analyticsWindow, () => analytics.send("productViewed"));

  assert.deepEqual(analyticsWindow.dataLayer, [
    {
      event: "product_view",
      product_id: "product-1",
      category: "markers",
      price: 599,
      currency: "RUB",
    },
  ]);
});

test("invalid required goal params do not create partial conversions or consume dedupe", async () => {
  const { createAnalytics, createGoalCommand } = await loadAnalytics();
  const localStorage = createStorage();
  const ymCalls = [];
  const analyticsWindow = createAnalyticsWindow({
    counterId: "109148727",
    localStorage,
    ym: (...args) => ymCalls.push(args),
  });
  let cartValue = -1;
  const analytics = createAnalytics({
    productViewed: () =>
      createGoalCommand("product_view", {
        product_id: " ",
        price: Number.NaN,
        currency: "USD",
      }),
    checkoutStarted: () =>
      createGoalCommand(
        "begin_checkout",
        {
          cart_id: "cart-runtime-validation",
          items_count: 1,
          value: cartValue,
          currency: "RUB",
        },
        { scope: "local", entityKey: "cart-runtime-validation" },
      ),
  });

  withWindow(analyticsWindow, () => {
    analytics.send("productViewed");
    analytics.send("checkoutStarted");
    assert.equal(localStorage.values.size, 0);

    cartValue = 599;
    analytics.send("checkoutStarted");
    analytics.send("checkoutStarted");
  });

  assert.deepEqual(analyticsWindow.dataLayer, [
    {
      event: "begin_checkout",
      cart_id: "cart-runtime-validation",
      items_count: 1,
      value: 599,
      currency: "RUB",
    },
  ]);
  assert.equal(ymCalls.length, 1);
  assert.equal(localStorage.values.size, 1);
});

test("memory, session and local dedupe scopes suppress only matching command entities", async () => {
  const { createAnalytics, createDiagnosticCommand } = await loadAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const analytics = createAnalytics({
    dismissed: (scope, entityKey) =>
      createDiagnosticCommand("welcome_promo_dismiss", { reason: "close" }, { scope, entityKey }),
  });

  withWindow(analyticsWindow, () => {
    for (const scope of ["memory", "session", "local"]) {
      analytics.send("dismissed", scope, `offer-${scope}`);
      analytics.send("dismissed", scope, `offer-${scope}`);
    }

    analytics.send("dismissed", "memory", "another-offer");
  });

  assert.equal(analyticsWindow.dataLayer.length, 4);
  assert.deepEqual(
    analyticsWindow.dataLayer.map((event) => event.event),
    [
      "welcome_promo_dismiss",
      "welcome_promo_dismiss",
      "welcome_promo_dismiss",
      "welcome_promo_dismiss",
    ],
  );
});

test("blocked storage falls back to memory dedupe without throwing", async () => {
  const { createAnalytics, createDiagnosticCommand } = await loadAnalytics();
  const blockedStorage = createStorage({ throws: true });
  const analyticsWindow = createAnalyticsWindow({
    sessionStorage: blockedStorage,
    localStorage: blockedStorage,
  });
  const analytics = createAnalytics({
    dismissed: () =>
      createDiagnosticCommand(
        "welcome_promo_dismiss",
        { reason: "not_now" },
        { scope: "local", entityKey: "blocked-storage-offer" },
      ),
  });

  withWindow(analyticsWindow, () => {
    assert.doesNotThrow(() => analytics.send("dismissed"));
    assert.doesNotThrow(() => analytics.send("dismissed"));
  });

  assert.equal(analyticsWindow.dataLayer.length, 1);
});

test("purchase uses its own persistent dedupe namespace", async () => {
  const { createAnalytics, createEcommerceCommand, mapAnalyticsProduct } = await loadAnalytics();
  const localStorage = createStorage();
  const analyticsWindow = createAnalyticsWindow({
    localStorage,
  });
  const product = mapAnalyticsProduct({
    id: "product-1",
    name: "Markers",
    price: 599,
  });
  assert.ok(product);
  const dedupe = { scope: "local", entityKey: "order-1" };
  const analytics = createAnalytics({
    orderPurchased: () =>
      createEcommerceCommand(
        "purchase",
        {
          actionField: { id: "order-1", revenue: 599 },
          products: [product],
        },
        dedupe,
      ),
  });

  withWindow(analyticsWindow, () => {
    analytics.send("orderPurchased");
    analytics.send("orderPurchased");
  });

  assert.equal(analyticsWindow.dataLayer.length, 1);
  assert.ok(analyticsWindow.dataLayer[0].ecommerce.purchase);
  assert.equal(localStorage.values.size, 1);
  assert.ok([...localStorage.values.keys()].some((key) => key.includes(":ecommerce:purchase:")));
});

test("real repeated add and remove actions are not deduped by default", async () => {
  const { createAnalytics, createEcommerceCommand, mapAnalyticsProduct } = await loadAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const product = mapAnalyticsProduct({
    id: "product-1",
    name: "Markers",
    price: 599,
  });
  assert.ok(product);
  const analytics = createAnalytics({
    cartChanged: (action) => createEcommerceCommand(action, { products: [product] }),
  });

  withWindow(analyticsWindow, () => {
    analytics.send("cartChanged", "add");
    analytics.send("cartChanged", "add");
    analytics.send("cartChanged", "remove");
    analytics.send("cartChanged", "remove");
  });

  assert.deepEqual(
    analyticsWindow.dataLayer.map((entry) => Object.keys(entry.ecommerce)[1]),
    ["add", "add", "remove", "remove"],
  );
});

test("invalid ecommerce payload does not consume its dedupe key", async () => {
  const { createAnalytics, createEcommerceCommand, mapAnalyticsProduct } = await loadAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const product = mapAnalyticsProduct({
    id: "product-1",
    name: "Markers",
    price: 599,
  });
  assert.ok(product);
  let products = [];
  const analytics = createAnalytics({
    productViewed: () =>
      createEcommerceCommand("detail", { products }, { scope: "memory", entityKey: "product-1" }),
  });

  withWindow(analyticsWindow, () => {
    analytics.send("productViewed");
    products = [product];
    analytics.send("productViewed");
    analytics.send("productViewed");
  });

  assert.equal(analyticsWindow.dataLayer.length, 1);
  assert.deepEqual(analyticsWindow.dataLayer[0], {
    ecommerce: {
      currencyCode: "RUB",
      detail: { products: [product] },
    },
  });
});

test("failed ecommerce transport does not consume a persistent dedupe key", async () => {
  const { createAnalytics, createEcommerceCommand, mapAnalyticsProduct } = await loadAnalytics();
  const localStorage = createStorage();
  const analyticsWindow = createAnalyticsWindow({ localStorage });
  const product = mapAnalyticsProduct({
    id: "product-transport-retry",
    name: "Markers",
    price: 599,
  });
  assert.ok(product);
  const analytics = createAnalytics({
    productViewed: () =>
      createEcommerceCommand(
        "detail",
        { products: [product] },
        { scope: "local", entityKey: "product-transport-retry" },
      ),
  });
  analyticsWindow.dataLayer = Object.freeze([]);

  withWindow(analyticsWindow, () => {
    assert.doesNotThrow(() => analytics.send("productViewed"));
    assert.equal(localStorage.values.size, 0);

    analyticsWindow.dataLayer = [];
    analytics.send("productViewed");
    analytics.send("productViewed");
  });

  assert.equal(analyticsWindow.dataLayer.length, 1);
  assert.equal(localStorage.values.size, 1);
});
