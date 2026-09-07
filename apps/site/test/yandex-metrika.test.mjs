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

async function loadSanitizer() {
  return evaluateTypeScript(await readSource("src/shared/lib/analytics/sanitize-analytics-url.ts"));
}

function withBrowserGlobals({ analyticsWindow, document }, callback) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = analyticsWindow;
  globalThis.document = document;

  try {
    return callback();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;

    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("Yandex attribution uses getClientID and persists a valid yclid", async () => {
  const attribution = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-attribution.ts"),
  );
  const initializer = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-attribution-initializer.tsx"),
    {
      "./yandex-attribution": attribution,
      react: { useEffect: (effect) => effect() },
    },
  );
  const localStorage = createStorage();
  const ymCalls = [];
  const analyticsWindow = {
    localStorage,
    location: { href: "https://artmate.ru/catalog?yclid=1234567890" },
    ym: (...args) => {
      ymCalls.push(args);
      args[2]?.("9876543210");
    },
  };

  withBrowserGlobals({ analyticsWindow, document: {} }, () => {
    initializer.YandexAttributionInitializer({ counterId: 109148727 });
    assert.deepEqual(attribution.readYandexAttribution(), {
      clientId: "9876543210",
      yclid: "1234567890",
    });
  });

  assert.equal(ymCalls.length, 1);
  assert.equal(ymCalls[0][0], 109148727);
  assert.equal(ymCalls[0][1], "getClientID");
  assert.equal(typeof ymCalls[0][2], "function");
});

test("Yandex attribution replaces stored yclid only with a valid bounded query value", async () => {
  const attribution = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-attribution.ts"),
  );
  const initializer = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-attribution-initializer.tsx"),
    {
      "./yandex-attribution": attribution,
      react: { useEffect: (effect) => effect() },
    },
  );
  const localStorage = createStorage({ "artmate:yandex:yclid": "111" });
  const analyticsWindow = {
    localStorage,
    location: { href: "https://artmate.ru/?yclid=222" },
    ym: () => undefined,
  };

  withBrowserGlobals({ analyticsWindow, document: {} }, () => {
    initializer.YandexAttributionInitializer({ counterId: 109148727 });
    assert.equal(attribution.readYandexAttribution().yclid, "222");

    analyticsWindow.location.href = `https://artmate.ru/?yclid=${"9".repeat(129)}`;
    initializer.YandexAttributionInitializer({ counterId: 109148727 });
    assert.equal(attribution.readYandexAttribution().yclid, "222");

    analyticsWindow.location.href = "https://artmate.ru/?yclid=not-a-yandex-id";
    initializer.YandexAttributionInitializer({ counterId: 109148727 });
    assert.equal(attribution.readYandexAttribution().yclid, "222");
  });
});

test("Yandex attribution stores timestamped records and enforces the exact 21 day TTL", async () => {
  const attribution = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-attribution.ts"),
  );
  const ttl = 21 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const originalDateNow = Date.now;
  const localStorage = createStorage({
    "artmate:yandex:client-id": JSON.stringify({ value: "1", capturedAt: now - ttl }),
    "artmate:yandex:yclid": JSON.stringify({ value: "2", capturedAt: now - ttl - 1 }),
  });

  Date.now = () => now;
  try {
    withBrowserGlobals(
      { analyticsWindow: { localStorage, location: { href: "https://artmate.ru" } }, document: {} },
      () => {
        assert.deepEqual(attribution.readYandexAttribution(), { clientId: "1" });
      },
    );
  } finally {
    Date.now = originalDateNow;
  }
  assert.equal(localStorage.values.has("artmate:yandex:yclid"), false);
});

test("Yandex attribution removes malformed, future, legacy, and invalid records", async () => {
  const attribution = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-attribution.ts"),
  );
  const now = Date.now();
  const originalDateNow = Date.now;
  const invalidRecords = [
    "123",
    "{bad-json",
    JSON.stringify({ value: "123", capturedAt: now + 1 }),
    JSON.stringify({ value: "123.456", capturedAt: now }),
    JSON.stringify({ value: "１２３", capturedAt: now }),
  ];

  Date.now = () => now;
  try {
    for (const value of invalidRecords) {
      const localStorage = createStorage({ "artmate:yandex:client-id": value });
      withBrowserGlobals(
        { analyticsWindow: { localStorage, location: { href: "https://artmate.ru" } }, document: {} },
        () => assert.deepEqual(attribution.readYandexAttribution(), {}),
      );
      assert.equal(localStorage.values.has("artmate:yandex:client-id"), false);
    }
  } finally {
    Date.now = originalDateNow;
  }
});

