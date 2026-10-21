import assert from "node:assert/strict";
import process from "node:process";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
function evaluate(source, mocks = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function hooks() {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const cleanup = [];
  const useEffect = (fn, deps) => {
    const id = cursor++;
    const previous = slots[id];
    if (!previous || deps?.some((value, index) => value !== previous[index])) {
      slots[id] = deps;
      effects.push(fn);
    }
  };
  return {
    react: {
      useEffect,
      useLayoutEffect: useEffect,
      useRef(initial) {
        const id = cursor++;
        slots[id] ??= { current: initial };
        return slots[id];
      },
      useState(initial) {
        const id = cursor++;
        if (!(id in slots)) slots[id] = typeof initial === "function" ? initial() : initial;
        return [
          slots[id],
          (value) => {
            slots[id] = typeof value === "function" ? value(slots[id]) : value;
          },
        ];
      },
    },
    render(fn, ...args) {
      cursor = 0;
      return fn(...args);
    },
    flush() {
      for (const effect of effects.splice(0)) {
        const done = effect();
        if (done) cleanup.push(done);
      }
    },
    unmount() {
      cleanup.forEach((fn) => fn());
    },
  };
}
async function stateFixture(initialToken) {
  if (arguments.length === 0) initialToken = "a".repeat(43);
  const harness = hooks(),
    requests = [],
    history = [];
  let result = deferred();
  const previousWindow = globalThis.window;
  globalThis.window = { history: { replaceState: (...args) => history.push(args) } };
  const { useUnsubscribeState } = evaluate(
    await read("features/email-unsubscribe/lib/use-unsubscribe-state.ts"),
    {
      react: harness.react,
      "next/navigation": { useRouter: () => ({ replace() {} }) },
      "@/shared/constants": { routes: { unsubscribe: "/unsubscribe" } },
      "../model/use-unsubscribe": {
        useUnsubscribe: () => ({
          isPending: false,
          unsubscribe: (input) => {
            requests.push(input);
            return result.promise;
          },
        }),
      },
    },
  );
  const render = (token = initialToken) => harness.render(useUnsubscribeState, token);
  const value = render();
  harness.flush();
  return {
    harness,
    requests,
    history,
    render,
    value,
    setResult(next) {
      result = next;
    },
    restore() {
      harness.unmount();
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    },
  };
}
test("unsubscribe GET only captures in memory and clears canonical URL without a POST", async () => {
  const f = await stateFixture();
  try {
    assert.equal(f.value.status, "ready");
    assert.deepEqual(f.requests, []);
    assert.deepEqual(f.history, [[null, "", "/unsubscribe"]]);
  } finally {
    f.restore();
  }
});
test("RSC query cleanup preserves capability and duplicate click sends exactly one request after explicit action", async () => {
  const f = await stateFixture();
  try {
    const ack = deferred();
    f.setResult(ack);
    const first = f.render(undefined).confirm();
    const second = f.render(undefined).confirm();
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].token, "a".repeat(43));
    assert.equal(f.render().status, "ready");
    assert.equal(f.requests.length, 1);
    ack.resolve("unsubscribed");
    await Promise.all([first, second]);
  } finally {
    f.restore();
  }
});
test("acknowledged unsubscribe clears the capability and focuses the result", async () => {
  const f = await stateFixture();
  try {
    const ack = deferred();
    f.setResult(ack);
    const p = f.value.confirm();
    let focused = 0;
    f.value.titleRef.current = {
      focus() {
        focused++;
      },
    };
    assert.equal(f.render().status, "ready");
    ack.resolve("unsubscribed");
    await p;
    assert.equal(f.render().status, "unsubscribed");
    f.harness.flush();
    assert.equal(focused, 1);
    await f.render().confirm();
    assert.equal(f.requests.length, 1);
  } finally {
    f.restore();
  }
});
test("invalid and missing shapes never send a request", async () => {
  for (const token of [undefined, "", "email@example.test", "a".repeat(42), "/".repeat(43)]) {
    const f = await stateFixture(token);
    try {
      assert.equal(f.value.status, "invalid");
      await f.value.confirm();
      assert.equal(f.requests.length, 0);
    } finally {
      f.restore();
    }
  }
});
test("server-invalid link is a terminal safe result without an address", async () => {
  const f = await stateFixture();
  try {
    const ack = deferred();
    f.setResult(ack);
    const p = f.value.confirm();
    ack.resolve("invalid");
    await p;
    const value = f.render();
    assert.equal(value.status, "invalid");
    assert.equal(value.error, undefined);
    await value.confirm();
    assert.equal(f.requests.length, 1);
  } finally {
    f.restore();
  }
});
test("temporary failure keeps capability for explicit retry and never displays raw error", async () => {
  const f = await stateFixture();
  try {
    const ack = deferred();
    f.setResult(ack);
    const p = f.value.confirm();
    ack.reject(new Error("private-token@example.test"));
    await p;
    let value = f.render();
    assert.equal(value.status, "ready");
    assert.equal(value.error, "Не удалось отписаться. Попробуйте ещё раз.");
    const retry = deferred();
    f.setResult(retry);
    const second = value.confirm();
    retry.resolve("unsubscribed");
    await second;
    value = f.render();
    assert.equal(value.status, "unsubscribed");
    assert.equal(value.error, undefined);
    assert.equal(f.requests.length, 2);
  } finally {
    f.restore();
  }
});
test("late response after unmount cannot publish an outcome", async () => {
  const f = await stateFixture();
  try {
    const ack = deferred();
    f.setResult(ack);
    const p = f.value.confirm();
    f.harness.unmount();
    ack.resolve("unsubscribed");
    await p;
    assert.equal(f.render().status, "ready");
  } finally {
    f.restore();
  }
});
test("revoke-only token never becomes mutation variables, even while pending; reset happens on failure and success", async () => {
  const harness = hooks();
  let options;
  let ack = deferred();
  const calls = [],
    variables = [];
  let resets = 0;
  const { useUnsubscribe } = evaluate(
    await read("features/email-unsubscribe/model/use-unsubscribe.ts"),
    {
      react: harness.react,
      "@tanstack/react-query": {
        useMutation: (opts) => {
          options = opts;
          return {
            isPending: false,
            reset: () => resets++,
            mutateAsync: (...args) => {
              variables.push(args);
              return opts.mutationFn();
            },
          };
        },
      },
      "@/shared/actions/consents": {
        unsubscribeEmail: (input) => {
          calls.push(input);
          return ack.promise;
        },
      },
      "@/shared/lib/api-result": { ApiResult: { fromDTO: (value) => value } },
    },
  );
  const mutation = harness.render(useUnsubscribe);
  const input = { token: "t".repeat(43) };
  const p = mutation.unsubscribe(input);
  assert.deepEqual(variables, [[]]);
  assert.equal(options.gcTime, 0);
  assert.deepEqual(calls, [input]);
  await assert.rejects(mutation.unsubscribe({ token: "another" }), /in progress/);
  ack.resolve({ data: { unsubscribed: true } });
  assert.equal(await p, "unsubscribed");
  assert.equal(resets, 1);
  ack = deferred();
  const bad = mutation.unsubscribe(input);
  ack.reject(new Error("network"));
  await assert.rejects(bad, /network/);
  assert.equal(resets, 2);
  ack = deferred();
  const invalid = mutation.unsubscribe(input);
  ack.resolve({ error: { status: 400 } });
  assert.equal(await invalid, "invalid");
  assert.equal(resets, 3);
});
test("optional evidence transport remains available without grant secret and sanitizes token-bearing URL headers", async () => {
  const { RequestEvidenceProxyHeaders } = evaluate(
    await read("shared/lib/request-evidence-proxy-headers.ts"),
  );
  const old = process.env.AUTH_FLOW_PROXY_SECRET;
  try {
    delete process.env.AUTH_FLOW_PROXY_SECRET;
    assert.deepEqual(
      RequestEvidenceProxyHeaders.create(
        new Headers(),
        "POST",
        "/consents/email-advertising/revoke",
        "{}",
        { required: false },
      ),
      {},
    );
    assert.throws(() =>
      RequestEvidenceProxyHeaders.create(new Headers(), "POST", "/auth/flow/complete", "{}"),
    );
    process.env.AUTH_FLOW_PROXY_SECRET = "isolated-proxy-secret";
    const headers = RequestEvidenceProxyHeaders.create(
      new Headers({
        "next-url": "/unsubscribe?token=private-capability",
        "x-original-url": "https://artmate.ru/unsubscribe?token=private-capability",
        "x-invoke-query": "private-capability",
        cookie: "private-cookie",
        "x-public-context": "kept",
      }),
      "POST",
      "/consents/email-advertising/unsubscribe/confirm",
      "{}",
      { required: false },
    );
    const envelope = JSON.parse(
      Buffer.from(headers["x-artmate-auth-context"], "base64url").toString(),
    );
    const encoded = JSON.stringify(envelope);
    assert.equal(encoded.includes("private-capability"), false);
    assert.equal(encoded.includes("private-cookie"), false);
    assert.deepEqual(envelope.context.headers["x-public-context"], ["kept"]);
  } finally {
    if (old === undefined) delete process.env.AUTH_FLOW_PROXY_SECRET;
    else process.env.AUTH_FLOW_PROXY_SECRET = old;
  }
});
