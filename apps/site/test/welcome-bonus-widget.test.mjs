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

test("welcome bonus excludes protected roots and descendants only", async () => {
  const { isWelcomeBonusPathEligible } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/eligibility.ts"),
  );

  for (const path of [
    "/auth",
    "/auth/reset-password",
    "/account",
    "/account/orders",
    "/cart",
    "/checkout/success",
    "/legal",
    "/legal/promocodes",
  ]) {
    assert.equal(isWelcomeBonusPathEligible(path), false, path);
  }

  for (const path of ["/", "/catalog", "/author", "/cartoon", "/legalese"]) {
    assert.equal(isWelcomeBonusPathEligible(path), true, path);
  }
});

test("welcome bonus uses the 10-second product appearance delay", async () => {
  const welcomeHook = await readSource(
    "src/features/welcome-bonus/lib/use-welcome-bonus.ts",
  );

  assert.match(welcomeHook, /const appearanceDelayMs = 10_000;/u);
  assert.match(welcomeHook, /durationMs: appearanceDelayMs/u);
});

test("foreground timer accumulates only resumed time without sleeping", async () => {
  const { createForegroundTimer } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/foreground-timer.ts"),
  );
  let now = 0;
  let scheduled;
  let elapsedCalls = 0;
  const timer = createForegroundTimer({
    durationMs: 20_000,
    now: () => now,
    schedule: (callback, delay) => {
      scheduled = { callback, delay };
      return 1;
    },
    cancel: () => {
      scheduled = undefined;
    },
    onElapsed: () => {
      elapsedCalls += 1;
    },
  });

  timer.resume();
  assert.equal(scheduled.delay, 20_000);
  now = 7_000;
  timer.pause();
  assert.equal(scheduled, undefined);

  now = 50_000;
  timer.resume();
  assert.equal(scheduled.delay, 13_000);
  scheduled.callback();
  timer.resume();
  assert.equal(elapsedCalls, 1);
});

test("welcome lifecycle pauses before presentation and permanently ends an interrupted presentation", async () => {
  const { createWelcomeBonusLifecycle } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/welcome-bonus-lifecycle.ts"),
    {
      "./foreground-timer": {
        createForegroundTimer: evaluateTypeScript(
          await readSource("src/features/welcome-bonus/lib/foreground-timer.ts"),
        ).createForegroundTimer,
      },
    },
  );
  let now = 0;
  let scheduled;
  let seenCalls = 0;
  const states = [];
  const lifecycle = createWelcomeBonusLifecycle({
    durationMs: 20_000,
    now: () => now,
    schedule: (callback, delay) => {
      scheduled = { callback, delay };
      return 1;
    },
    cancel: () => {
      scheduled = undefined;
    },
    markShown: () => {
      seenCalls += 1;
    },
    markDismissed: () => undefined,
    onStateChange: (state) => states.push(state),
  });

  lifecycle.update({ canStart: true, isEligible: true, isForeground: true, owner: "guest" });
  now = 7_000;
  lifecycle.update({ canStart: true, isEligible: false, isForeground: true, owner: "guest" });
  assert.equal(scheduled, undefined);
  assert.equal(seenCalls, 0);
  assert.equal(lifecycle.getState(), "idle");

  now = 40_000;
  lifecycle.update({ canStart: true, isEligible: true, isForeground: true, owner: "guest" });
  assert.equal(scheduled.delay, 13_000);
  scheduled.callback();
  assert.equal(lifecycle.getState(), "presented");
  assert.equal(seenCalls, 1);

  lifecycle.update({ canStart: false, isEligible: true, isForeground: true, owner: "guest" });
  assert.equal(lifecycle.getState(), "presented");
  lifecycle.update({ canStart: false, isEligible: false, isForeground: true, owner: "guest" });
  assert.equal(lifecycle.getState(), "ended");
  lifecycle.update({ canStart: true, isEligible: true, isForeground: true, owner: "guest" });
  assert.equal(lifecycle.getState(), "ended");
  assert.deepEqual(states, ["presented", "ended"]);
});

