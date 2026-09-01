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

async function loadAuthAnalytics(sharedAnalytics) {
  return evaluateTypeScript(await readSource("src/features/auth/lib/analytics.ts"), {
    "@/shared/lib/analytics": sharedAnalytics,
  });
}

async function loadVerificationFlow() {
  return evaluateTypeScript(await readSource("src/features/auth/lib/verification-flow.ts"));
}

async function loadConfirmVerificationHook({ confirmEmailVerification, operations }) {
  let mutationOptions;
  const queryClient = {
    cancelQueries: ({ queryKey }) => {
      operations.push(["cancel", queryKey]);
      return Promise.resolve();
    },
    invalidateQueries: ({ queryKey }) => {
      operations.push(["invalidate", queryKey]);
      return Promise.resolve();
    },
    removeQueries: ({ queryKey }) => operations.push(["remove", queryKey]),
    setQueryData: (queryKey) => operations.push(["set", queryKey]),
  };
  const evaluatedModule = evaluateTypeScript(
    await readSource("src/features/auth/model/use-confirm-email-verification.ts"),
    {
      "@tanstack/react-query": {
        useMutation: (options) => {
          mutationOptions = options;
          return { isPending: false, mutate() {}, mutateAsync() {} };
        },
        useQueryClient: () => queryClient,
      },
      "@/entities/session": {
        sessionQuery: { getSession: () => ({ queryKey: ["session", "data"] }) },
      },
      "@/shared/actions/auth": { confirmEmailVerification },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (value) => ({ unwrap: () => value }) },
      },
      "@/shared/lib/query-keys": {
        cartPricingQueryKey: ["cart-pricing"],
        featureBannersQueryKey: ["feature-banners"],
        welcomeOfferQueryKey: ["welcome-offer"],
      },
    },
  );

  return {
    render: (options) => {
      evaluatedModule.useConfirmEmailVerificationMutation(options);
      return mutationOptions;
    },
  };
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

function createVerification(overrides = {}) {
  return {
    email: "private@example.com",
    resendAvailableAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

function createSession(overrides = {}) {
  return {
    user: {
      id: "private-user-id",
      provider: "credentials",
      providerUserId: "private-provider-id",
      email: "private@example.com",
      roles: ["customer"],
      ...overrides,
    },
  };
}

async function executeMutation(mutationOptions, input) {
  const response = await mutationOptions.mutationFn(input);
  await mutationOptions.onSuccess(response);
  return response;
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

test("verification flow attributes only registration and preserves its opaque attempt on resend", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const authAnalytics = await loadAuthAnalytics(sharedAnalytics);
  const {
    createLoginVerificationFlow,
    createSignupVerificationFlow,
    getSignupAttempt,
    updateEmailVerificationFlow,
  } = await loadVerificationFlow();
  const signupAttempt = authAnalytics.createSignupAttempt();
  const loginFlow = createLoginVerificationFlow(createVerification());
  const signupFlow = createSignupVerificationFlow(createVerification(), signupAttempt);
  const resentSignupFlow = updateEmailVerificationFlow(
    signupFlow,
    createVerification({ resendAvailableAt: "2026-09-01T12:01:00.000Z" }),
  );

  assert.equal(getSignupAttempt(loginFlow), undefined);
  assert.equal(getSignupAttempt(signupFlow), signupAttempt);
  assert.equal(getSignupAttempt(resentSignupFlow), signupAttempt);
  assert.equal(getSignupAttempt(undefined), undefined);
});

test("successful confirm sends sign_up before cache cleanup and redirect only for signup flow", async () => {
  const sharedAnalytics = await loadSharedAnalytics();
  const authAnalytics = await loadAuthAnalytics(sharedAnalytics);
  const analyticsWindow = createAnalyticsWindow();
  const operations = [];
  let response = createSession();
  let error;
  const hook = await loadConfirmVerificationHook({
    operations,
    confirmEmailVerification: async () => {
      if (error) {
        throw error;
      }

      return response;
    },
  });
  const signupAttempt = authAnalytics.createSignupAttempt();
  const analytics = authAnalytics.useAnalytics();
  const signupMutation = hook.render({
    onSignupConfirmed: () => {
      operations.push(["sign_up"]);
      analytics.signupCompleted(signupAttempt);
    },
    onSuccess: () => operations.push(["redirect"]),
  });

  await withWindow(analyticsWindow, async () => {
    await executeMutation(signupMutation, {
      email: "private@example.com",
      code: "123456",
    });
    signupMutation.onSuccess(response);
  });

  assert.deepEqual(analyticsWindow.dataLayer, [{ event: "sign_up" }]);
  assert.equal(operations[0][0], "sign_up");
  assert.equal(operations.at(-1)[0], "redirect");
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes("private-user-id"), false);
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes("private@example.com"), false);
  assert.equal(JSON.stringify(analyticsWindow.dataLayer).includes("123456"), false);

  const eventCount = analyticsWindow.dataLayer.length;
  const loginMutation = hook.render({ onSuccess: () => operations.push(["login-redirect"]) });
  await withWindow(analyticsWindow, () =>
    executeMutation(loginMutation, { email: "private@example.com", code: "654321" }),
  );

  response = { user: null };
  const guestMutation = hook.render({
    onSignupConfirmed: () => analytics.signupCompleted(authAnalytics.createSignupAttempt()),
  });
  await withWindow(analyticsWindow, () =>
    executeMutation(guestMutation, { email: "private@example.com", code: "000000" }),
  );

  response = undefined;
  const emptyMutation = hook.render({
    onSignupConfirmed: () => analytics.signupCompleted(authAnalytics.createSignupAttempt()),
  });
  await withWindow(analyticsWindow, () =>
    executeMutation(emptyMutation, { email: "private@example.com", code: "000000" }),
  );

  error = new Error("verification failed");
  const failedMutation = hook.render({
    onSignupConfirmed: () => analytics.signupCompleted(authAnalytics.createSignupAttempt()),
  });
  await assert.rejects(
    () =>
      withWindow(analyticsWindow, () =>
        executeMutation(failedMutation, { email: "private@example.com", code: "000000" }),
      ),
    /verification failed/u,
  );

  hook.render({
    onSignupConfirmed: () => analytics.signupCompleted(authAnalytics.createSignupAttempt()),
  });
  assert.equal(analyticsWindow.dataLayer.length, eventCount);
});
