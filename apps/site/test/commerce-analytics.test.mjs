import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
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

async function loadAnalytics() {
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

async function loadCartAnalytics(sharedAnalytics) {
  return evaluateTypeScript(await readSource("src/features/cart/lib/analytics.ts"), {
    "@/shared/lib/analytics": sharedAnalytics,
  });
}

async function loadProductDetailsAnalytics(sharedAnalytics) {
  return evaluateTypeScript(await readSource("src/features/product-details/lib/analytics.ts"), {
    "@/shared/lib/analytics": sharedAnalytics,
  });
}

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function createAnalyticsWindow() {
  return {
    dataLayer: [],
    document: {
      getElementById() {
        return null;
      },
    },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
  };
}

function withWindow(value, callback) {
  const previous = globalThis.window;
  globalThis.window = value;

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

function createProduct(overrides = {}) {
  return {
    id: "product-1",
    title: "Маркеры Artmate 168",
    slug: "markery-artmate-168",
    price: 5_490,
    category: "Маркеры",
    categorySlug: "markery",
    image: "https://cdn.example/product.webp",
    images: [],
    description: "Набор маркеров",
    isHit: false,
    isOutOfStock: false,
    ...overrides,
  };
}

function createCartItem(overrides = {}) {
  const product = createProduct(overrides);

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    price: product.price,
    category: product.category,
    categorySlug: product.categorySlug,
    image: product.image,
    quantity: 1,
    lineTotal: product.price,
    ...overrides,
  };
}

function createCart(items, overrides = {}) {
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

  return {
    id: "cart-1",
    items,
    itemsCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal,
    total: subtotal,
    currency: "RUB",
    ...overrides,
  };
}

function analyticsProduct(product, overrides = {}) {
  return {
    id: product.id,
    name: product.title,
    price: product.price,
    quantity: 1,
    ...(product.category ? { category: product.category } : {}),
    ...overrides,
  };
}

function ecommerce(action, products) {
  return {
    ecommerce: {
      currencyCode: "RUB",
      [action]: { products },
    },
  };
}

test("product card click sends one exact ecommerce click for either product link", async () => {
  const sharedAnalytics = await loadAnalytics();
  const { useAnalytics } = await loadCartAnalytics(sharedAnalytics);
  const product = createProduct({
    email: "buyer@example.com",
    accessToken: "must-not-leak",
  });
  const analyticsWindow = createAnalyticsWindow();

  withWindow(analyticsWindow, () => {
    useAnalytics().productClicked(product, { list: "catalog", position: 3 });
    useAnalytics().productClicked(product, { list: "catalog", position: 3 });
  });

  const expectedProduct = analyticsProduct(product, { list: "catalog", position: 3 });
  assert.deepEqual(analyticsWindow.dataLayer, [
    ecommerce("click", [expectedProduct]),
    ecommerce("click", [expectedProduct]),
  ]);
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes("buyer@example.com"), false);
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes("must-not-leak"), false);
});

test("product detail emits detail and product_view once per memory view key", async () => {
  const sharedAnalytics = await loadAnalytics();
  const { useAnalytics } = await loadProductDetailsAnalytics(sharedAnalytics);
  const product = createProduct();
  const analyticsWindow = createAnalyticsWindow();

  withWindow(analyticsWindow, () => {
    useAnalytics().productViewed(product, "product-1:view-1");
    useAnalytics().productViewed(product, "product-1:view-1");
    useAnalytics().productViewed(product, "product-1:view-2");
  });

  const expectedProduct = analyticsProduct(product);
  const expectedGoal = {
    event: "product_view",
    product_id: product.id,
    category: product.category,
    price: product.price,
    currency: "RUB",
  };

  assert.deepEqual(analyticsWindow.dataLayer, [
    ecommerce("detail", [expectedProduct]),
    expectedGoal,
    ecommerce("detail", [expectedProduct]),
    expectedGoal,
  ]);
});