test("welcome lifecycle ends a visible presentation on owner change and records dismissal", async () => {
  const { createForegroundTimer } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/foreground-timer.ts"),
  );
  const { createWelcomeBonusLifecycle } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/welcome-bonus-lifecycle.ts"),
    { "./foreground-timer": { createForegroundTimer } },
  );
  let callback;
  let dismissedCalls = 0;
  const lifecycle = createWelcomeBonusLifecycle({
    durationMs: 20_000,
    now: () => 0,
    schedule: (next) => {
      callback = next;
      return 1;
    },
    cancel: () => undefined,
    markShown: () => undefined,
    markDismissed: () => {
      dismissedCalls += 1;
    },
    onStateChange: () => undefined,
  });

  lifecycle.update({ canStart: true, isEligible: true, isForeground: true, owner: "guest" });
  callback();
  lifecycle.update({ canStart: false, isEligible: true, isForeground: true, owner: "user-1" });
  assert.equal(lifecycle.getState(), "ended");

  const dismissed = createWelcomeBonusLifecycle({
    durationMs: 20_000,
    now: () => 0,
    schedule: (next) => {
      callback = next;
      return 2;
    },
    cancel: () => undefined,
    markShown: () => undefined,
    markDismissed: () => {
      dismissedCalls += 1;
    },
    onStateChange: () => undefined,
  });
  dismissed.update({ canStart: true, isEligible: true, isForeground: true, owner: "guest" });
  callback();
  dismissed.dismiss();
  assert.equal(dismissed.getState(), "ended");
  assert.equal(dismissedCalls, 1);
});

test("welcome offer requests stop for excluded, suppressed, or ended visits but continue while presented", async () => {
  const { shouldRequestWelcomeOffer } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/welcome-bonus-lifecycle.ts"),
    { "./foreground-timer": { createForegroundTimer: () => ({ pause() {}, resume() {} }) } },
  );

  assert.equal(
    shouldRequestWelcomeOffer({ canStart: true, isBaseEligible: true, state: "idle" }),
    true,
  );
  assert.equal(
    shouldRequestWelcomeOffer({ canStart: false, isBaseEligible: true, state: "idle" }),
    false,
  );
  assert.equal(
    shouldRequestWelcomeOffer({ canStart: true, isBaseEligible: false, state: "idle" }),
    false,
  );
  assert.equal(
    shouldRequestWelcomeOffer({ canStart: false, isBaseEligible: true, state: "presented" }),
    true,
  );
  assert.equal(
    shouldRequestWelcomeOffer({ canStart: true, isBaseEligible: true, state: "ended" }),
    false,
  );
});

test("welcome lifecycle rechecks authoritative offer expiry before the delayed reveal", async () => {
  const { createForegroundTimer } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/foreground-timer.ts"),
  );
  const { createWelcomeBonusLifecycle } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/welcome-bonus-lifecycle.ts"),
    { "./foreground-timer": { createForegroundTimer } },
  );
  let callback;
  let isOfferActive = true;
  let seenCalls = 0;
  const lifecycle = createWelcomeBonusLifecycle({
    durationMs: 20_000,
    now: () => 0,
    schedule: (next) => {
      callback = next;
      return 1;
    },
    cancel: () => undefined,
    canPresentNow: () => isOfferActive,
    markShown: () => {
      seenCalls += 1;
    },
    markDismissed: () => undefined,
    onStateChange: () => undefined,
  });

  lifecycle.update({ canStart: true, isEligible: true, isForeground: true, owner: "guest" });
  isOfferActive = false;
  callback();

  assert.equal(lifecycle.getState(), "ended");
  assert.equal(seenCalls, 0);
});

test("welcome reveal guard rejects a shown impression or dismissal set during the countdown", async () => {
  const { canPresentWelcomeBonusNow } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/welcome-bonus-lifecycle.ts"),
    { "./foreground-timer": { createForegroundTimer: () => ({ pause() {}, resume() {} }) } },
  );

  assert.equal(
    canPresentWelcomeBonusNow({
      isDismissedToday: false,
      isEligible: true,
      wasShownToday: false,
    }),
    true,
  );
  assert.equal(
    canPresentWelcomeBonusNow({
      isDismissedToday: false,
      isEligible: true,
      wasShownToday: true,
    }),
    false,
  );
  assert.equal(
    canPresentWelcomeBonusNow({
      isDismissedToday: true,
      isEligible: true,
      wasShownToday: false,
    }),
    false,
  );
});

