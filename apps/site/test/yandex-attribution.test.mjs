import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const counterId = 109148727;
const clientIdKey = "artmate:yandex:client-id";
const yclidKey = "artmate:yandex:yclid";
const ttl = 21 * 24 * 60 * 60 * 1000;

async function loadAttribution() {
  const source = await readFile(
    new URL("../src/shared/lib/analytics/yandex-attribution.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const timers = new Map();
  let nextTimer = 0;
  let now = 1_800_000_000_000;
  const clock = {
    timers,
    tick(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
  const loadedModule = { exports: {} };
  new Function("module", "exports", "setTimeout", "clearTimeout", "Date", output)(
    loadedModule,
    loadedModule.exports,
    (callback, milliseconds) => {
      const id = ++nextTimer;
      timers.set(id, { callback, at: now + milliseconds });
      return id;
    },
    (id) => timers.delete(id),
    { now: () => now },
  );
  return { ...loadedModule.exports, clock, now: () => now };
}

function createWindow({ ym, storage, href = "https://artmate.ru/checkout", id = counterId } = {}) {
  const values = new Map();
  return {
    ym,
    document: {
      getElementById: () => (id ? { getAttribute: () => String(id) } : null),
      cookie: "_ym_uid=999999999", // Never used as a fabricated fallback.
    },
    localStorage: storage ?? {
      values,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    location: { href },
  };
}

async function withWindow(analyticsWindow, callback) {
  const previousWindow = globalThis.window;
  if (analyticsWindow) globalThis.window = analyticsWindow;
  else delete globalThis.window;
  try {
    return await callback();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test("submit waits for a fresh delayed ClientID and returns a detached snapshot", async () => {
  const attribution = await loadAttribution();
  let callback;
  const analyticsWindow = createWindow({
    ym: (id, command, done) => {
      assert.equal(id, counterId);
      assert.equal(command, "getClientID");
      callback = done;
    },
    href: "https://artmate.ru/checkout?yclid=456",
  });
  analyticsWindow.localStorage.setItem(
    clientIdKey,
    JSON.stringify({ value: "111", capturedAt: attribution.now() - 1000 }),
  );

  await withWindow(analyticsWindow, async () => {
    let completed = false;
    const submission = attribution.resolveYandexAttribution().then((snapshot) => {
      completed = true;
      return snapshot;
    });
    attribution.clock.tick(400);
    await Promise.resolve();
    assert.equal(completed, false);
    callback(" 123 ");
    const snapshot = await submission;
    assert.deepEqual(snapshot, { clientId: "123", yclid: "456" });
    callback("789");
    assert.deepEqual(snapshot, { clientId: "123", yclid: "456" });
    assert.deepEqual(attribution.readYandexAttribution(), snapshot);
    assert.equal(attribution.clock.timers.size, 0);
  });
});

test("timeout permits checkout; the latest late callback can populate only a future snapshot", async () => {
  const attribution = await loadAttribution();
  const ym = function () {
    ym.a.push(arguments);
  };
  const otherCallback = () => undefined;
  const preservedCalls = [
    [counterId, "init", {}],
    [counterId, "reachGoal", "begin_checkout"],
    [counterId, "getClientID", otherCallback],
  ];
  ym.a = [...preservedCalls];
  const analyticsWindow = createWindow({ ym });

  await withWindow(analyticsWindow, async () => {
    attribution.captureYandexAttribution(counterId);
    attribution.captureYandexAttribution(counterId);
    const submission = attribution.resolveYandexAttribution();
    assert.equal(ym.a.length, 4);
    assert.equal(attribution.clock.timers.size, 1);
    const lateCallback = ym.a[3][2];
    attribution.clock.tick(799);
    assert.equal(ym.a.length, 4);
    attribution.clock.tick(1);
    const snapshot = await submission;
    assert.deepEqual(snapshot, {});
    assert.equal(ym.a.length, 4);
    ym.a.pop(); // The SDK consumes its own queued call before invoking the callback.
    lateCallback("123");
    assert.deepEqual(snapshot, {});
    assert.deepEqual(attribution.readYandexAttribution(), { clientId: "123" });
    assert.deepEqual(ym.a, preservedCalls);

    const retry = attribution.resolveYandexAttribution();
    assert.equal(ym.a.length, 4);
    ym.a.pop()[2]("456");
    assert.deepEqual(await retry, { clientId: "456" });
    assert.deepEqual(ym.a, preservedCalls);
    assert.equal(attribution.clock.timers.size, 0);
  });
});

test("a new lookup removes its superseded queued callback and ignores stale completion", async () => {
  const attribution = await loadAttribution();
  const ym = (...args) => {
    ym.a.push(args);
  };
  const otherCall = [counterId, "init", {}];
  ym.a = [otherCall];
  const analyticsWindow = createWindow({ ym });
  await withWindow(analyticsWindow, async () => {
    const previous = attribution.resolveYandexAttribution();
    const staleCallback = ym.a[1][2];
    attribution.clock.tick(800);
    assert.deepEqual(await previous, {});
    const current = attribution.resolveYandexAttribution();
    assert.equal(ym.a.length, 2);
    assert.notEqual(ym.a[1][2], staleCallback);
    staleCallback("111");
    assert.deepEqual(attribution.readYandexAttribution(), {});
    ym.a.pop()[2]("222");
    assert.deepEqual(await current, { clientId: "222" });
    staleCallback("333");
    assert.deepEqual(attribution.readYandexAttribution(), { clientId: "222" });
    assert.deepEqual(ym.a, [otherCall]);
    assert.equal(attribution.clock.timers.size, 0);
  });
});

test("ClientID completion does not mutate the SDK queue while it is being drained", async () => {
  const attribution = await loadAttribution();
  const ym = (...args) => {
    ym.a.push(args);
  };
  ym.a = [];
  const analyticsWindow = createWindow({ ym });
  await withWindow(analyticsWindow, async () => {
    const submission = attribution.resolveYandexAttribution();
    ym.a.push([counterId, "reachGoal", "begin_checkout"]);
    const handled = [];
    for (const call of ym.a) {
      handled.push(call[1]);
      if (call[1] === "getClientID") call[2]("123");
    }
    assert.deepEqual(handled, ["getClientID", "reachGoal"]);
    ym.a = []; // Clearing the consumed bootstrap queue belongs to the SDK.
    assert.deepEqual(await submission, { clientId: "123" });
  });
});

test("blocked localStorage getter does not stop getClientID or memory-only yclid capture", async () => {
  const attribution = await loadAttribution();
  let calls = 0;
  const analyticsWindow = createWindow({
    href: "https://artmate.ru/?yclid=456",
    ym: (_id, _command, done) => {
      calls += 1;
      done("123");
    },
  });
  Object.defineProperty(analyticsWindow, "localStorage", {
    get() {
      throw new Error("SecurityError");
    },
  });
  await withWindow(analyticsWindow, async () => {
    assert.deepEqual(await attribution.resolveYandexAttribution(), {
      clientId: "123",
      yclid: "456",
    });
    assert.equal(calls, 1);
    analyticsWindow.location.href = "https://artmate.ru/checkout";
    attribution.clock.tick(ttl);
    assert.deepEqual(attribution.readYandexAttribution(), { clientId: "123", yclid: "456" });
    attribution.clock.tick(1);
    assert.deepEqual(attribution.readYandexAttribution(), {});
  });
});

test("SSR, absent counter, absent or throwing ym return without waiting or inventing an identifier", async () => {
  const attribution = await loadAttribution();
  await withWindow(undefined, async () => {
    assert.deepEqual(await attribution.resolveYandexAttribution(), {});
    attribution.captureYandexAttribution(counterId);
  });
  for (const analyticsWindow of [
    createWindow(),
    createWindow({ id: undefined }),
    createWindow({ id: -1, ym: () => assert.fail("invalid counter") }),
    createWindow({ id: 0, ym: () => assert.fail("absent counter") }),
    createWindow({
      ym: () => {
        throw new Error("blocked");
      },
    }),
  ]) {
    await withWindow(analyticsWindow, async () => {
      assert.deepEqual(await attribution.resolveYandexAttribution(), {});
      assert.equal(attribution.clock.timers.size, 0);
    });
  }
  const throwingSdk = createWindow();
  Object.defineProperty(throwingSdk, "ym", {
    get() {
      throw new Error("SDK access blocked");
    },
  });
  await withWindow(throwingSdk, async () => {
    assert.deepEqual(await attribution.resolveYandexAttribution(), {});
    assert.equal(attribution.clock.timers.size, 0);
  });
});

test("timeout retains valid saved attribution and never renews its TTL just by reading", async () => {
  const attribution = await loadAttribution();
  const analyticsWindow = createWindow({ ym: () => undefined });
  analyticsWindow.localStorage.setItem(
    clientIdKey,
    JSON.stringify({ value: "123", capturedAt: attribution.now() - ttl + 800 }),
  );
  analyticsWindow.localStorage.setItem(
    yclidKey,
    JSON.stringify({ value: "456", capturedAt: attribution.now() - ttl + 799 }),
  );
  await withWindow(analyticsWindow, async () => {
    const submission = attribution.resolveYandexAttribution();
    attribution.clock.tick(800);
    assert.deepEqual(await submission, { clientId: "123" });
    attribution.clock.tick(1);
    assert.deepEqual(attribution.readYandexAttribution(), {});
  });
});

test("invalid callbacks do not overwrite valid attribution or accept PII and oversized IDs", async () => {
  const attribution = await loadAttribution();
  let response = "123";
  const analyticsWindow = createWindow({ ym: (_id, _command, callback) => callback(response) });
  await withWindow(analyticsWindow, async () => {
    assert.deepEqual(await attribution.resolveYandexAttribution(), { clientId: "123" });
    for (const invalid of [
      undefined,
      null,
      456,
      "",
      "1.2",
      "person@example.com",
      "9".repeat(129),
      { id: "456" },
    ]) {
      response = invalid;
      assert.deepEqual(await attribution.resolveYandexAttribution(), { clientId: "123" });
      assert.equal(attribution.clock.timers.size, 0);
    }
  });
});

test("URL access errors do not prevent ClientID lookup and an initialized counter is reusable", async () => {
  const attribution = await loadAttribution();
  const analyticsWindow = createWindow({
    id: 0,
    ym: (_id, _command, callback) => callback("123"),
  });
  Object.defineProperty(analyticsWindow, "location", {
    get() {
      throw new Error("unavailable URL");
    },
  });
  await withWindow(analyticsWindow, async () => {
    attribution.captureYandexAttribution(counterId);
    assert.deepEqual(await attribution.resolveYandexAttribution(), { clientId: "123" });
    assert.equal(attribution.clock.timers.size, 0);
  });
});