test("product view hook ignores pending data and stays StrictMode-safe", async () => {
  const sharedAnalytics = await loadAnalytics();
  const productDetailsAnalytics = await loadProductDetailsAnalytics(sharedAnalytics);
  const stableRef = { current: undefined };
  const { useTrackProductView } = evaluateTypeScript(
    await readSource("src/features/product-details/lib/use-track-product-view.ts"),
    {
      "./analytics": productDetailsAnalytics,
      react: {
        useEffect: (effect) => {
          effect();
          effect();
        },
        useRef: () => stableRef,
      },
    },
  );
  const product = createProduct();
  const nextProduct = createProduct({ id: "product-2", title: "Скетчбук Artmate" });
  const analyticsWindow = createAnalyticsWindow();

  withWindow(analyticsWindow, () => {
    useTrackProductView(undefined);
    assert.deepEqual(analyticsWindow.dataLayer, []);

    useTrackProductView(product);
    useTrackProductView(product);
    assert.equal(analyticsWindow.dataLayer.length, 2);

    useTrackProductView(undefined);
    assert.equal(analyticsWindow.dataLayer.length, 2);

    useTrackProductView(nextProduct);
    assert.equal(analyticsWindow.dataLayer.length, 4);
  });

  assert.deepEqual(analyticsWindow.dataLayer[0], ecommerce("detail", [analyticsProduct(product)]));
  assert.deepEqual(
    analyticsWindow.dataLayer[2],
    ecommerce("detail", [analyticsProduct(nextProduct)]),
  );
});

test("cart add uses confirmed delta and skips unknown cache, saturation, and missing response", async () => {
  const sharedAnalytics = await loadAnalytics();
  const { useAnalytics } = await loadCartAnalytics(sharedAnalytics);
  const cartAnalytics = useAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const item = createCartItem({ quantity: 2, lineTotal: 10_980 });
  const nearlySaturated = createCartItem({ quantity: 98, lineTotal: 538_020 });
  const saturated = createCartItem({ quantity: 99, lineTotal: 543_510 });

  withWindow(analyticsWindow, () => {
    cartAnalytics.cartItemAdded(createCart([item]), { productId: item.id, quantity: 2 }, undefined);
    assert.deepEqual(analyticsWindow.dataLayer, []);

    cartAnalytics.cartItemAdded(createCart([item]), { productId: item.id, quantity: 2 }, null);
    assert.equal(analyticsWindow.dataLayer.length, 2);

    cartAnalytics.cartItemAdded(
      createCart([saturated]),
      { productId: saturated.id, quantity: 5 },
      createCart([nearlySaturated]),
    );
    cartAnalytics.cartItemAdded(
      createCart([saturated]),
      { productId: saturated.id, quantity: 1 },
      createCart([saturated]),
    );
    cartAnalytics.cartItemAdded(null, { productId: item.id, quantity: 1 }, createCart([item]));
  });

  const expectedProduct = analyticsProduct(item, { quantity: 2 });
  assert.deepEqual(analyticsWindow.dataLayer, [
    ecommerce("add", [expectedProduct]),
    {
      event: "add_to_cart",
      product_id: item.id,
      category: item.category,
      price: item.price,
      quantity: 2,
      currency: "RUB",
    },
    ecommerce("add", [analyticsProduct(saturated, { quantity: 1 })]),
    {
      event: "add_to_cart",
      product_id: saturated.id,
      category: saturated.category,
      price: saturated.price,
      quantity: 1,
      currency: "RUB",
    },
  ]);
});

test("cart PATCH sends only the confirmed positive or negative quantity delta", async () => {
  const sharedAnalytics = await loadAnalytics();
  const { useAnalytics } = await loadCartAnalytics(sharedAnalytics);
  const cartAnalytics = useAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const previousItem = createCartItem({ quantity: 2, lineTotal: 10_980 });
  const previousCart = createCart([previousItem]);
  const increasedItem = createCartItem({ quantity: 5, lineTotal: 27_450 });
  const decreasedItem = createCartItem({ quantity: 1, lineTotal: 5_490 });

  withWindow(analyticsWindow, () => {
    cartAnalytics.cartItemQuantityUpdated(
      createCart([increasedItem]),
      { productId: previousItem.id, quantity: 5 },
      previousCart,
    );
    cartAnalytics.cartItemQuantityUpdated(
      previousCart,
      { productId: previousItem.id, quantity: 2 },
      previousCart,
    );
    cartAnalytics.cartItemQuantityUpdated(
      createCart([decreasedItem]),
      { productId: previousItem.id, quantity: 1 },
      previousCart,
    );
    cartAnalytics.cartItemQuantityUpdated(
      null,
      { productId: previousItem.id, quantity: 3 },
      previousCart,
    );
    cartAnalytics.cartItemQuantityUpdated(
      createCart([increasedItem]),
      { productId: previousItem.id, quantity: 5 },
      undefined,
    );
  });

  assert.deepEqual(analyticsWindow.dataLayer, [
    ecommerce("add", [analyticsProduct(increasedItem, { quantity: 3 })]),
    ecommerce("remove", [analyticsProduct(decreasedItem, { quantity: 1 })]),
  ]);
});