test("Moscow day helpers cross midnight at the exact UTC boundary", async () => {
  const { getMoscowDayKey, getMsUntilNextMoscowDay } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/moscow-day.ts"),
  );
  const beforeMidnight = Date.parse("2026-08-31T20:59:59.999Z");
  const midnight = Date.parse("2026-08-31T21:00:00.000Z");

  assert.equal(getMoscowDayKey(beforeMidnight), "2026-08-31");
  assert.equal(getMsUntilNextMoscowDay(beforeMidnight), 1);
  assert.equal(getMoscowDayKey(midnight), "2026-09-01");
  assert.equal(getMsUntilNextMoscowDay(midnight), 86_400_000);
});

test("Moscow day rollover updates an open tab and cleans up its midnight timer", async () => {
  const moscowDay = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/moscow-day.ts"),
  );
  const { createMoscowDayRollover } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/moscow-day-rollover.ts"),
    { "./moscow-day": moscowDay },
  );
  let now = Date.parse("2026-08-31T20:59:59.999Z");
  let scheduled;
  const canceled = [];
  const days = [];
  const rollover = createMoscowDayRollover({
    now: () => now,
    schedule: (callback, delay) => {
      scheduled = { callback, delay, handle: Symbol("timer") };
      return scheduled.handle;
    },
    cancel: (handle) => canceled.push(handle),
    onDayChange: (dayKey) => days.push(dayKey),
  });

  rollover.sync();
  assert.deepEqual(days, ["2026-08-31"]);
  assert.equal(scheduled.delay, 1);
  now = Date.parse("2026-08-31T21:00:00.000Z");
  scheduled.callback();
  assert.deepEqual(days, ["2026-08-31", "2026-09-01"]);
  assert.equal(scheduled.delay, 86_400_000);
  const secondHandle = scheduled.handle;
  rollover.sync();
  assert.ok(canceled.includes(secondHandle));
  rollover.dispose();
  assert.ok(canceled.includes(scheduled.handle));
});

test("a new Moscow day updates the freshly-created welcome lifecycle", async () => {
  const welcomeHook = await readSource(
    "src/features/welcome-bonus/lib/use-welcome-bonus.ts",
  );

  assert.match(
    welcomeHook,
    /\[canStart, isAuthoritativelyEligible, moscowDayKey, owner\]/u,
  );
});

test("daily welcome persistence suppresses only the matching Moscow date", async () => {
  const persistence = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/persistence.ts"),
  );
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const today = "2026-08-31";
  const tomorrow = "2026-09-01";

  assert.equal(persistence.wasWelcomeBonusShownToday(today, storage), false);
  persistence.markWelcomeBonusShownToday(today, storage);
  assert.equal(persistence.wasWelcomeBonusShownToday(today, storage), true);
  assert.equal(persistence.wasWelcomeBonusShownToday(tomorrow, storage), false);
  assert.equal(persistence.wasWelcomeBonusDismissedToday(today, storage), false);
  persistence.markWelcomeBonusDismissedToday(today, storage);
  assert.equal(persistence.wasWelcomeBonusDismissedToday(today, storage), true);
  assert.equal(persistence.wasWelcomeBonusDismissedToday(tomorrow, storage), false);

  const fallbackPersistence = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/persistence.ts"),
  );
  const throwingStorage = {
    getItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  };
  assert.equal(fallbackPersistence.wasWelcomeBonusShownToday(today, throwingStorage), false);
  fallbackPersistence.markWelcomeBonusShownToday(today, throwingStorage);
  assert.equal(fallbackPersistence.wasWelcomeBonusShownToday(today, throwingStorage), true);
  assert.equal(fallbackPersistence.wasWelcomeBonusShownToday(tomorrow, throwingStorage), false);
  fallbackPersistence.markWelcomeBonusDismissedToday(today, throwingStorage);
  assert.equal(fallbackPersistence.wasWelcomeBonusDismissedToday(today, throwingStorage), true);
  assert.equal(fallbackPersistence.wasWelcomeBonusDismissedToday(tomorrow, throwingStorage), false);
});

test("welcome persistence shadows readable storage after quota write failures", async () => {
  const persistence = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/persistence.ts"),
  );
  const readOnlyStorage = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("quota", "QuotaExceededError");
    },
  };
  const today = "2026-08-31";

  persistence.markWelcomeBonusShownToday(today, readOnlyStorage);
  persistence.markWelcomeBonusDismissedToday(today, readOnlyStorage);

  assert.equal(persistence.wasWelcomeBonusShownToday(today, readOnlyStorage), true);
  assert.equal(persistence.wasWelcomeBonusDismissedToday(today, readOnlyStorage), true);
});