test("Yandex attribution is empty during SSR and when browser storage is blocked", async () => {
  const attribution = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-attribution.ts"),
  );
  const previousWindow = globalThis.window;
  delete globalThis.window;

  try {
    assert.deepEqual(attribution.readYandexAttribution(), {});
  } finally {
    if (previousWindow !== undefined) globalThis.window = previousWindow;
  }

  const blockedStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };

  withBrowserGlobals(
    {
      analyticsWindow: {
        localStorage: blockedStorage,
        location: { href: "https://artmate.ru/?yclid=123" },
        ym: (_counterId, command, callback) => {
          assert.equal(command, "getClientID");
          callback("456");
        },
      },
      document: {},
    },
    () => {
      attribution.captureYandexAttribution(109148727);
      assert.deepEqual(attribution.readYandexAttribution(), {});
    },
  );

  withBrowserGlobals(
    {
      analyticsWindow: {
        localStorage: {
          getItem: () => "{bad-json",
          removeItem: () => {
            throw new Error("blocked");
          },
        },
        location: { href: "https://artmate.ru" },
      },
      document: {},
    },
    () => assert.deepEqual(attribution.readYandexAttribution(), {}),
  );
});

test("Yandex Metrika initializes once with sanitized URL and referrer", async () => {
  const sanitizer = await loadSanitizer();
  const initializer = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-metrika-initializer.tsx"),
    {
      "./sanitize-analytics-url": sanitizer,
      react: { useEffect: (effect) => effect() },
    },
  );
  const analyticsWindow = {
    location: {
      href: "https://artmate.ru/auth?utm_source=yandex&token=secret&email=user%40example.com#code",
    },
  };
  const document = {
    referrer: "https://search.example/?utm_campaign=brand&phone=%2B79990000000#result",
  };

  withBrowserGlobals({ analyticsWindow, document }, () => {
    initializer.YandexMetrikaInitializer({ counterId: 109148727 });
    initializer.YandexMetrikaInitializer({ counterId: 109148727 });
  });

  assert.deepEqual(analyticsWindow.dataLayer, []);
  assert.equal(typeof analyticsWindow.ym, "function");
  assert.equal(analyticsWindow.ym.a.length, 1);
  assert.deepEqual(analyticsWindow.ym.a[0], [
    109148727,
    "init",
    {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: "dataLayer",
      referrer: "https://search.example/?utm_campaign=brand",
      url: "https://artmate.ru/auth?utm_source=yandex",
      accurateTrackBounce: true,
      trackLinks: true,
    },
  ]);
});

test("Yandex Metrika preserves an existing ym implementation and queue", async () => {
  const sanitizer = await loadSanitizer();
  const initializer = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-metrika-initializer.tsx"),
    {
      "./sanitize-analytics-url": sanitizer,
      react: { useEffect: (effect) => effect() },
    },
  );
  const ymCalls = [];
  const existingYandexMetrika = (...args) => ymCalls.push(args);
  existingYandexMetrika.a = [["queued-before-artmate"]];
  const analyticsWindow = {
    location: { href: "https://artmate.ru/catalog" },
    ym: existingYandexMetrika,
  };
  const document = { referrer: "" };

  withBrowserGlobals({ analyticsWindow, document }, () => {
    initializer.YandexMetrikaInitializer({ counterId: 109148726 });
    initializer.YandexMetrikaInitializer({ counterId: 109148726 });
  });

  assert.equal(analyticsWindow.ym, existingYandexMetrika);
  assert.deepEqual(existingYandexMetrika.a, [["queued-before-artmate"]]);
  assert.equal(ymCalls.length, 1);
  assert.equal(ymCalls[0][0], 109148726);
  assert.equal(ymCalls[0][1], "init");
});

test("SPA pageview sends only changed sanitized URLs with a safe referer", async () => {
  const sanitizer = await loadSanitizer();
  const currentUrlRef = { current: null };
  const pageView = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/yandex-metrika-page-view.tsx"),
    {
      "./sanitize-analytics-url": sanitizer,
      "next/navigation": {
        usePathname: () => "/catalog",
        useSearchParams: () => new URLSearchParams(),
      },
      react: {
        useEffect: (effect) => effect(),
        useRef: () => currentUrlRef,
      },
    },
  );
  const ymCalls = [];
  const analyticsWindow = {
    location: {
      href: "https://artmate.ru/catalog?utm_source=menu&email=user%40example.com#top",
    },
    ym: (...args) => ymCalls.push(args),
  };
  const document = { referrer: "" };

  withBrowserGlobals({ analyticsWindow, document }, () => {
    pageView.YandexMetrikaPageView({ counterId: 109148727 });
    analyticsWindow.location.href =
      "https://artmate.ru/product/markers?utm_source=catalog&access_token=secret#reviews";
    pageView.YandexMetrikaPageView({ counterId: 109148727 });
    pageView.YandexMetrikaPageView({ counterId: 109148727 });
  });

  assert.deepEqual(ymCalls, [
    [
      109148727,
      "hit",
      "https://artmate.ru/product/markers?utm_source=catalog",
      { referer: "https://artmate.ru/catalog?utm_source=menu" },
    ],
  ]);
});
