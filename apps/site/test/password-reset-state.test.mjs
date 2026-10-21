import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL(
    "../src/features/auth/lib/use-password-reset-route.ts",
    import.meta.url,
  ),
  "utf8",
);
function _deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function _fixture(initialToken = "private-reset-capability") {
  let cursor = 0;
  const slots = [],
    effects = [],
    cleanups = [],
    requests = [],
    navigations = [];
  let response = _deferred();
  const react = {
    useRef(initial) {
      const id = cursor++;
      slots[id] ??= { current: initial };
      return slots[id];
    },
    useState(initial) {
      const id = cursor++;
      if (!(id in slots)) slots[id] = initial;
      return [
        slots[id],
        (value) => {
          slots[id] = value;
        },
      ];
    },
    useEffect(effect, deps) {
      const id = cursor++;
      if (!slots[id] || deps.some((value, i) => value !== slots[id][i])) {
        slots[id] = deps;
        effects.push(effect);
      }
    },
  };
  react.useLayoutEffect = react.useEffect;
  const previous = globalThis.window;
  globalThis.window = {
    history: {
      replaceState(data, _, url) {
        assert.equal(data, null);
        navigations.push(["history", url]);
      },
    },
  };
  const router = {
    replace(url) {
      navigations.push(["router", url]);
    },
  };
  const form = {
    register() {},
    reset() {},
    formState: { errors: {} },
    handleSubmit: (callback) => callback,
  };
  const mocks = {
    react,
    "next/navigation": { useRouter: () => router },
    "react-hook-form": { useForm: () => form },
    "@hookform/resolvers/zod": { zodResolver() {} },
    "@/shared/constants": {
      routes: { authResetPassword: "/auth/reset-password" },
    },
    "./flow-form-values": {},
    "../model/use-confirm-recovery-password": {
      useConfirmRecoveryPassword: () => ({
        isPending: false,
        mutateAsync(input) {
          requests.push(input);
          return response.promise;
        },
      }),
    },
  };
  const loaded = { exports: {} };
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", js)(
    (name) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    loaded,
    loaded.exports,
  );
  return {
    requests,
    navigations,
    render(...args) {
      cursor = 0;
      const view = loaded.exports.usePasswordResetRoute(
        args.length ? args[0] : initialToken,
      );
      for (const effect of effects.splice(0)) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      }
      return view;
    },
    get response() {
      return response;
    },
    nextResponse() {
      response = _deferred();
    },
    unmount() {
      cleanups.forEach((fn) => fn());
    },
    close() {
      if (previous === undefined) delete globalThis.window;
      else globalThis.window = previous;
    },
  };
}
const values = { password: "Example2026", passwordConfirm: "Example2026" };

test("reset cleans token history before action, preserves the mounted capability across cleaned RSC props and keeps acknowledged success", async () => {
  const f = _fixture();
  try {
    f.render();
    assert.deepEqual(f.navigations, [
      ["history", "/auth/reset-password"],
      ["router", "/auth/reset-password"],
    ]);
    assert.equal(f.requests.length, 0);
    let view = f.render(undefined);
    assert.equal(view.hasToken, true);
    const first = view.submit(values);
    await view.submit(values);
    assert.deepEqual(f.requests, [
      { token: "private-reset-capability", ...values },
    ]);
    f.response.resolve({ ok: true });
    await first;
    view = f.render(undefined);
    assert.equal(view.isReset, true);
    assert.equal(view.hasToken, false);
    await view.submit(values);
    assert.equal(f.requests.length, 1);
  } finally {
    f.close();
  }
});

test("reset retains its capability for a safe retry after an unacknowledged or failed response", async () => {
  const f = _fixture();
  try {
    let view = f.render();
    const first = view.submit(values);
    f.response.reject(new Error("raw private transport error"));
    await first;
    view = f.render(undefined);
    assert.equal(view.isReset, false);
    assert.equal(view.hasToken, true);
    assert.equal(view.error.includes("private"), false);
    f.nextResponse();
    const retry = view.submit(values);
    f.response.resolve({ ok: true });
    await retry;
    assert.equal(f.render(undefined).isReset, true);
    assert.equal(f.requests.length, 2);
  } finally {
    f.close();
  }
});

test("reset never publishes a late successful result after unmount", async () => {
  const f = _fixture();
  try {
    const pending = f.render().submit(values);
    f.unmount();
    f.response.resolve({ ok: true });
    await pending;
    assert.equal(f.render(undefined).isReset, false);
  } finally {
    f.close();
  }
});