test("welcome persistence handles throwing browser storage getters", async () => {
  const persistence = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/persistence.ts"),
  );
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() {
        throw new DOMException("blocked", "SecurityError");
      },
      get sessionStorage() {
        throw new DOMException("blocked", "SecurityError");
      },
    },
  });

  try {
    const today = "2026-08-31";
    assert.equal(persistence.wasWelcomeBonusShownToday(today), false);
    persistence.markWelcomeBonusShownToday(today);
    persistence.markWelcomeBonusDismissedToday(today);
    assert.equal(persistence.wasWelcomeBonusShownToday(today), true);
    assert.equal(persistence.wasWelcomeBonusDismissedToday(today), true);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});

test("daily persistence ignores old v1 markers", async () => {
  const persistence = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/persistence.ts"),
  );
  const values = new Map([
    ["artmate_welcome_bonus_seen_v1", "seen"],
    ["artmate_welcome_bonus_cooldown_v1", String(Date.now() + 86_400_000)],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(persistence.wasWelcomeBonusShownToday("2026-08-31", storage), false);
  assert.equal(persistence.wasWelcomeBonusDismissedToday("2026-08-31", storage), false);
});

test("cookie consent notifies subscribers and survives unavailable storage", async () => {
  const consent = evaluateTypeScript(
    await readSource("src/shared/lib/cookie-consent/cookie-consent-store.ts"),
  );
  const throwingStorage = {
    getItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  };
  let notifications = 0;
  const unsubscribe = consent.subscribeCookieConsent(() => {
    notifications += 1;
  });

  assert.equal(consent.getCookieConsentSnapshot(throwingStorage), false);
  consent.acceptCookieConsent(throwingStorage);
  assert.equal(consent.getCookieConsentSnapshot(throwingStorage), true);
  assert.equal(consent.getCookieConsentSnapshot(undefined), true);
  assert.equal(notifications, 1);
  unsubscribe();
});

test("cookie consent shadows readable storage after a quota write failure", async () => {
  const consent = evaluateTypeScript(
    await readSource("src/shared/lib/cookie-consent/cookie-consent-store.ts"),
  );
  const readOnlyStorage = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("quota", "QuotaExceededError");
    },
  };

  consent.acceptCookieConsent(readOnlyStorage);
  assert.equal(consent.getCookieConsentSnapshot(readOnlyStorage), true);
});

test("cookie consent handles a throwing window.localStorage getter", async () => {
  const consent = evaluateTypeScript(
    await readSource("src/shared/lib/cookie-consent/cookie-consent-store.ts"),
  );
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() {
        throw new DOMException("blocked", "SecurityError");
      },
    },
  });

  try {
    assert.equal(consent.getCookieConsentSnapshot(), false);
    consent.acceptCookieConsent();
    assert.equal(consent.getCookieConsentSnapshot(), true);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});

test("personalized banners and welcome offer use exact owner keys and fail closed", async () => {
  const queryOptionsMock = (options) => options;
  const { featureBannersQuery } = evaluateTypeScript(
    await readSource("src/entities/feature-banners/model/query.ts"),
    {
      "@/shared/actions/feature-banners": { getFeatureBanners: async () => ({ data: [] }) },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
      },
      "@/shared/lib/query-keys": {
        featureBannersQueryKey: ["feature-banners"],
      },
      "@tanstack/react-query": { queryOptions: queryOptionsMock },
    },
  );
  const guestBanners = featureBannersQuery.list("guest");
  const userBanners = featureBannersQuery.list("user-1");

  assert.deepEqual(guestBanners.queryKey, ["feature-banners", "list", "guest"]);
  assert.notDeepEqual(guestBanners.queryKey, userBanners.queryKey);
  assert.equal(guestBanners.refetchInterval, 30_000);
  assert.equal(guestBanners.refetchIntervalInBackground, false);

  const { promoCodeQuery } = evaluateTypeScript(
    await readSource("src/entities/promocode/model/query.ts"),
    {
      "@/shared/actions/promocodes": {
        getWelcomeOffer: async () => ({ data: { offer: null } }),
        getWelcomePromoCode: async () => ({ data: { promo: null } }),
        previewPromoCode: async () => ({ data: undefined }),
      },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
      },
      "@/shared/lib/query-keys": {
        cartPricingQueryKey: ["cart-pricing"],
        welcomeOfferQueryKey: ["cart-pricing", "welcome-offer"],
      },
      "@tanstack/react-query": { queryOptions: queryOptionsMock },
    },
  );

  assert.deepEqual(promoCodeQuery.welcomeOffer("guest").queryKey, [
    "cart-pricing",
    "welcome-offer",
    "guest",
  ]);
  assert.notDeepEqual(
    promoCodeQuery.welcomeOffer("guest").queryKey,
    promoCodeQuery.welcomeOffer("user-1").queryKey,
  );
  assert.equal(promoCodeQuery.welcomeOffer("guest").refetchInterval, 30_000);
  assert.equal(promoCodeQuery.welcomeOffer("guest").refetchIntervalInBackground, false);
});

