import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const routes = {
  home: "/",
  auth: "/auth",
  unsubscribe: "/unsubscribe",
  authOrderActivation: "/auth/activate-order",
  authResetPassword: "/auth/reset-password",
  authRecovery: "/auth/recovery",
};
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
function evaluate(source, mocks = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (id) => (id in mocks ? mocks[id] : require(id)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
const redirect = evaluate(await read("src/features/auth/lib/redirect.ts"), {
  "@/shared/constants": { routes },
});
for (const path of [
  undefined,
  null,
  "",
  "https://evil.test",
  "//evil.test",
  "/\\evil.test/path",
  "/auth",
  "/auth?next=/account",
  "/auth/recovery",
  "/./auth",
  "/catalog/../auth",
  "/\nauth",
  "/%61uth/recovery",
  "/auth%2frecovery",
  "/%2f%2fevil.test",
  "/%5cevil.test",
  "/%2561uth",
  "/%zz",
]) {
  test(`safe auth destination rejects ${JSON.stringify(path)}`, () =>
    assert.equal(redirect.getSafeAuthRedirectPath(path), "/"));
}
for (const [input, expected] of [
  ["/account", "/account"],
  ["/catalog?category=markers#colors", "/catalog?category=markers#colors"],
  ["/catalog/../account", "/account"],
  ["/author", "/author"],
]) {
  test(`safe auth destination keeps ${input}`, () =>
    assert.equal(redirect.getSafeAuthRedirectPath(input), expected));
}
const sensitive = evaluate(await read("src/shared/lib/is-sensitive-path.ts"), {
  "@/shared/constants": { routes },
});
test("token surfaces are identified while ordinary storefront and auth are allowed", () => {
  for (const path of [
    "/unsubscribe",
    "/auth/activate-order",
    "/auth/reset-password",
    "/auth/oauth/yandex/callback",
  ])
    assert.equal(sensitive.isSensitivePath(path), true);
  for (const path of ["/", "/auth", "/auth/recovery", "/account"])
    assert.equal(sensitive.isSensitivePath(path), false);
});
test("proxy overwrites untrusted analytics marker and protects token response headers", async () => {
  let forwarded;
  const proxy = evaluate(await read("proxy.ts"), {
    "@/shared/lib/is-sensitive-path": sensitive,
    "next/server": {
      NextResponse: {
        next: (options) => {
          forwarded = options.request.headers;
          return { headers: new Headers() };
        },
      },
    },
  });
  const result = proxy.proxy({
    nextUrl: { pathname: "/auth/activate-order" },
    headers: new Headers({ "x-artmate-sensitive-auth": "0" }),
  });
  assert.equal(forwarded.get("x-artmate-sensitive-auth"), "1");
  assert.equal(result.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(result.headers.get("Referrer-Policy"), "no-referrer");
  proxy.proxy({
    nextUrl: { pathname: "/catalog" },
    headers: new Headers({ "x-artmate-sensitive-auth": "1" }),
  });
  assert.equal(forwarded.get("x-artmate-sensitive-auth"), "0");
});
test("sensitive links are document navigation, never Next prefetch or SPA transitions", async () => {
  const link = evaluate(await read("src/shared/ui/link.tsx"), {
    "../lib/is-sensitive-path": sensitive,
    "../lib": { cn: (...items) => items.filter(Boolean).join(" ") },
    "next/link": { __esModule: true, default: "NextLink" },
  });
  const privateLink = link.Link({
    href: "/auth/reset-password?token=private",
    children: "Сменить пароль",
    prefetch: true,
    replace: true,
  });
  assert.equal(privateLink.type, "a");
  assert.equal(privateLink.props.href, "/auth/reset-password?token=private");
  assert.equal("prefetch" in privateLink.props, false);
  const normalLink = link.Link({ href: "/catalog", children: "Каталог" });
  assert.equal(normalLink.type, "NextLink");
});
test("route adapters share flow view, keep activation identity transient and preserve safe next", async () => {
  let request;
  const route = evaluate(await read("src/features/auth/ui/route-entry.tsx"), {
    react: { useMemo: (build) => build() },
    "@/shared/constants": { routes },
    "@/shared/ui": { Button: "button" },
    "../lib/auth-provider": { withAuth: (component) => component },
    "./auth-page-shell": { AuthPageShell: "shell" },
    "./current-flow-view": { CurrentFlowView: "flow" },
    "../lib/use-route-auth": {
      useRouteAuth: (options) => {
        request = options;
        return { failure: null, isPending: true, initialStep: "completion", retry() {} };
      },
    },
  });
  route.AuthRoute({ entry: "activation", token: "private", next: "/account" });
  assert.deepEqual(request, {
    entry: { type: "activation", token: "private" },
    next: "/account",
  });
  const resumedActivation = route.AuthRoute({ entry: "activation", next: "/account" });
  assert.deepEqual(request.entry, { type: "resume" });
  assert.equal(
    resumedActivation.props.children.props.children.props.initialStep,
    "activation-loading",
    "reloading an activation checks the link instead of claiming login completion",
  );
  route.AuthRoute({ entry: "recovery" });
  assert.deepEqual(request.entry, { type: "recovery" });
  route.AuthRoute({});
  assert.equal(request.entry, undefined);
});
test("standalone route no longer skips consents by redirecting an existing session", async () => {
  const route = await read("app/auth/page.tsx");
  assert.doesNotMatch(route, /getAuthSession|redirect\(/u);
  assert.match(route, /resume/u);
  for (const name of [
    "src/features/order-activation/index.ts",
    "src/features/account-recovery/index.ts",
    "src/features/auth/model/use-confirm-password-reset.ts",
  ])
    await assert.rejects(read(name), { code: "ENOENT" });
});
test("password reset uses matching password schema and never creates an authenticated session", async () => {
  const source = await read("src/features/auth/lib/use-password-reset-route.ts");
  const ui = await read("src/features/auth/ui/password-reset-route.tsx");
  assert.match(source, /useForm<PasswordCreationValues>/u);
  assert.match(source, /zodResolver\(passwordCreationSchema\)/u);
  assert.match(source, /useConfirmRecoveryPassword/u);
  assert.doesNotMatch(source, /useAuth|setQueryData|completeAuthFlow|advertising/u);
  assert.match(ui, /href=\{routes\.auth\}/u);
});

async function routeHookFixture(entry, snapshot = { step: "loading" }) {
  const effects = [];
  const layoutEffects = [];
  let transitionPending = false;
  const timers = new Map();
  const operations = [];
  let timerSequence = 0;
  let options;
  let expectedEntry = entry;
  let stateCursor = 0;
  const states = [];
  const coordinator = { subscribe() {}, getSnapshot: () => snapshot };
  const location = {
    href: "https://artmate.ru/auth/activate-order?token=private&next=%2Faccount",
    pathname: "/auth/activate-order",
    replace: (path) => operations.push(["document", path]),
  };
  let canonicalUrl = location.href;
  const browser = {
    location,
    setTimeout: (effect) => {
      const id = ++timerSequence;
      timers.set(id, effect);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    history: {
      state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["fixture"] },
      replaceState: (state, _, path) => {
        // Next's public History wrapper updates canonical URL only for calls
        // without its internal flags. A cookie RSC refresh uses canonical URL.
        assert.equal(state, null);
        location.href = new URL(path, location.href).href;
        if (!state?.__NA && !state?._N) canonicalUrl = location.href;
        operations.push(["clean", path]);
      },
    },
  };
  const hook = evaluate(await read("src/features/auth/lib/use-route-auth.ts"), {
    react: {
      useContext: () => coordinator,
      useEffect: (effect) => effects.push(effect),
      useLayoutEffect: (effect) => layoutEffects.push(effect),
      useTransition: () => [
        transitionPending,
        (action) => {
          transitionPending = true;
          action();
        },
      ],
      useRef: (value) => ({ current: value }),
      useState: (value) => {
        const index = stateCursor++;
        if (!(index in states)) states[index] = typeof value === "function" ? value() : value;
        return [
          states[index],
          (next) => {
            states[index] = next;
          },
        ];
      },
      useSyncExternalStore: (_, readSnapshot) => readSnapshot(),
    },
    "next/navigation": {
      useRouter: () => ({
        replace: (path) => operations.push(["navigate", path]),
        refresh: () => operations.push(["refresh"]),
      }),
    },
    "./auth-provider/auth.context": {},
    "./auth-provider/use-auth-request": {
      useAuthRequest: (value, actualEntry) => {
        options = value;
        assert.deepEqual(actualEntry, expectedEntry);
        return {
          isPending: false,
          onAuth: () => {
            operations.push(["start", actualEntry, location.href]);
            return Promise.resolve();
          },
        };
      },
    },
    "./redirect": redirect,
    "@/shared/constants": { routes },
  });
  const previous = globalThis.window;
  globalThis.window = browser;
  return {
    result: hook.useRouteAuth({ entry, next: "/account" }),
    rerender: (nextEntry) => {
      stateCursor = 0;
      expectedEntry = entry;
      return hook.useRouteAuth({ entry: nextEntry, next: "/account" });
    },
    prepare: (complete = true) => {
      for (const effect of layoutEffects.splice(0)) effect();
      if (complete) transitionPending = false;
      stateCursor = 0;
      effects.length = 0;
      return hook.useRouteAuth({ entry, next: "/account" });
    },
    finishNavigation: () => {
      transitionPending = false;
      stateCursor = 0;
      effects.length = 0;
      return hook.useRouteAuth({ entry, next: "/account" });
    },
    effects,
    timers,
    operations,
    options,
    location,
    refreshFromServer: () => {
      location.href = canonicalUrl;
    },
    restore: () => {
      if (previous === undefined) delete globalThis.window;
      else globalThis.window = previous;
    },
  };
}

test("standalone StrictMode mount discards its first timer and starts one owner", async () => {
  const fixture = await routeHookFixture();
  try {
    fixture.prepare();
    const cleanup = fixture.effects[0]();
    assert.equal(fixture.timers.size, 1);
    cleanup();
    fixture.effects[0]();
    assert.equal(fixture.timers.size, 1);
    for (const run of fixture.timers.values()) run();
    assert.deepEqual(
      fixture.operations.map(([kind]) => kind),
      ["start"],
    );
    assert.equal(fixture.options.onError, undefined);
    assert.equal(fixture.operations.filter(([kind]) => kind === "start").length, 1);
  } finally {
    fixture.restore();
  }
});

test("activation token leaves URL after exchange without a separate failure-page retry", async () => {
  const fixture = await routeHookFixture(
    { type: "activation", token: "private" },
    { step: "activation", flow: { status: "PENDING" } },
  );
  try {
    assert.ok(fixture.location.href.includes("token="));
    fixture.effects[1]();
    assert.equal(new URL(fixture.location.href).searchParams.has("token"), false);
    assert.equal(new URL(fixture.location.href).searchParams.get("next"), "/account");
    assert.equal(fixture.result.retry, undefined);
    assert.equal(
      fixture.operations.some(([kind]) => kind === "start"),
      false,
    );
  } finally {
    fixture.restore();
  }
});

test("route success cleans token before navigating and refreshing the safe destination", async () => {
  const fixture = await routeHookFixture({
    type: "activation",
    token: "private",
  });
  try {
    fixture.options.onSuccess();
    assert.deepEqual(
      fixture.operations.map(([kind]) => kind),
      ["clean", "navigate", "refresh"],
    );
    assert.deepEqual(fixture.operations[1], ["navigate", "/account"]);
  } finally {
    fixture.restore();
  }
});

test("activation removes token before bootstrap action so cookie RSC refresh uses the clean URL", async () => {
  const entry = { type: "activation", token: "private" };
  const fixture = await routeHookFixture(entry);
  try {
    fixture.prepare();
    fixture.effects[0]();
    for (const run of fixture.timers.values()) run();
    assert.deepEqual(
      fixture.operations.map(([kind]) => kind),
      ["clean", "navigate", "start"],
    );
    const [, actualEntry, requestUrl] = fixture.operations[2];
    assert.deepEqual(actualEntry, entry);
    assert.equal(new URL(requestUrl).searchParams.has("token"), false);
    assert.equal(new URL(requestUrl).searchParams.get("next"), "/account");
    assert.equal(fixture.operations.filter(([kind]) => kind === "navigate").length, 1);
  } finally {
    fixture.restore();
  }
});

test("cookie-triggered RSC rerender without query preserves the mounted transient activation entry", async () => {
  const fixture = await routeHookFixture({
    type: "activation",
    token: "private",
  });
  try {
    fixture.prepare();
    fixture.effects[0]();
    for (const run of fixture.timers.values()) run();
    // /auth/activate-order without query renders a resume prop. This mounted
    // operation must still own its original exchange, never start a second one.
    const rerendered = fixture.rerender({ type: "resume" });
    assert.equal(fixture.operations.filter(([kind]) => kind === "start").length, 1);
    assert.equal(rerendered.retry, undefined);
  } finally {
    fixture.restore();
  }
});

test("a new document on the cleaned activation URL resumes server capability without a token", async () => {
  const fixture = await routeHookFixture({ type: "resume" });
  try {
    fixture.location.href = "https://artmate.ru/auth/activate-order";
    fixture.prepare();
    fixture.effects[0]();
    for (const run of fixture.timers.values()) run();
    assert.deepEqual(fixture.operations[0], [
      "start",
      { type: "resume" },
      "https://artmate.ru/auth/activate-order",
    ]);
    assert.equal(
      fixture.operations.some(([kind]) => kind === "navigate"),
      false,
    );
  } finally {
    fixture.restore();
  }
});

test("activation cleanup updates canonical URL even when current Next history state has internal flags", async () => {
  const fixture = await routeHookFixture({
    type: "activation",
    token: "private",
  });
  try {
    fixture.prepare();
    fixture.effects[0]();
    for (const run of fixture.timers.values()) run();
    fixture.refreshFromServer();
    assert.equal(new URL(fixture.location.href).searchParams.has("token"), false);
    assert.equal(new URL(fixture.location.href).searchParams.get("next"), "/account");
    assert.equal(fixture.operations.filter(([kind]) => kind === "start").length, 1);
  } finally {
    fixture.restore();
  }
});

test("password reset cleans the public URL and asks the router to discard token-bearing history", async () => {
  const previous = globalThis.window;
  let canonicalUrl = "https://artmate.ru/auth/reset-password?token=private";
  const location = { href: canonicalUrl };
  let mutationInput;
  const values = { password: "Example2026", passwordConfirm: "Example2026" };
  globalThis.window = {
    location,
    history: {
      state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["fixture"] },
      replaceState: (data, _, url) => {
        assert.equal(data, null);
        location.href = new URL(url, location.href).href;
        if (!data?.__NA && !data?._N) canonicalUrl = location.href;
      },
    },
  };
  const hook = evaluate(await read("src/features/auth/lib/use-password-reset-route.ts"), {
    react: {
      useState: (value) => [value, () => {}],
      useRef: (value) => ({ current: value }),
      useEffect: (effect) => effect(),
      useLayoutEffect: (effect) => effect(),
    },
    "next/navigation": {
      useRouter: () => ({
        replace: (url) => {
          canonicalUrl = new URL(url, location.href).href;
        },
      }),
    },
    "react-hook-form": {
      useForm: () => ({
        reset() {},
        register() {},
        formState: { errors: {} },
        handleSubmit: (callback) => callback,
      }),
    },
    "@hookform/resolvers/zod": { zodResolver: () => undefined },
    "@/shared/constants": { routes },
    "../model/use-confirm-recovery-password": {
      useConfirmRecoveryPassword: () => ({
        isPending: false,
        mutateAsync: async (input) => {
          mutationInput = input;
          return { ok: true };
        },
      }),
    },
    "./flow-form-values": {},
  });
  try {
    await hook.usePasswordResetRoute("private").submit(values);
    assert.deepEqual(mutationInput, { token: "private", ...values });
    location.href = canonicalUrl;
    assert.equal(new URL(location.href).searchParams.has("token"), false);
    assert.equal(new URL(location.href).pathname, "/auth/reset-password");
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test("activation waits for clean router navigation before starting its automatic exchange", async () => {
  const fixture = await routeHookFixture({
    type: "activation",
    token: "private",
  });
  try {
    fixture.prepare(false);
    fixture.effects[0]();
    assert.equal(fixture.timers.size, 0);
    assert.equal(
      fixture.operations.some(([kind]) => kind === "start"),
      false,
    );
    fixture.finishNavigation();
    fixture.effects[0]();
    for (const run of fixture.timers.values()) run();
    assert.equal(fixture.operations.filter(([kind]) => kind === "start").length, 1);
  } finally {
    fixture.restore();
  }
});
