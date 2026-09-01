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

async function loadCheckoutAnalytics(sharedAnalytics) {
  return evaluateTypeScript(await readSource("src/features/checkout/lib/analytics.ts"), {
    "@/shared/lib/analytics": sharedAnalytics,
  });
}

function createStorage() {
  const values = new Map();

  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function createAnalyticsWindow({ clearInterval, localStorage, sessionStorage, setInterval } = {}) {
  return {
    dataLayer: [],
    document: {
      getElementById() {
        return null;
      },
    },
    clearInterval: clearInterval ?? (() => undefined),
    localStorage: localStorage ?? createStorage(),
    sessionStorage: sessionStorage ?? createStorage(),
    setInterval: setInterval ?? (() => 1),
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

function createCart(items = [createCartItem()], overrides = {}) {
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

  return {
    id: "cart-checkout-1",
    items,
    itemsCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal,
    total: subtotal,
    currency: "RUB",
    isOzonDeliveryAvailable: true,
    ...overrides,
  };
}

function createCartItem(overrides = {}) {
  return {
    id: "markers-168",
    title: "Маркеры Artmate 168",
    slug: "markery-artmate-168",
    price: 5_490,
    category: "Маркеры",
    categorySlug: "markery",
    image: "https://cdn.example/markers.webp",
    quantity: 1,
    lineTotal: 5_490,
    ...overrides,
  };
}

function createOrder(overrides = {}) {
  const items = overrides.items ?? [
    createCartItem({ quantity: 2, lineTotal: 10_980 }),
    createCartItem({
      id: "sketchbook-a4",
      title: "Скетчбук Artmate A4",
      slug: "sketchbook-a4",
      price: 1_290,
      category: "Скетчбуки",
      categorySlug: "sketchbooks",
      image: "https://cdn.example/sketchbook.webp",
      quantity: 1,
      lineTotal: 1_290,
    }),
  ];

  return {
    id: "order-checkout-1",
    cartId: "cart-checkout-1",
    status: "paid",
    customer: {
      name: "PII NAME MUST NOT LEAK",
      phone: "+7 999 000-00-00",
      email: "pii-buyer@example.com",
    },
    delivery: {
      provider: "ozon",
      pickupPoint: {
        id: "pickup-secret",
        title: "Пункт выдачи",
        address: "PII DELIVERY ADDRESS MUST NOT LEAK",
        workHours: "10:00-22:00",
        deliveryPrice: 780,
      },
    },
    payment: {
      method: "ozon_acquiring",
      status: "paid",
      redirectUrl: "https://bank.example/pay?accessToken=must-not-leak",
    },
    shipments: [],
    itemsCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: 12_270,
    discount: 1_270,
    promoCode: "  WELCOME10  ",
    deliveryPrice: 780,
    total: 11_780,
    currency: "RUB",
    comment: "PII COMMENT MUST NOT LEAK",
    createdAt: "2026-09-01T12:00:00.000Z",
    paidAt: "2026-09-01T12:05:00.000Z",
    ...overrides,
    items,
  };
}

function beginCheckoutEvent(cart) {
  return {
    event: "begin_checkout",
    cart_id: cart.id,
    items_count: cart.itemsCount,
    value: cart.total,
    currency: "RUB",
  };
}

function orderCreatedEvent(order) {
  return {
    event: "order_created",
    order_id: order.id.trim(),
    items_count: order.itemsCount,
    order_price: order.subtotal - order.discount,
    currency: "RUB",
  };
}

function orderPaidEvents(order) {
  const orderId = order.id.trim();
  const revenue = order.subtotal - order.discount;
  const coupon = order.promoCode?.trim();

  return [
    {
      event: "order_paid",
      order_id: orderId,
      items_count: order.itemsCount,
      order_price: revenue,
      currency: "RUB",
    },
    {
      ecommerce: {
        currencyCode: "RUB",
        purchase: {
          actionField: {
            id: orderId,
            revenue,
            ...(coupon ? { coupon } : {}),
          },
          products: order.items.map((item) => ({
            id: item.id,
            name: item.title,
            price: item.price,
            quantity: item.quantity,
            ...(item.category ? { category: item.category } : {}),
          })),
        },
      },
    },
  ];
}

function createHookHarness({ strictEffects = false } = {}) {
  let instance = createInstance();

  function createInstance() {
    return { cursor: 0, refs: [] };
  }

  return {
    newInstance() {
      instance = createInstance();
    },
    react: {
      useEffect(effect) {
        effect();

        if (strictEffects) {
          effect();
        }
      },
      useRef(initialValue) {
        const index = instance.cursor++;

        if (!instance.refs[index]) {
          instance.refs[index] = { current: initialValue };
        }

        return instance.refs[index];
      },
    },
    render(hook, argument) {
      instance.cursor = 0;
      return hook(argument);
    },
  };
}

function createComponentHarness() {
  const instances = new Map();
  const pendingEffects = [];
  let currentInstance;

  function getInstance(key) {
    if (!instances.has(key)) {
      instances.set(key, { cursor: 0, effects: [], memoized: [], refs: [], states: [] });
    }

    return instances.get(key);
  }

  function dependenciesChanged(previous, next) {
    return (
      !previous ||
      !next ||
      previous.length !== next.length ||
      previous.some((value, index) => !Object.is(value, next[index]))
    );
  }

  const react = {
    useEffect(effect, dependencies) {
      const instance = currentInstance;
      const index = instance.cursor++;
      const previous = instance.effects[index];

      if (!dependenciesChanged(previous?.dependencies, dependencies)) {
        return;
      }

      instance.effects[index] = {
        cleanup: previous?.cleanup,
        dependencies,
      };
      pendingEffects.push({ effect, index, instance });
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
    flushEffects() {
      while (pendingEffects.length > 0) {
        const { effect, index, instance } = pendingEffects.shift();
        instance.effects[index]?.cleanup?.();
        instance.effects[index].cleanup = effect();
      }
    },
    react,
    render(Component, props, key = Component) {
      const previousInstance = currentInstance;
      const instance = getInstance(key);
      instance.cursor = 0;
      currentInstance = instance;

      try {
        return Component(props);
      } finally {
        currentInstance = previousInstance;
      }
    },
    unmount(key) {
      const instance = instances.get(key);

      for (const effect of instance?.effects ?? []) {
        effect?.cleanup?.();
      }

      instances.delete(key);
    },
  };
}

function findElement(node, predicate) {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if (predicate(node)) {
    return node;
  }

  const children = Array.isArray(node) ? node : node.props?.children;

  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findElement(child, predicate);

    if (found) {
      return found;
    }
  }

  return undefined;
}

test("refreshOnMount overrides the cached-error retry policy", async () => {
  const queryOptionsCalls = [];
  const queryResult = {
    data: undefined,
    isError: true,
    isFetchedAfterMount: true,
    isPending: false,
    isSuccess: false,
  };
  const { useCartData } = evaluateTypeScript(
    await readSource("src/entities/cart/model/use-cart-data.ts"),
    {
      "./query": {
        cartQuery: {
          getCart: () => ({
            queryKey: ["cart", "data"],
            refetchOnMount: false,
            retryOnMount: false,
            staleTime: 30_000,
          }),
        },
      },
      "@tanstack/react-query": {
        useQuery: (options) => {
          queryOptionsCalls.push(options);
          return queryResult;
        },
      },
    },
  );

  assert.deepEqual(useCartData(), queryResult);
  assert.deepEqual(useCartData({ refreshOnMount: true }), queryResult);
  assert.equal(queryOptionsCalls[0].retryOnMount, false);
  assert.equal(queryOptionsCalls[0].refetchOnMount, false);
  assert.equal(queryOptionsCalls[1].retryOnMount, true);
  assert.equal(queryOptionsCalls[1].refetchOnMount, "always");
  assert.deepEqual(queryOptionsCalls[1].queryKey, ["cart", "data"]);
});

test("checkout surfaces first fresh failure and latches a verified cart across background recovery", async () => {
  const cartHookOptions = [];
  const componentHarness = createComponentHarness();
  const sharedAnalytics = await loadSharedAnalytics();
  const checkoutAnalytics = await loadCheckoutAnalytics(sharedAnalytics);
  const checkoutStartTracker = evaluateTypeScript(
    await readSource("src/features/checkout/lib/use-track-checkout-start.ts"),
    {
      "./analytics": checkoutAnalytics,
      react: componentHarness.react,
    },
  );
  const freshCart = createCart();
  let cartState = {
    data: freshCart,
    isError: false,
    isFetchedAfterMount: false,
    isPending: false,
    isSuccess: false,
  };
  const jsx = (type, props, key) => ({ key, props, type });
  const component = (name) => name;
  const { Checkout } = evaluateTypeScript(
    await readSource("src/features/checkout/ui/checkout.tsx"),
    {
      "../lib": {
        transitionCheckoutAuthConfirmation: (state) => state,
      },
      "../lib/use-track-checkout-start": checkoutStartTracker,
      "../model": {
        useCreateOrderMutation: () => ({ createOrder() {}, error: null, isPending: false }),
      },
      "./checkout-flow": { CheckoutFlow: component("CheckoutFlow") },
      "@/entities/cart": {
        useCartData: (options) => {
          cartHookOptions.push(options);
          return cartState;
        },
      },
      "@/entities/orders": {
        getPreferredCustomerPhone: () => undefined,
        useOrdersData: () => ({ data: [], isError: false }),
      },
      "@/entities/session": { useUser: () => undefined },
      "@/features/auth": { AuthForm: component("AuthForm") },
      "@/features/promocode": {
        usePromocode: () => ({ clearCode() {} }),
        withPromocode: (Component) => Component,
      },
      "@/shared/constants": { routes: { cart: "/cart", catalog: "/catalog" } },
      "@/shared/ui": {
        Button: component("Button"),
        DataState: component("DataState"),
        Dialog: component("Dialog"),
        DialogContent: component("DialogContent"),
        DialogDescription: component("DialogDescription"),
        DialogHeader: component("DialogHeader"),
        DialogTitle: component("DialogTitle"),
      },
      "@/shared/ui/link": { Link: component("Link") },
      "@/shared/ui/typography": { PageTitle: component("PageTitle") },
      "lucide-react": {
        ArrowLeft: component("ArrowLeft"),
        ShoppingBag: component("ShoppingBag"),
      },
      "next/navigation": { useRouter: () => ({ push() {} }) },
      react: componentHarness.react,
      "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
    },
  );
  const analyticsWindow = createAnalyticsWindow();
  const renderCheckout = () => componentHarness.render(Checkout, undefined, "checkout");
  const renderLoadedCheckout = (tree) => {
    assert.equal(typeof tree.type, "function");
    componentHarness.render(tree.type, tree.props, "loaded-checkout");
  };

  await withWindow(analyticsWindow, () => {
    const waitingForFreshRead = renderCheckout();
    componentHarness.flushEffects();
    const loadingState = findElement(
      waitingForFreshRead,
      (node) => node.type === "DataState" && node.props.title === "Готовим оформление",
    );
    assert.ok(loadingState, "cached data must wait for its first post-mount refresh");
    assert.deepEqual(analyticsWindow.dataLayer, []);

    cartState = {
      data: undefined,
      isError: true,
      isFetchedAfterMount: true,
      isPending: false,
      isSuccess: false,
    };
    const failedFreshRead = renderCheckout();
    componentHarness.flushEffects();
    const errorState = findElement(
      failedFreshRead,
      (node) => node.type === "DataState" && node.props.variant === "error",
    );
    assert.ok(errorState, "first failed post-mount read must render the error state");

    cartState = {
      data: createCart([]),
      isError: false,
      isFetchedAfterMount: true,
      isPending: false,
      isSuccess: true,
    };
    const beforeEmptyLatch = renderCheckout();
    assert.ok(findElement(beforeEmptyLatch, (node) => node.type === "DataState"));
    componentHarness.flushEffects();
    const emptyCheckout = renderCheckout();
    const emptyState = findElement(
      emptyCheckout,
      (node) => node.type === "DataState" && node.props.title === "Корзина пуста",
    );
    assert.ok(emptyState, "a verified empty cart must render the empty state");

    cartState = {
      data: freshCart,
      isError: false,
      isFetchedAfterMount: true,
      isPending: false,
      isSuccess: true,
    };
    renderCheckout();
    componentHarness.flushEffects();
    const loadedCheckout = renderCheckout();
    renderLoadedCheckout(loadedCheckout);
    componentHarness.flushEffects();
    assert.deepEqual(analyticsWindow.dataLayer, [beginCheckoutEvent(freshCart)]);

    cartState = {
      data: freshCart,
      isError: true,
      isFetchedAfterMount: true,
      isPending: false,
      isSuccess: false,
    };
    const duringBackgroundError = renderCheckout();
    renderLoadedCheckout(duringBackgroundError);
    componentHarness.flushEffects();
    assert.deepEqual(analyticsWindow.dataLayer, [beginCheckoutEvent(freshCart)]);

    const recoveredCart = createCart(undefined, { total: 5_190 });
    cartState = {
      data: recoveredCart,
      isError: false,
      isFetchedAfterMount: true,
      isPending: false,
      isSuccess: true,
    };
    const beforeRecoveryLatch = renderCheckout();
    renderLoadedCheckout(beforeRecoveryLatch);
    componentHarness.flushEffects();
    const afterRecoveryLatch = renderCheckout();
    renderLoadedCheckout(afterRecoveryLatch);
    componentHarness.flushEffects();
    assert.deepEqual(analyticsWindow.dataLayer, [beginCheckoutEvent(freshCart)]);
  });

  assert.ok(cartHookOptions.length >= 7);
  assert.ok(cartHookOptions.every((options) => options.refreshOnMount === true));
});

test("begin_checkout sends the exact payload once in StrictMode and again on re-entry", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const checkoutAnalytics = await loadCheckoutAnalytics(sharedAnalytics);
  const hookHarness = createHookHarness({ strictEffects: true });
  const { useTrackCheckoutStart } = evaluateTypeScript(
    await readSource("src/features/checkout/lib/use-track-checkout-start.ts"),
    {
      "./analytics": checkoutAnalytics,
      react: hookHarness.react,
    },
  );
  const cart = createCart(undefined, {
    email: "must-not-leak@example.com",
    total: 4_990,
  });
  const analyticsWindow = createAnalyticsWindow();

  await withWindow(analyticsWindow, () => {
    hookHarness.render(useTrackCheckoutStart, undefined);
    hookHarness.render(useTrackCheckoutStart, createCart([]));
    hookHarness.render(useTrackCheckoutStart, cart);
    hookHarness.render(useTrackCheckoutStart, cart);

    assert.deepEqual(analyticsWindow.dataLayer, [beginCheckoutEvent(cart)]);

    hookHarness.newInstance();
    hookHarness.render(useTrackCheckoutStart, cart);
  });

  assert.deepEqual(analyticsWindow.dataLayer, [beginCheckoutEvent(cart), beginCheckoutEvent(cart)]);
  assert.equal(
    JSON.stringify(analyticsWindow.dataLayer).includes("must-not-leak@example.com"),
    false,
  );
});

async function createOrderMutationHarness({ actionResult, analytics, onSuccess }) {
  const cacheWrites = [];
  const invalidations = [];
  let mutationOptions;
  const queryClient = {
    invalidateQueries(options) {
      invalidations.push(options);
      return Promise.resolve();
    },
    setQueryData(queryKey, value) {
      cacheWrites.push([queryKey, value]);
    },
  };
  const { useCreateOrderMutation } = evaluateTypeScript(
    await readSource("src/features/checkout/model/use-create-order.ts"),
    {
      "../lib/analytics": { useAnalytics: () => analytics },
      "@/entities/cart": { cartQuery: { getCart: () => ({ queryKey: ["cart"] }) } },
      "@/shared/actions/orders": { createOrder: async () => actionResult },
      "@/shared/lib/api-result": {
        ApiResult: {
          fromDTO(dto) {
            return {
              unwrap() {
                if (dto.error) {
                  throw new Error(dto.error);
                }

                return dto.value;
              },
            };
          },
        },
      },
      "@/shared/lib/query-keys": { cartPricingQueryKey: ["cart-pricing"] },
      "@tanstack/react-query": {
        useMutation(options) {
          mutationOptions = options;
          const run = async (input) => {
            try {
              const result = await options.mutationFn(input);
              await options.onSuccess?.(result);
              return result;
            } catch (error) {
              await options.onError?.(error);
              throw error;
            }
          };

          return {
            error: null,
            isPending: false,
            mutate: (input) => void run(input),
            mutateAsync: run,
          };
        },
        useQueryClient: () => queryClient,
      },
    },
  );

  const createMutation = useCreateOrderMutation;

  return {
    ...createMutation({ onSuccess }),
    cacheWrites,
    invalidations,
    mutationOptions,
  };
}

test("order creation tracks confirmed success before its callback and skips error or undefined", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const checkoutAnalytics = await loadCheckoutAnalytics(sharedAnalytics);
  const analytics = checkoutAnalytics.useAnalytics();
  const order = createOrder({
    id: "order-created-success",
    deliveryPrice: 2_300,
    total: 13_300,
  });
  const analyticsWindow = createAnalyticsWindow();
  const callbackValues = [];

  await withWindow(analyticsWindow, async () => {
    const success = await createOrderMutationHarness({
      actionResult: { value: order },
      analytics,
      onSuccess: (createdOrder) => {
        assert.deepEqual(analyticsWindow.dataLayer, [orderCreatedEvent(order)]);
        callbackValues.push(createdOrder);
      },
    });

    assert.equal(await success.createOrderAsync({ acceptedLegal: true }), order);
    assert.deepEqual(callbackValues, [order]);
    assert.deepEqual(success.cacheWrites, [[["cart"], null]]);
    assert.deepEqual(success.invalidations, [{ queryKey: ["cart-pricing"] }]);

    const eventCountAfterSuccess = analyticsWindow.dataLayer.length;
    const failed = await createOrderMutationHarness({
      actionResult: { error: "order creation rejected" },
      analytics,
    });
    await assert.rejects(
      () => failed.createOrderAsync({ acceptedLegal: true }),
      /order creation rejected/,
    );
    assert.equal(analyticsWindow.dataLayer.length, eventCountAfterSuccess);

    const empty = await createOrderMutationHarness({
      actionResult: { value: undefined },
      analytics,
    });
    assert.equal(await empty.createOrderAsync({ acceptedLegal: true }), undefined);
    assert.equal(analyticsWindow.dataLayer.length, eventCountAfterSuccess);
  });
});

test("order_created is deduplicated per order for the browser session", async () => {
  const sessionStorage = createStorage();
  const analyticsWindow = createAnalyticsWindow({ sessionStorage });
  const firstOrder = createOrder({ id: "order-created-session-1" });
  const secondOrder = createOrder({ id: "order-created-session-2" });

  await withWindow(analyticsWindow, async () => {
    const firstSharedAnalytics = await loadSharedAnalytics();
    const firstCheckoutAnalytics = await loadCheckoutAnalytics(firstSharedAnalytics);
    firstCheckoutAnalytics.useAnalytics().orderCreated(firstOrder);
    firstCheckoutAnalytics.useAnalytics().orderCreated(firstOrder);

    const reloadedSharedAnalytics = await loadSharedAnalytics();
    const reloadedCheckoutAnalytics = await loadCheckoutAnalytics(reloadedSharedAnalytics);
    reloadedCheckoutAnalytics.useAnalytics().orderCreated(firstOrder);
    reloadedCheckoutAnalytics.useAnalytics().orderCreated(secondOrder);
  });

  assert.deepEqual(analyticsWindow.dataLayer, [
    orderCreatedEvent(firstOrder),
    orderCreatedEvent(secondOrder),
  ]);
});

test("order_paid requires a full paid order and ignores pending, failed, and status-only data", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const checkoutAnalytics = await loadCheckoutAnalytics(sharedAnalytics);
  const react = { useEffect: (effect) => effect() };
  const paidOrderTracker = evaluateTypeScript(
    await readSource("src/features/checkout/lib/use-track-paid-order.ts"),
    {
      "./analytics": checkoutAnalytics,
      react,
    },
  );
  const pendingOrder = createOrder({
    id: "order-pending",
    payment: {
      method: "ozon_acquiring",
      status: "pending",
      redirectUrl: "https://bank.example/pending",
    },
    status: "waiting_payment",
  });
  const failedOrder = createOrder({
    id: "order-failed",
    payment: {
      method: "ozon_acquiring",
      status: "failed",
      redirectUrl: "",
    },
    status: "cancelled",
  });
  const paidOrder = createOrder({ id: "order-full-paid" });
  const intervalCallbacks = [];
  const analyticsWindow = createAnalyticsWindow({
    setInterval(callback, delay) {
      assert.equal(delay, 3_000);
      intervalCallbacks.push(callback);
      return intervalCallbacks.length;
    },
  });
  const invalidations = [];
  const jsx = (type, props, key) => ({ key, props, type });
  const statusOnlyPaid = {
    orderId: pendingOrder.id,
    status: "paid",
    paymentStatus: "paid",
  };
  const { CheckoutSuccess } = evaluateTypeScript(
    await readSource("src/features/checkout/ui/success.tsx"),
    {
      "../lib/checkout-success": { getOrderLoadErrorMessage: () => "load error" },
      "../lib/use-track-paid-order": paidOrderTracker,
      "./success-details": { CheckoutSuccessDetails: "CheckoutSuccessDetails" },
      "./success-state": { CheckoutSuccessState: "CheckoutSuccessState" },
      "@/entities/orders": {
        ordersQuery: { getOrder: (orderId) => ({ queryKey: ["orders", orderId] }) },
        useOrderData: () => ({
          data: pendingOrder,
          error: null,
          isError: false,
          isPending: false,
        }),
        useOrderStatusData: () => ({
          data: statusOnlyPaid,
          isError: false,
          isFetching: false,
          isPending: false,
        }),
      },
      "@tanstack/react-query": {
        useQueryClient: () => ({
          invalidateQueries: (...args) => {
            invalidations.push(args);
            return Promise.resolve();
          },
        }),
      },
      react,
      "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
    },
  );

  await withWindow(analyticsWindow, () => {
    paidOrderTracker.useTrackPaidOrder(undefined);
    paidOrderTracker.useTrackPaidOrder(pendingOrder);
    paidOrderTracker.useTrackPaidOrder(failedOrder);
    CheckoutSuccess({ orderId: pendingOrder.id });

    assert.deepEqual(analyticsWindow.dataLayer, []);
    assert.equal(intervalCallbacks.length, 1);
    intervalCallbacks[0]();

    paidOrderTracker.useTrackPaidOrder(paidOrder);
  });

  assert.deepEqual(analyticsWindow.dataLayer, orderPaidEvents(paidOrder));
  assert.deepEqual(invalidations, [
    [{ queryKey: ["orders", pendingOrder.id] }, { cancelRefetch: false }],
    [{ queryKey: ["orders", pendingOrder.id] }, { cancelRefetch: false }],
  ]);
});