test("feature banners retain same-owner polling data but hide disabled, paused, or failed data", async () => {
  let queryResult;
  const { getFreshQueryData } = evaluateTypeScript(
    await readSource("src/shared/lib/query-freshness.ts"),
  );
  const { useFeatureBanners } = evaluateTypeScript(
    await readSource("src/entities/feature-banners/model/use-feature-banners.ts"),
    {
      "./query": {
        featureBannersQuery: { list: (owner) => ({ queryKey: ["banners", owner] }) },
      },
      "@/shared/lib/query-freshness": { getFreshQueryData },
      "@tanstack/react-query": { useQuery: () => queryResult },
    },
  );
  const cached = [{ id: "old-owner" }];
  const callFeatureBanners = useFeatureBanners;

  for (const { enabled, expected, result } of [
    {
      enabled: false,
      expected: [],
      result: { data: cached, isError: false, isFetching: false, isPending: false },
    },
    {
      enabled: true,
      expected: cached,
      result: { data: cached, isError: false, isFetching: true, isPending: false },
    },
    {
      enabled: true,
      expected: [],
      result: { data: cached, isError: true, isFetching: false, isPending: false },
    },
    {
      enabled: true,
      expected: [],
      result: {
        data: cached,
        fetchStatus: "paused",
        isError: false,
        isFetching: false,
        isPaused: true,
        isPending: false,
      },
    },
  ]) {
    queryResult = result;
    assert.deepEqual(callFeatureBanners({ enabled, owner: "guest" }).banners, expected);
  }

  queryResult = { data: cached, isError: false, isFetching: false, isPending: false };
  assert.deepEqual(callFeatureBanners({ enabled: true, owner: "guest" }).banners, cached);
});

test("welcome offer hook retains valid polling data but hides disabled, null, expired, paused, or failed data", async () => {
  let queryResult;
  const { isWelcomeOfferActive } = evaluateTypeScript(
    await readSource("src/entities/promocode/lib/welcome-offer-selectors.ts"),
  );
  const { useWelcomeOffer } = evaluateTypeScript(
    await readSource("src/entities/promocode/model/use-welcome-offer.ts"),
    {
      "./query": {
        promoCodeQuery: { welcomeOffer: (owner) => ({ queryKey: ["offer", owner] }) },
      },
      "../lib/welcome-offer-selectors": { isWelcomeOfferActive },
      "@tanstack/react-query": { useQuery: () => queryResult },
    },
  );
  const offer = {
    action: "authorize",
    amount: null,
    discountPercent: 20,
    endsAt: "2999-01-01T00:00:00.000Z",
    maxDiscount: null,
    minSubtotal: 0,
  };
  const cached = { offer };
  const callWelcomeOffer = useWelcomeOffer;

  for (const { enabled, expected, result } of [
    {
      enabled: false,
      expected: undefined,
      result: { data: cached, isError: false, isFetching: false, isPending: false },
    },
    {
      enabled: true,
      expected: offer,
      result: { data: cached, isError: false, isFetching: true, isPending: false },
    },
    {
      enabled: true,
      expected: undefined,
      result: { data: cached, isError: true, isFetching: false, isPending: false },
    },
    {
      enabled: true,
      expected: undefined,
      result: {
        data: cached,
        fetchStatus: "paused",
        isError: false,
        isFetching: false,
        isPaused: true,
        isPending: false,
      },
    },
  ]) {
    queryResult = result;
    assert.equal(callWelcomeOffer({ enabled: enabled, owner: "guest" }).data, expected);
  }

  queryResult = { data: cached, isError: false, isFetching: false, isPending: false };
  assert.deepEqual(callWelcomeOffer({ enabled: true, owner: "guest" }).data, offer);
  assert.equal(callWelcomeOffer({ enabled: false, owner: "guest" }).data, undefined);

  queryResult = { data: { offer: null }, isError: false, isFetching: false, isPending: false };
  assert.equal(callWelcomeOffer({ enabled: true, owner: "guest" }).data, undefined);

  queryResult = {
    data: { offer: { ...offer, endsAt: "2000-01-01T00:00:00.000Z" } },
    isError: false,
    isFetching: false,
    isPending: false,
  };
  assert.equal(callWelcomeOffer({ enabled: true, owner: "guest" }).data, undefined);
});