test("remove and clear cart report confirmed removed quantities and skip no-ops", async () => {
  const sharedAnalytics = await loadAnalytics();
  const { useAnalytics } = await loadCartAnalytics(sharedAnalytics);
  const cartAnalytics = useAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const first = createCartItem({ quantity: 3, lineTotal: 16_470 });
  const second = createCartItem({
    id: "product-2",
    title: "Скетчбук Artmate",
    slug: "sketchbook",
    price: 790,
    quantity: 2,
    lineTotal: 1_580,
  });
  const emptyCart = createCart([]);

  withWindow(analyticsWindow, () => {
    cartAnalytics.cartItemRemoved(emptyCart, { productId: first.id }, createCart([first]));
    cartAnalytics.cartItemRemoved(
      createCart([first]),
      { productId: first.id },
      createCart([first]),
    );
    cartAnalytics.cartItemRemoved(emptyCart, { productId: first.id }, emptyCart);
    cartAnalytics.cartItemRemoved(null, { productId: first.id }, createCart([first]));

    cartAnalytics.cartCleared(emptyCart, createCart([first, second]));
    cartAnalytics.cartCleared(emptyCart, emptyCart);
    cartAnalytics.cartCleared(null, createCart([first, second]));
  });

  assert.deepEqual(analyticsWindow.dataLayer, [
    ecommerce("remove", [analyticsProduct(first, { quantity: 3 })]),
    ecommerce("remove", [
      analyticsProduct(first, { quantity: 3 }),
      analyticsProduct(second, { quantity: 2 }),
    ]),
  ]);
});

function findElements(node, predicate, result = []) {
  if (Array.isArray(node)) {
    for (const child of node) {
      findElements(child, predicate, result);
    }
    return result;
  }

  if (!node || typeof node !== "object") {
    return result;
  }

  if (predicate(node)) {
    result.push(node);
  }

  findElements(node.props?.children, predicate, result);
  return result;
}

test("ProductCard wires the same open callback to image and title links", async () => {
  const { ProductCard } = evaluateTypeScript(
    await readSource("src/entities/products/ui/product-card.tsx"),
    {
      "@/shared/constants": {
        routes: { product: (categorySlug, slug) => `/catalog/${categorySlug}/${slug}` },
      },
      "@/shared/lib": {
        cn: (...values) => values.filter(Boolean).join(" "),
        shouldBypassNextImageOptimization: () => false,
      },
      "@/shared/ui": { Badge: "Badge" },
      "@/shared/ui/aspect-ratio": { AspectRatio: "AspectRatio" },
      "@/shared/ui/card": {
        Card: "Card",
        CardContent: "CardContent",
        CardDescription: "CardDescription",
        CardFooter: "CardFooter",
        CardTitle: "CardTitle",
      },
      "@/shared/ui/link": { Link: "ProductLink" },
      "next/image": "Image",
    },
  );
  const product = createProduct();
  const clicked = [];
  const onOpen = (event) => clicked.push(event);
  const tree = ProductCard({ product, onOpen });
  const links = findElements(tree, (node) => node.type === "ProductLink");

  assert.equal(links.length, 2);
  assert.deepEqual(
    links.map((link) => link.props.href),
    ["/catalog/markery/markery-artmate-168", "/catalog/markery/markery-artmate-168"],
  );

  const imageClick = { source: "image" };
  const titleClick = { source: "title" };
  links[0].props.onClick(imageClick);
  links[1].props.onClick(titleClick);
  assert.deepEqual(clicked, [imageClick, titleClick]);
});