test("paid order sends exact safe goal and purchase payloads without delivery or PII", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const checkoutAnalytics = await loadCheckoutAnalytics(sharedAnalytics);
  const order = createOrder({ id: "  order-paid-exact  " });
  const analyticsWindow = createAnalyticsWindow();

  await withWindow(analyticsWindow, () => checkoutAnalytics.useAnalytics().orderPaid(order));

  assert.deepEqual(analyticsWindow.dataLayer, orderPaidEvents(order));
  const serialized = JSON.stringify(analyticsWindow.dataLayer);
  assert.equal(serialized.includes(String(order.deliveryPrice)), false);
  assert.equal(serialized.includes(order.customer.email), false);
  assert.equal(serialized.includes(order.customer.phone), false);
  assert.equal(serialized.includes(order.customer.name), false);
  assert.equal(serialized.includes(order.delivery.pickupPoint.address), false);
  assert.equal(serialized.includes(order.payment.redirectUrl), false);
});

test("invalid paid-order products block purchase without blocking the order_paid goal", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const checkoutAnalytics = await loadCheckoutAnalytics(sharedAnalytics);
  const order = createOrder({
    id: "order-paid-invalid-products",
    items: [
      createCartItem({
        id: " ",
        lineTotal: 12_270,
        quantity: 3,
      }),
    ],
  });
  const analyticsWindow = createAnalyticsWindow();

  await withWindow(analyticsWindow, () => checkoutAnalytics.useAnalytics().orderPaid(order));

  assert.deepEqual(analyticsWindow.dataLayer, [
    {
      event: "order_paid",
      order_id: order.id,
      items_count: order.itemsCount,
      order_price: order.subtotal - order.discount,
      currency: "RUB",
    },
  ]);
});

test("order_paid and purchase use localStorage dedupe across reloads while a new order works", async () => {
  const localStorage = createStorage();
  const analyticsWindow = createAnalyticsWindow({ localStorage });
  const firstOrder = createOrder({ id: "order-paid-local-1" });
  const secondOrder = createOrder({ id: "order-paid-local-2", promoCode: null });

  await withWindow(analyticsWindow, async () => {
    const firstSharedAnalytics = await loadSharedAnalytics();
    const firstCheckoutAnalytics = await loadCheckoutAnalytics(firstSharedAnalytics);
    firstCheckoutAnalytics.useAnalytics().orderPaid(firstOrder);

    const reloadedSharedAnalytics = await loadSharedAnalytics();
    const reloadedCheckoutAnalytics = await loadCheckoutAnalytics(reloadedSharedAnalytics);
    reloadedCheckoutAnalytics.useAnalytics().orderPaid(firstOrder);
    reloadedCheckoutAnalytics.useAnalytics().orderPaid(secondOrder);
  });

  assert.deepEqual(analyticsWindow.dataLayer, [
    ...orderPaidEvents(firstOrder),
    ...orderPaidEvents(secondOrder),
  ]);
});