test("welcome offer expiry uses the exact instant boundary", async () => {
  const { isWelcomeOfferActive } = evaluateTypeScript(
    await readSource("src/entities/promocode/lib/welcome-offer-selectors.ts"),
  );
  const offer = {
    action: "authorize",
    amount: null,
    discountPercent: 20,
    endsAt: "2026-08-31T12:00:00.000Z",
    maxDiscount: null,
    minSubtotal: 0,
  };

  assert.equal(isWelcomeOfferActive(offer, Date.parse("2026-08-31T11:59:59.999Z")), true);
  assert.equal(isWelcomeOfferActive(offer, Date.parse(offer.endsAt)), false);
});

test("welcome offer copy derives percent or fixed RUB conditions and action without a code", async () => {
  const { getWelcomeOfferAction, getWelcomeOfferCopy } = evaluateTypeScript(
    await readSource("src/features/welcome-bonus/lib/presentation.ts"),
    {
      "@/shared/constants": {
        routes: { account: "/account", auth: "/auth" },
      },
    },
  );

  const percentCopy = getWelcomeOfferCopy({
    action: "authorize",
    amount: null,
    discountPercent: 20,
    endsAt: null,
    maxDiscount: 500,
    minSubtotal: 1_000,
  });
  assert.equal(percentCopy.discount, "Скидка 20%");
  assert.equal(
    percentCopy.description,
    "Создайте аккаунт и привяжите Telegram — бонус появится в личном кабинете.",
  );
  assert.match(percentCopy.conditions, /при сумме товаров от 1\u00a0000\s*₽/u);
  assert.match(percentCopy.conditions, /скидка до 500\s*₽/u);

  const fixedCopy = getWelcomeOfferCopy({
    action: "link_telegram",
    amount: 350.5,
    discountPercent: null,
    endsAt: null,
    maxDiscount: null,
    minSubtotal: 0,
  });
  assert.match(fixedCopy.discount, /^Скидка 350,5\s*₽$/u);
  assert.equal(
    fixedCopy.description,
    "Привяжите Telegram — бонус появится в личном кабинете.",
  );
  assert.doesNotMatch(`${percentCopy.conditions}${fixedCopy.conditions}`, /code|код/u);
  assert.deepEqual(getWelcomeOfferAction("authorize"), {
    href: "/auth?next=%2Faccount",
    label: "Получить бонус",
  });
  assert.deepEqual(getWelcomeOfferAction("link_telegram"), {
    href: "/account",
    label: "Привязать Telegram",
  });

  const expiringCopy = getWelcomeOfferCopy({
    action: "authorize",
    amount: null,
    discountPercent: 20,
    endsAt: "2026-08-31T12:30:00.000Z",
    maxDiscount: null,
    minSubtotal: 0,
  });
  assert.match(
    expiringCopy.conditions,
    /действует до 31\.08\.2026, 15:30 МСК \(не включительно\)/u,
  );
});