async function createAddMutationHarness({ actionResult, ensuredCart, previousCart }) {
  const cartQuery = { getCart: () => ({ queryKey: ["cart"] }) };
  const analyticsCalls = [];
  const cacheWrites = [];
  const invalidations = [];
  const actionInputs = [];
  let mutationOptions;
  const queryClient = {
    getQueryData(queryKey) {
      assert.deepEqual(queryKey, ["cart"]);
      return previousCart;
    },
    ensureQueryData(options) {
      assert.deepEqual(options.queryKey, ["cart"]);
      return Promise.resolve(ensuredCart);
    },
    setQueryData(queryKey, value) {
      cacheWrites.push([queryKey, value]);
    },
    invalidateQueries(options) {
      invalidations.push(options);
      return Promise.resolve();
    },
  };
  const cartMutation = evaluateTypeScript(
    await readSource("src/features/cart/model/cart-mutation.ts"),
    { "@/entities/cart": { cartQuery } },
  );
  const reactQuery = {
    useQueryClient: () => queryClient,
    useMutation(options) {
      mutationOptions = options;
      return {
        isPending: false,
        async mutateAsync(input) {
          const data = await options.mutationFn(input);
          await options.onSuccess?.(data, input);
          return data;
        },
      };
    },
  };
  const analytics = {
    cartItemAdded(...args) {
      analyticsCalls.push(args);
    },
  };
  const addMutationModule = evaluateTypeScript(
    await readSource("src/features/cart/model/use-add-cart-item.ts"),
    {
      "../lib/analytics": { useAnalytics: () => analytics },
      "./cart-mutation": cartMutation,
      "@/entities/cart": { cartQuery },
      "@/shared/actions/cart": {
        async addCartItem(input) {
          actionInputs.push(input);
          return actionResult;
        },
      },
      "@/shared/lib/api-result": {
        ApiResult: {
          fromDTO(dto) {
            return {
              unwrap() {
                if (!dto.ok) {
                  throw new Error(dto.error);
                }
                return dto.value;
              },
            };
          },
        },
      },
      "@/shared/lib/query-keys": { cartPricingQueryKey: ["cart-pricing"] },
      "@tanstack/react-query": reactQuery,
      react: { useCallback: (callback) => callback },
    },
  );

  const createMutation = addMutationModule.useAddCartItemMutation;

  const mutation = createMutation();

  return {
    ...mutation,
    actionInputs,
    analyticsCalls,
    cacheWrites,
    invalidations,
    mutationScope: mutationOptions.scope,
  };
}

test("add mutation emits analytics only after a successful unwrapped response", async () => {
  const input = { productId: "product-1", quantity: 2 };
  const previousCart = createCart([]);
  const confirmedCart = createCart([createCartItem({ quantity: 2, lineTotal: 10_980 })]);
  const success = await createAddMutationHarness({
    actionResult: { ok: true, value: confirmedCart },
    ensuredCart: previousCart,
    previousCart: undefined,
  });

  assert.equal(success.isPending, false);
  assert.equal(await success.mutate(input), confirmedCart);
  assert.deepEqual(success.actionInputs, [input]);
  assert.deepEqual(success.analyticsCalls, [[confirmedCart, input, previousCart]]);
  assert.deepEqual(success.cacheWrites, [[["cart"], confirmedCart]]);
  assert.deepEqual(success.invalidations, [{ queryKey: ["cart-pricing"] }]);
  assert.deepEqual(success.mutationScope, { id: "cart" });

  const failure = await createAddMutationHarness({
    actionResult: { ok: false, error: "server rejected add" },
    previousCart,
  });

  await assert.rejects(() => failure.mutate(input), /server rejected add/);
  assert.deepEqual(failure.actionInputs, [input]);
  assert.deepEqual(failure.analyticsCalls, []);
  assert.deepEqual(failure.cacheWrites, []);
  assert.deepEqual(failure.invalidations, []);
});
