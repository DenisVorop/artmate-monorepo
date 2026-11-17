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
      "@/shared/lib/cookie-consent": { getCookieConsentSnapshot: () => true },
    },
  );

  return { ...types, ...product, ...dedupe, ...factory };
}

async function loadAuthAnalytics(sharedAnalytics) {
  return evaluateTypeScript(await readSource("src/features/auth/lib/analytics.ts"), {
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

test("signup adapter emits an empty sign_up goal once per opaque registration attempt", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const { createSignupAttempt, useAnalytics } = await loadAuthAnalytics(sharedAnalytics);
  const analytics = useAnalytics();
  const analyticsWindow = createAnalyticsWindow();
  const firstAttempt = createSignupAttempt();
  const secondAttempt = createSignupAttempt();

  await withWindow(analyticsWindow, () => {
    analytics.signupCompleted(undefined);
    analytics.signupCompleted({ attemptKey: "private@example.com:123456" });
    analytics.signupCompleted(firstAttempt);
    analytics.signupCompleted(firstAttempt);
    analytics.signupCompleted(secondAttempt);
  });

  assert.deepEqual(analyticsWindow.dataLayer, [{ event: "sign_up" }, { event: "sign_up" }]);
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes("private"), false);
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes("123456"), false);
});

async function loadCoordinator(ports) {
  const mapper = evaluateTypeScript(
    await readSource("src/features/auth/lib/to-consent-decision.ts"),
  );
  const { AuthFlowCoordinator } = evaluateTypeScript(
    await readSource("src/features/auth/lib/auth-flow-coordinator.ts"),
    {
      "./to-consent-decision": mapper,
      "./read-advertising-consent-device": {
        readAdvertisingConsentDevice: async () => ({}),
      },
    },
  );
  return new AuthFlowCoordinator({
    now: () => 0,
    wait: async () => {},
    operationKey: () => "attempt",
    ...ports,
  });
}
const pending = (nextStep, extra = {}) => ({
  status: "PENDING",
  nextStep,
  flowId: "flow",
  expiresAt: "2100-01-01T00:00:00.000Z",
  ...extra,
});
const consentState = () =>
  pending("consents", {
    operationKey: "operation",
    expectedStateRevision: 0,
    expectedAdvertisingVersion: 0,
    personalData: { revisionId: "pdn" },
    emailAdvertising: { revisionId: "ads" },
  });
const freshUser = {
  id: "private-user-id",
  provider: "credentials",
  providerUserId: "private-user-id",
  email: "private@example.com",
  roles: [],
};
const completed = { status: "COMPLETED", user: freshUser };
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

async function createScenario(overrides = {}) {
  const shared = await loadSharedAnalytics();
  const { useAnalytics: getAuthAnalytics, createSignupAttempt } = await loadAuthAnalytics(shared);
  const analytics = getAuthAnalytics();
  const operations = [];
  const coordinator = await loadCoordinator({
    start: async () => ({ status: "LOGIN_REQUIRED", nextStep: "login" }),
    cancel: async () => {},
    requestCode: async () => pending("code", { generation: 1 }),
    confirmCode: async () => pending("registration"),
    saveRegistration: async () => consentState(),
    login: async () => consentState(),
    yandex: async () => consentState(),
    exchangeActivation: async () => pending("activation"),
    saveActivation: async () => consentState(),
    complete: async () => pending("completion"),
    resume: async () => completed,
    publishSession: async () => operations.push("session"),
    registrationCompleted: () => {
      operations.push("sign_up");
      analytics.signupCompleted(createSignupAttempt());
    },
    ...overrides,
  });
  return { coordinator, operations };
}
async function register(coordinator) {
  await coordinator.showEmail();
  await coordinator.requestCode({ email: "private@example.com" });
  await coordinator.confirmCode({ code: "123456" });
  await coordinator.saveRegistration({
    name: "Private Name",
    phone: "+79991234567",
    password: "secret-password",
    passwordConfirm: "secret-password",
  });
}

test("email signup goal waits for completion and fresh session, then fires once before the caller", async () => {
  const analyticsWindow = createAnalyticsWindow();
  await withWindow(analyticsWindow, async () => {
    const { coordinator, operations } = await createScenario();
    const result = coordinator.request(
      Symbol(),
      {},
      { onSuccess: () => operations.push("caller") },
      undefined,
    );
    await flush();
    await register(coordinator);
    assert.deepEqual(analyticsWindow.dataLayer, []);
    await coordinator.submitConsents({ personalData: true, advertising: false });
    assert.equal((await result).status, "success");
    assert.deepEqual(operations, ["session", "sign_up", "caller"]);
    await coordinator.retry();
    await coordinator.submitConsents({ personalData: true, advertising: false });
    assert.deepEqual(analyticsWindow.dataLayer, [{ event: "sign_up" }]);
    assert.doesNotMatch(
      JSON.stringify(analyticsWindow.dataLayer),
      /private|123456|secret-password/u,
    );
  });
});

test("rejected and cancelled registration cannot emit a signup goal", async () => {
  for (const rejected of [true, false]) {
    const analyticsWindow = createAnalyticsWindow();
    await withWindow(analyticsWindow, async () => {
      const { coordinator } = await createScenario({
        complete: async () => ({ status: "REJECTED", errorCode: "CONSENT_MISSING" }),
      });
      const result = coordinator.request(Symbol(), {}, {}, undefined);
      await flush();
      await register(coordinator);
      if (rejected) await coordinator.submitConsents({ personalData: true, advertising: false });
      else await coordinator.cancel();
      assert.equal((await result).status, "error");
      assert.deepEqual(analyticsWindow.dataLayer, []);
    });
  }
});

test("password, Yandex and guest activation completion do not count as new email signup", async () => {
  for (const method of ["password", "yandex", "activation"]) {
    const analyticsWindow = createAnalyticsWindow();
    await withWindow(analyticsWindow, async () => {
      const { coordinator } = await createScenario();
      const result = coordinator.request(
        Symbol(),
        {},
        {},
        undefined,
        method === "activation" ? { type: "activation", token: "private-token" } : undefined,
      );
      await flush();
      if (method === "password")
        await coordinator.login({ email: "private@example.com", password: "secret-password" });
      if (method === "yandex") await coordinator.startYandex();
      if (method === "activation")
        await coordinator.saveActivation({
          password: "secret-password",
          passwordConfirm: "secret-password",
        });
      await coordinator.submitConsents({ personalData: true, advertising: false });
      assert.equal((await result).status, "success");
      assert.deepEqual(analyticsWindow.dataLayer, []);
    });
  }
});
