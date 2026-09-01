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

async function loadWelcomeBonusAnalytics(sharedAnalytics) {
  const promocodeSelectors = evaluateTypeScript(
    await readSource("src/entities/promocode/lib/welcome-offer-selectors.ts"),
  );

  return evaluateTypeScript(await readSource("src/features/welcome-bonus/lib/analytics.ts"), {
    "@/entities/promocode": promocodeSelectors,
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

function createAnalyticsWindow({
  localStorage = createStorage(),
  sessionStorage = createStorage(),
} = {}) {
  return {
    dataLayer: [],
    document: {
      getElementById() {
        return null;
      },
    },
    localStorage,
    sessionStorage,
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

function createOffer(overrides = {}) {
  return {
    action: "authorize",
    amount: null,
    discountPercent: 20,
    endsAt: "2999-01-01T00:00:00.000Z",
    maxDiscount: null,
    minSubtotal: 0,
    ...overrides,
  };
}

function promotionPayload(action, creative = "authorize") {
  return {
    ecommerce: {
      currencyCode: "RUB",
      [action]: {
        promotions: [
          {
            id: "welcome-bonus",
            name: "Приветственный бонус",
            creative,
            position: "floating-card",
          },
        ],
      },
    },
  };
}

function createHookHarness() {
  const effects = [];
  const pendingEffects = [];
  const refs = [];
  const states = [];
  let cursor = 0;

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
      const index = cursor++;
      const previous = effects[index];

      if (!dependenciesChanged(previous?.dependencies, dependencies)) {
        return;
      }

      effects[index] = { cleanup: previous?.cleanup, dependencies };
      pendingEffects.push({ effect, index });
    },
    useRef(initialValue) {
      const index = cursor++;

      if (!refs[index]) {
        refs[index] = { current: initialValue };
      }

      return refs[index];
    },
    useState(initialValue) {
      const index = cursor++;

      if (!(index in states)) {
        states[index] = typeof initialValue === "function" ? initialValue() : initialValue;
      }

      return [
        states[index],
        (nextValue) => {
          states[index] = typeof nextValue === "function" ? nextValue(states[index]) : nextValue;
        },
      ];
    },
    useSyncExternalStore(_subscribe, getSnapshot) {
      cursor += 1;
      return getSnapshot();
    },
  };

  return {
    flushEffects() {
      while (pendingEffects.length > 0) {
        const { effect, index } = pendingEffects.shift();
        effects[index]?.cleanup?.();
        effects[index].cleanup = effect();
      }
    },
    react,
    render(hook) {
      cursor = 0;
      return hook();
    },
  };
}

function createDocument() {
  return {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
}

function findElements(node, predicate, matches = []) {
  if (!node || typeof node !== "object") {
    return matches;
  }

  if (predicate(node)) {
    matches.push(node);
  }

  const children = Array.isArray(node) ? node : node.props?.children;

  for (const child of Array.isArray(children) ? children : [children]) {
    findElements(child, predicate, matches);
  }

  return matches;
}

test("welcome promoView is exact, survives same-tab remount, and resets on a new Moscow day", async () => {
  const sessionStorage = createStorage();
  const analyticsWindow = createAnalyticsWindow({ sessionStorage });

  await withWindow(analyticsWindow, async () => {
    const firstSharedAnalytics = await loadSharedAnalytics();
    const firstModule = await loadWelcomeBonusAnalytics(firstSharedAnalytics);
    const offer = createOffer();

    firstModule.useAnalytics().promotionPresented({ dayKey: "2026-09-01", offer });
    firstModule.useAnalytics().promotionPresented({ dayKey: "2026-09-01", offer });
    assert.deepEqual(analyticsWindow.dataLayer, [promotionPayload("promoView")]);

    const remountedSharedAnalytics = await loadSharedAnalytics();
    const remountedModule = await loadWelcomeBonusAnalytics(remountedSharedAnalytics);
    remountedModule.useAnalytics().promotionPresented({ dayKey: "2026-09-01", offer });
    assert.deepEqual(analyticsWindow.dataLayer, [promotionPayload("promoView")]);

    remountedModule.useAnalytics().promotionPresented({ dayKey: "2026-09-02", offer });
    assert.deepEqual(analyticsWindow.dataLayer, [
      promotionPayload("promoView"),
      promotionPayload("promoView"),
    ]);
  });
});

test("a genuine welcome presentation in another tab is counted separately", async () => {
  const firstTab = createAnalyticsWindow();
  const secondTab = createAnalyticsWindow();
  const offer = createOffer();

  await withWindow(firstTab, async () => {
    const sharedAnalytics = await loadSharedAnalytics();
    const { useAnalytics } = await loadWelcomeBonusAnalytics(sharedAnalytics);
    useAnalytics().promotionPresented({ dayKey: "2026-09-02", offer });
  });
  await withWindow(secondTab, async () => {
    const sharedAnalytics = await loadSharedAnalytics();
    const { useAnalytics } = await loadWelcomeBonusAnalytics(sharedAnalytics);
    useAnalytics().promotionPresented({ dayKey: "2026-09-02", offer });
  });

  assert.deepEqual(firstTab.dataLayer, [promotionPayload("promoView")]);
  assert.deepEqual(secondTab.dataLayer, [promotionPayload("promoView")]);
});

test("welcome CTA emits one promoClick and one goal without promotion data in dismiss flows", async () => {
  const analyticsWindow = createAnalyticsWindow();

  await withWindow(analyticsWindow, async () => {
    const sharedAnalytics = await loadSharedAnalytics();
    const { useAnalytics } = await loadWelcomeBonusAnalytics(sharedAnalytics);
    const offer = createOffer({ action: "link_telegram" });

    useAnalytics().promotionClicked({ dayKey: "2026-09-03", offer });
    useAnalytics().promotionClicked({ dayKey: "2026-09-03", offer });

    assert.deepEqual(analyticsWindow.dataLayer, [
      promotionPayload("promoClick", "link_telegram"),
      { event: "welcome_promo_click" },
    ]);
  });
});

test("invalid, expired, and server-side welcome offers do not emit analytics", async () => {
  const analyticsWindow = createAnalyticsWindow();
  const sharedAnalytics = await loadSharedAnalytics();
  const { useAnalytics } = await loadWelcomeBonusAnalytics(sharedAnalytics);
  const expiredOffer = createOffer({ endsAt: "2000-01-01T00:00:00.000Z" });

  await withWindow(analyticsWindow, async () => {
    useAnalytics().promotionPresented({ dayKey: "not-a-day", offer: createOffer() });
    useAnalytics().promotionPresented({ dayKey: "2026-09-04", offer: expiredOffer });
    useAnalytics().promotionClicked({ dayKey: "2026-09-04", offer: expiredOffer });
    assert.deepEqual(analyticsWindow.dataLayer, []);
  });

  useAnalytics().promotionPresented({ dayKey: "2026-09-04", offer: createOffer() });
});

test("welcome hook tracks only the committed presented state and its active CTA", async () => {
  const harness = createHookHarness();
  const offer = createOffer();
  const presented = [];
  const clicked = [];
  let shown = false;
  let dismissed = false;
  let lifecycleState = "idle";
  const analytics = {
    promotionClicked: (payload) => clicked.push(payload),
    promotionPresented: (payload) => presented.push(payload),
  };
  const lifecycleFactory = (options) => ({
    dismiss() {
      if (lifecycleState !== "presented") {
        return;
      }

      options.markDismissed();
      lifecycleState = "ended";
      options.onStateChange("ended");
    },
    dispose() {},
    update(eligibility) {
      if (
        lifecycleState === "idle" &&
        eligibility.canStart &&
        eligibility.isEligible &&
        eligibility.isForeground
      ) {
        options.markShown();
        lifecycleState = "presented";
        options.onStateChange("presented");
      }
    },
  });
  const { useWelcomeBonus } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/use-welcome-bonus.ts"),
    {
      "./analytics": { useAnalytics: () => analytics },
      "./eligibility": { isWelcomeBonusPathEligible: () => true },
      "./moscow-day": {
        getMoscowDayKey: () => "2026-09-05",
      },
      "./moscow-day-rollover": {
        createMoscowDayRollover: ({ onDayChange }) => ({
          dispose() {},
          sync() {
            onDayChange("2026-09-05");
          },
        }),
      },
      "./persistence": {
        markWelcomeBonusDismissedToday: () => {
          dismissed = true;
        },
        markWelcomeBonusShownToday: () => {
          shown = true;
        },
        wasWelcomeBonusDismissedToday: () => dismissed,
        wasWelcomeBonusShownToday: () => shown,
      },
      "./welcome-bonus-lifecycle": {
        canPresentWelcomeBonusNow: () => true,
        createWelcomeBonusLifecycle: lifecycleFactory,
        shouldRequestWelcomeOffer: ({ canStart, isBaseEligible, state }) =>
          isBaseEligible && state !== "ended" && (canStart || state === "presented"),
      },
      "@/entities/feature-banners": {
        featureBannerSlugs: { welcomeBonus: "welcome-bonus" },
        getFeatureBannersBySlug: () => ({ "welcome-bonus": { id: "flag" } }),
        useFeatureBanners: () => ({ banners: [{ id: "flag", slug: "welcome-bonus" }] }),
      },
      "@/entities/promocode": {
        useWelcomeOffer: ({ enabled }) => ({ data: enabled ? offer : undefined }),
      },
      "@/entities/session": {
        useSession: () => ({ isPending: false, user: undefined }),
      },
      "@/shared/lib/cookie-consent": {
        useCookieConsent: () => ({ isAccepted: true }),
      },
      "@/shared/lib/query-keys": { getQueryOwner: () => "guest" },
      "next/navigation": { usePathname: () => "/catalog" },
      react: harness.react,
    },
  );
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = createDocument();
  globalThis.window = {
    clearTimeout() {},
    setTimeout() {
      return 1;
    },
  };

  try {
    let result = harness.render(useWelcomeBonus);
    assert.equal(result.isPresented, false);
    assert.deepEqual(presented, []);
    result.dismiss();
    assert.deepEqual(clicked, []);
    harness.flushEffects();

    result = harness.render(useWelcomeBonus);
    assert.equal(result.isPresented, false);
    harness.flushEffects();
    assert.deepEqual(presented, []);

    result = harness.render(useWelcomeBonus);
    assert.equal(result.isPresented, true);
    harness.flushEffects();
    assert.equal(presented.length, 1);

    result = harness.render(useWelcomeBonus);
    harness.flushEffects();
    assert.equal(presented.length, 1);
    result.activate();
    assert.equal(clicked.length, 1);
    assert.equal(clicked[0].dayKey, "2026-09-05");
    assert.equal(dismissed, true);
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }

    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test("welcome card wires analytics activation only to the primary CTA", async () => {
  const jsx = (type, props, key) => ({ key, props, type });
  const actions = [];
  const dismissals = [];
  const offer = createOffer();
  let welcomeState = {
    activate: () => actions.push("activate"),
    dismiss: () => dismissals.push("dismiss"),
    isPresented: true,
    offer,
  };
  const { WelcomeBonus } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/ui/welcome-bonus.tsx"),
    {
      "../lib": {
        getWelcomeOfferAction: () => ({ href: "/auth", label: "Получить бонус" }),
        getWelcomeOfferCopy: () => ({
          conditions: "",
          description: "Описание",
          discount: "Скидка 20%",
        }),
        useWelcomeBonus: () => welcomeState,
      },
      "@/shared/ui": {
        Button: "Button",
        buttonVariants: () => "button",
      },
      "@/shared/ui/link": { Link: "Link" },
      "lucide-react": { Gift: "Gift", X: "X" },
      "react/jsx-runtime": { Fragment: "Fragment", jsx, jsxs: jsx },
    },
  );
  const tree = WelcomeBonus();
  const links = findElements(tree, (node) => node.type === "Link");
  const buttons = findElements(tree, (node) => node.type === "Button");
  const closeButton = buttons.find(
    (button) => button.props["aria-label"] === "Закрыть приветственный бонус",
  );
  const notNowButton = buttons.find((button) => button.props.children === "Не сейчас");

  assert.equal(links.length, 1);
  links[0].props.onClick();
  closeButton.props.onClick();
  notNowButton.props.onClick();
  assert.deepEqual(actions, ["activate"]);
  assert.deepEqual(dismissals, ["dismiss", "dismiss"]);

  welcomeState = { ...welcomeState, isPresented: false };
  assert.equal(WelcomeBonus(), null);
});