test("site wiring keeps welcome bonus out of service banners and uses the new no-code endpoint", async () => {
  const [
    layout,
    widget,
    welcomeHook,
    lifecycle,
    persistence,
    rootLayout,
    serviceBanners,
    action,
    types,
    bannerTypes,
  ] =
    await Promise.all([
    readSource("src/_app/layouts/site-layout.tsx"),
    readSource("src/features/welcome-bonus/ui/welcome-bonus.tsx"),
    readSource("src/features/welcome-bonus/lib/use-welcome-bonus.ts"),
    readSource("src/features/welcome-bonus/lib/welcome-bonus-lifecycle.ts"),
    readSource("src/features/welcome-bonus/lib/persistence.ts"),
    readSource("src/_app/layouts/root-layout.tsx"),
    readSource("src/features/service-banners/ui/service-banners.tsx"),
    readSource("src/shared/actions/promocodes/promocodes.actions.ts"),
    readSource("src/shared/actions/promocodes/promocode.types.ts"),
    readSource("src/shared/actions/feature-banners/feature-banners.types.ts"),
    ]);

  assert.match(layout, /WelcomeBonus/u);
  assert.match(widget, /useWelcomeBonus/u);
  assert.doesNotMatch(widget, /use(?:Effect|Ref|State|SyncExternalStore)/u);
  assert.match(widget, /flex-none/u);
  assert.match(widget, /min-h-9/u);
  assert.match(widget, /min-\[360px\]:flex-1/u);
  assert.match(welcomeHook, /createMoscowDayRollover/u);
  assert.match(welcomeHook, /visibilitychange/u);
  assert.doesNotMatch(`${welcomeHook}${lifecycle}${persistence}`, /cooldown|7\s*\*\s*24/iu);
  assert.match(rootLayout, /featureBannersQuery\.list\(getQueryOwner\(initialSession\.user/u);
  assert.match(serviceBanners, /featureBannerSlugs\.welcomeBonus/u);
  assert.match(action, /\/promocodes\/welcome-offer/u);
  assert.match(action, /cache: "no-store"/u);
  assert.doesNotMatch(types, /WelcomeOffer[^}]*code/isu);
  assert.match(bannerTypes, /audiences: FeatureBannerAudience\[\]/u);
  assert.doesNotMatch(bannerTypes, /\baudience: FeatureBannerAudience/u);
});

test("identity transitions cancel and clear personalized data before publishing new identity state", async () => {
  const ordersQueryKey = ["orders"];
  const featureBannersQueryKey = ["feature-banners"];
  const welcomeOfferQueryKey = ["cart-pricing", "welcome-offer"];
  const cartPricingQueryKey = ["cart-pricing"];
  const sessionKey = ["session", "data"];
  const cases = [
    [
      "src/features/auth/model/use-login.ts",
      "useLoginMutation",
      { user: { id: "user-1" } },
      "remove",
    ],
    ["src/features/auth/model/use-logout.ts", "useLogoutMutation", undefined, "remove"],
    [
      "src/features/auth/model/use-confirm-email-verification.ts",
      "useConfirmEmailVerificationMutation",
      { user: { id: "user-1" } },
      "remove",
    ],
    [
      "src/features/account/model/use-confirm-telegram-link.ts",
      "useConfirmTelegramLink",
      { linked: true },
      "reset",
    ],
    [
      "src/features/account/model/use-unlink-telegram.ts",
      "useUnlinkTelegram",
      { linked: false },
      "reset",
    ],
  ];

  for (const [path, exportName, response, clearMethod] of cases) {
    const calls = [];
    let mutationOptions;
    const queryClient = {
      cancelQueries: ({ queryKey }) => {
        calls.push(["cancel", queryKey]);
        return Promise.resolve();
      },
      invalidateQueries: ({ queryKey }) => {
        calls.push(["invalidate", queryKey]);
        return Promise.resolve();
      },
      removeQueries: ({ queryKey }) => calls.push(["remove", queryKey]),
      resetQueries: ({ queryKey }) => {
        calls.push(["reset", queryKey]);
        return Promise.resolve();
      },
      setQueryData: (queryKey) => calls.push(["set", queryKey]),
    };
    const evaluatedModule = evaluateTypeScript(await readSource(path), {
      "@tanstack/react-query": {
        useMutation: (options) => {
          mutationOptions = options;
          return { isPending: false, mutate() {}, mutateAsync() {} };
        },
        useQueryClient: () => queryClient,
      },
      "@/entities/session": {
        sessionQuery: { baseKey: ["session"], getSession: () => ({ queryKey: sessionKey }) },
        telegramLinkStatusQueryKey: ["telegram-link"],
      },
      "@/entities/orders": { ordersQuery: { baseKey: ordersQueryKey } },
      "@/shared/actions/auth": {
        confirmEmailVerification: async () => undefined,
        confirmTelegramLink: async () => undefined,
        login: async () => undefined,
        logout: async () => undefined,
        unlinkTelegram: async () => undefined,
      },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: () => ({ unwrap: () => undefined }) },
      },
      "@/shared/lib/query-keys": {
        cartPricingQueryKey,
        featureBannersQueryKey,
        welcomeOfferQueryKey,
      },
    });

    evaluatedModule[exportName]();
    await mutationOptions.onSuccess(response);

    const includesOrders = exportName === "useLoginMutation";
    const expectedCleanup = [
      ...(includesOrders ? [["cancel", ordersQueryKey]] : []),
      ["cancel", featureBannersQueryKey],
      ["cancel", welcomeOfferQueryKey],
      ...(includesOrders ? [["remove", ordersQueryKey]] : []),
      [clearMethod, featureBannersQueryKey],
      [clearMethod, welcomeOfferQueryKey],
    ];
    assert.deepEqual(calls.slice(0, expectedCleanup.length), expectedCleanup);
    const identityPublishIndex = calls.findIndex(([kind]) => kind === "set");
    const pricingInvalidationIndex = calls.findIndex(
      ([kind, key]) => kind === "invalidate" && key === cartPricingQueryKey,
    );
    assert.ok(identityPublishIndex === -1 || identityPublishIndex >= expectedCleanup.length, path);
    assert.ok(pricingInvalidationIndex >= expectedCleanup.length, path);
  }
});

