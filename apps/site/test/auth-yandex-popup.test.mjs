import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/auth/lib/yandex-popup.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise((accept) => {
    resolve = accept;
  });
  return { resolve, promise };
};
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const ready = { status: "PENDING", nextStep: "consents" };
function fixture({ blocked = false, start, read } = {}) {
  let now = 0;
  const listeners = new Set();
  const timers = new Set();
  const events = [];
  let reads = 0;
  const popup = {
    closed: false,
    close() {
      this.closed = true;
    },
    location: {
      replace(url) {
        events.push(["navigate", url]);
      },
    },
  };
  const window = {
    location: { origin: "https://artmate.test" },
    open() {
      events.push(["open"]);
      return blocked ? null : popup;
    },
    addEventListener(_name, callback) {
      listeners.add(callback);
    },
    removeEventListener(_name, callback) {
      listeners.delete(callback);
    },
  };
  const channel = { closed: false, onmessage: null, close() { this.closed = true; } };
  const loaded = { exports: {} };
  new Function("module", "exports", "window", "setInterval", "clearInterval", "Date", "BroadcastChannel", js)(
    loaded,
    loaded.exports,
    window,
    (fn) => {
      timers.add(fn);
      return fn;
    },
    (fn) => timers.delete(fn),
    class extends Date {
      static now() {
        return now;
      }
    },
    class { constructor() { return channel; } },
  );
  const handle = loaded.exports.YandexPopup.open({
    start:
      start ??
      (async () => {
        events.push(["start"]);
        return {
          attemptId: "attempt-1",
          authorizationUrl: "https://oauth.yandex.ru/authorize?state=opaque",
        };
      }),
    read: async (id) => {
      reads++;
      return read ? read(id) : { attemptId: id, status: "PENDING", state: ready };
    },
  });
  const outcome = handle.result.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  return {
    handle,
    channel,
    outcome,
    popup,
    events,
    listeners,
    timers,
    reads: () => reads,
    message(overrides = {}) {
      for (const fn of listeners)
        fn({
          origin: window.location.origin,
          source: popup,
          data: { type: "artmate:oauth", attemptId: "attempt-1" },
          ...overrides,
        });
    },
    tick(ms) {
      now += ms;
      for (const fn of [...timers]) fn();
    },
  };
}
test("popup is opened synchronously before awaiting a server start", async () => {
  const f = fixture();
  assert.deepEqual(
    f.events.map(([name]) => name),
    ["open", "start"],
  );
  await flush();
  assert.match(f.events[2][1], /^https:\/\/oauth.yandex.ru\/authorize/);
  f.message();
  assert.deepEqual((await f.outcome).value, ready);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.timers.size, 0);
});
test("blocked popup neither starts OAuth nor falls back to full-page redirect", async () => {
  const f = fixture({ blocked: true });
  assert.equal((await f.outcome).error.code, "POPUP_BLOCKED");
  assert.deepEqual(f.events, [["open"]]);
});
test("wrong origin, source, attempt and message type cannot wake the server read", async () => {
  const f = fixture();
  await flush();
  f.message({ origin: "https://evil.test" });
  f.message({ source: {} });
  f.message({ data: { type: "artmate:oauth", attemptId: "other" } });
  f.message({ data: { type: "login", attemptId: "attempt-1", user: {} } });
  await flush();
  assert.equal(f.reads(), 0);
  f.message();
  assert.deepEqual((await f.outcome).value, ready);
});
test("message cannot authenticate: WAITING stays pending until a bound read is ready", async () => {
  let readyOnServer = false;
  const f = fixture({
    read: async (id) =>
      readyOnServer
        ? { attemptId: id, status: "PENDING", state: ready }
        : { attemptId: id, status: "WAITING" },
  });
  await flush();
  f.message();
  await flush();
  assert.equal(f.popup.closed, false);
  readyOnServer = true;
  f.message();
  assert.deepEqual((await f.outcome).value, ready);
  assert.equal(f.reads(), 2);
});
test("denied provider result closes only its popup and returns its typed failure", async () => {
  const f = fixture({
    read: async (id) => ({ attemptId: id, status: "REJECTED", errorCode: "PROVIDER_DENIED" }),
  });
  await flush();
  f.message();
  assert.equal((await f.outcome).error.code, "PROVIDER_DENIED");
  assert.equal(f.popup.closed, true);
});
test("cancel before start response waits for cookie mutation to drain", async () => {
  const start = deferred();
  const f = fixture({ start: () => start.promise });
  let settled = false;
  void f.outcome.then(() => {
    settled = true;
  });
  f.handle.cancel();
  await flush();
  assert.equal(settled, false);
  assert.equal(f.popup.closed, true);
  start.resolve({ attemptId: "attempt-1", authorizationUrl: "https://oauth.yandex.ru/authorize" });
  assert.equal((await f.outcome).error.code, "POPUP_CLOSED");
  assert.equal(f.events.length, 1);
});
test("closed popup recovers a lost message by reading its persisted result", async () => {
  const f = fixture();
  await flush();
  f.popup.closed = true;
  f.tick(1000);
  assert.deepEqual((await f.outcome).value, ready);
  assert.equal(f.reads(), 1);
});
test("COOP-detached popup is not mistaken for cancellation; explicit cancel stops waiting", async () => {
  const f = fixture({ read: async (id) => ({ attemptId: id, status: "WAITING" }) });
  await flush();
  f.popup.closed = true;
  f.tick(250);
  await flush();
  f.tick(2100);
  await flush();
  assert.equal(f.timers.size, 1);
  f.handle.cancel();
  assert.equal((await f.outcome).error.code, "POPUP_CLOSED");
  assert.equal(f.timers.size, 0);
});
test("popup timeout removes listeners and timers", async () => {
  const f = fixture();
  await flush();
  f.tick(600001);
  assert.equal((await f.outcome).error.code, "POPUP_TIMEOUT");
  assert.equal(f.listeners.size, 0);
  assert.equal(f.timers.size, 0);
});
test("unexpected authorization destination is never navigated", async () => {
  const f = fixture({
    start: async () => ({
      attemptId: "attempt-1",
      authorizationUrl: "https://evil.test/authorize",
    }),
  });
  assert.ok((await f.outcome).error);
  assert.equal(
    f.events.some(([name]) => name === "navigate"),
    false,
  );
});

test("same-origin broadcast only wakes an authoritative server read after COOP separation", async () => {
  const f = fixture(); await flush();
  f.channel.onmessage({ data: { type: "artmate:oauth", attemptId: "other" } });
  assert.equal(f.reads(), 0);
  f.channel.onmessage({ data: { type: "artmate:oauth", attemptId: "attempt-1", user: { id: "forged" } } });
  assert.deepEqual((await f.outcome).value, ready); assert.equal(f.channel.closed, true);
});