test("same-owner Telegram transitions clear active observers before fresh refetch", async () => {
  const { QueryClient, QueryObserver } = require("@tanstack/react-query");
  const featureBannersQueryKey = ["feature-banners"];
  const welcomeOfferQueryKey = ["cart-pricing", "welcome-offer"];
  const cartPricingQueryKey = ["cart-pricing"];
  const cases = [
    [
      "src/features/account/model/use-confirm-telegram-link.ts",
      "useConfirmTelegramLink",
      { linked: true },
    ],
    ["src/features/account/model/use-unlink-telegram.ts", "useUnlinkTelegram", { linked: false }],
  ];

  for (const [path, exportName, response] of cases) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const bannerKey = [...featureBannersQueryKey, "list", "user-1"];
    const offerKey = [...welcomeOfferQueryKey, "user-1"];
    queryClient.setQueryData(bannerKey, "OLD_BANNER");
    queryClient.setQueryData(offerKey, "OLD_OFFER");
    const pending = new Promise(() => undefined);
    const bannerObserver = new QueryObserver(queryClient, {
      queryFn: () => pending,
      queryKey: bannerKey,
      staleTime: Infinity,
    });
    const offerObserver = new QueryObserver(queryClient, {
      queryFn: () => pending,
      queryKey: offerKey,
      staleTime: Infinity,
    });
    const unsubscribeBanner = bannerObserver.subscribe(() => undefined);
    const unsubscribeOffer = offerObserver.subscribe(() => undefined);
    let mutationOptions;
    const evaluatedModule = evaluateTypeScript(await readSource(path), {
      "@tanstack/react-query": {
        useMutation: (options) => {
          mutationOptions = options;
          return { isPending: false, mutateAsync() {} };
        },
        useQueryClient: () => queryClient,
      },
      "@/entities/session": {
        sessionQuery: { baseKey: ["session"] },
        telegramLinkStatusQueryKey: ["telegram-link"],
      },
      "@/shared/actions/auth": {
        confirmTelegramLink: async () => undefined,
        unlinkTelegram: async () => undefined,
      },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: () => ({ unwrap: () => undefined }) },
      },
      "@/shared/lib/query-keys": {
        cartPricingQueryKey,
        featureBannersQueryKey,
        welcomeOfferQueryKey,
      },
    });

    evaluatedModule[exportName]();
    mutationOptions.onSuccess(response);

    assert.equal(bannerObserver.getCurrentResult().data, undefined, path);
    assert.equal(offerObserver.getCurrentResult().data, undefined, path);
    assert.equal(bannerObserver.getCurrentResult().isPending, true, path);
    assert.equal(offerObserver.getCurrentResult().isPending, true, path);
    unsubscribeBanner();
    unsubscribeOffer();
    queryClient.clear();
  }
});
