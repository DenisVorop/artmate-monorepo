import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function loadDraftState() {
  const source = await readFile(
    new URL("../src/features/checkout/lib/delivery-picker-state.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };

  new Function("require", "module", "exports", output)(
    (specifier) => {
      throw new Error(`Unexpected test module import: ${specifier}`);
    },
    testModule,
    testModule.exports,
  );

  return testModule.exports;
}

const cdekPointA = {
  address: "Москва, ул. А, 1",
  cityCode: 44,
  deliveryPrice: 200,
  id: "CDEK-A",
  latitude: 55.75,
  longitude: 37.61,
  title: "СДЭК A",
  workHours: "09:00-21:00",
};
const cdekPointB = { ...cdekPointA, address: "Москва, ул. Б, 2", id: "CDEK-B" };
const ozonPoint = {
  address: "Москва, ул. Ozon, 3",
  deliveryPrice: 100,
  id: "OZON-B",
  latitude: 55.8,
  longitude: 37.7,
  title: "Ozon B",
  workHours: "10:00-22:00",
};
const ozonViewport = {
  viewport: {
    leftBottom: { lat: 55.6, long: 37.4 },
    rightTop: { lat: 55.9, long: 37.9 },
  },
  zoom: 13,
};

function calculation(candidate, overrides = {}) {
  const point = candidate.provider === "cdek" ? cdekPointB : ozonPoint;

  return {
    cartId: "cart-a",
    currency: "RUB",
    delivery: { pickupPoint: point, provider: candidate.provider },
    deliveryPrice: point.deliveryPrice,
    discount: 0,
    itemsCount: 1,
    promoCode: null,
    subtotal: 1_000,
    total: 1_000 + point.deliveryPrice,
    ...overrides,
  };
}

test("calculation guard accepts complete matching CDEK and Ozon responses", async () => {
  const { isMatchingCheckoutCalculation } = await loadDraftState();
  const cdekCandidate = { cityCode: 44, pickupPointId: cdekPointB.id, provider: "cdek" };
  const ozonCandidate = { pickupPointId: ozonPoint.id, provider: "ozon" };

  assert.equal(
    isMatchingCheckoutCalculation(
      calculation(cdekCandidate, {
        discount: 100,
        estimatedDeliveryDateRange: { min: "2026-09-08", max: "2026-09-10" },
        promoCode: "SALE10",
        total: 1_100,
      }),
      cdekCandidate,
      "cart-a",
    ),
    true,
  );
  assert.equal(
    isMatchingCheckoutCalculation(calculation(ozonCandidate), ozonCandidate, "cart-a"),
    true,
  );
  assert.equal(
    isMatchingCheckoutCalculation(
      calculation(ozonCandidate, {
        discount: 1,
        subtotal: 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1,
        total: ozonPoint.deliveryPrice,
      }),
      ozonCandidate,
      "cart-a",
    ),
    true,
  );
});

test("calculation guard rejects structurally malformed matching responses", async () => {
  const { isMatchingCheckoutCalculation } = await loadDraftState();
  const candidate = { cityCode: 44, pickupPointId: cdekPointB.id, provider: "cdek" };
  const valid = calculation(candidate);
  const without = (key) => {
    const value = structuredClone(valid);
    delete value[key];
    return value;
  };
  const malformed = [
    { cartId: "cart-a", delivery: valid.delivery },
    without("itemsCount"),
    without("subtotal"),
    without("discount"),
    without("deliveryPrice"),
    without("total"),
    { ...valid, itemsCount: 0 },
    { ...valid, itemsCount: 1.5 },
    { ...valid, subtotal: Number.NaN },
    { ...valid, discount: Number.POSITIVE_INFINITY },
    { ...valid, deliveryPrice: -1 },
    { ...valid, total: -1 },
    { ...valid, discount: valid.subtotal + 1 },
    { ...valid, currency: "USD" },
    { ...valid, promoCode: 10 },
    { ...valid, delivery: { provider: "cdek" } },
    { ...valid, delivery: { ...valid.delivery, pickupPoint: { ...cdekPointB, id: "" } } },
    { ...valid, delivery: { ...valid.delivery, pickupPoint: { ...cdekPointB, title: "" } } },
    { ...valid, delivery: { ...valid.delivery, pickupPoint: { ...cdekPointB, address: "" } } },
    { ...valid, delivery: { ...valid.delivery, pickupPoint: { ...cdekPointB, workHours: "" } } },
    {
      ...valid,
      delivery: {
        ...valid.delivery,
        pickupPoint: { ...cdekPointB, deliveryPrice: Number.NaN },
      },
    },
    { ...valid, delivery: { ...valid.delivery, pickupPoint: { ...cdekPointB, latitude: Infinity } } },
    { ...valid, delivery: { ...valid.delivery, pickupPoint: { ...cdekPointB, longitude: NaN } } },
    { ...valid, delivery: { ...valid.delivery, pickupPoint: { ...cdekPointB, cityCode: 0 } } },
    {
      ...valid,
      delivery: { ...valid.delivery, pickupPoint: { ...cdekPointB, cityCode: undefined } },
    },
    { ...valid, deliveryPrice: valid.deliveryPrice + 1, total: valid.total + 1 },
    { ...valid, total: valid.total + 1 },
    { ...valid, estimatedDeliveryDateRange: null },
    { ...valid, estimatedDeliveryDateRange: { min: "", max: "2026-09-10" } },
    { ...valid, estimatedDeliveryDateRange: { min: "2026-09-08", max: "" } },
  ];

  for (const value of malformed) {
    assert.equal(isMatchingCheckoutCalculation(value, candidate, "cart-a"), false);
  }

  assert.equal(isMatchingCheckoutCalculation(valid, candidate, ""), false);
  assert.equal(isMatchingCheckoutCalculation(valid, candidate, "cart-b"), false);
  assert.equal(
    isMatchingCheckoutCalculation(
      { ...valid, delivery: { ...valid.delivery, provider: "ozon" } },
      candidate,
      "cart-a",
    ),
    false,
  );
  assert.equal(
    isMatchingCheckoutCalculation(valid, { ...candidate, pickupPointId: "CDEK-A" }, "cart-a"),
    false,
  );
  assert.equal(
    isMatchingCheckoutCalculation(valid, { ...candidate, cityCode: 137 }, "cart-a"),
    false,
  );
});

test("confirmed A stays untouched while draft B survives close and reopen", async () => {
  const { createDeliveryPickerDrafts, selectDraftPickupPoint } = await loadDraftState();
  const confirmed = { cityCode: 44, pickupPointId: "CDEK-A", provider: "cdek" };
  const confirmedPayload = structuredClone(confirmed);
  const persisted = structuredClone(confirmed);
  let drafts = createDeliveryPickerDrafts(confirmed);

  drafts = selectDraftPickupPoint(drafts, "cdek", cdekPointB);
  const reopenedDrafts = drafts;

  assert.deepEqual(confirmed, confirmedPayload);
  assert.deepEqual(persisted, confirmedPayload);
  assert.equal(reopenedDrafts.cdek.pickupPointId, "CDEK-B");
});

test("partial CDEK code survives and changing city clears only its point", async () => {
  const { createDeliveryPickerDrafts, selectDraftCity, selectDraftPickupPoint } =
    await loadDraftState();
  const ozonDraft = {
    mapRequest: ozonViewport,
    pickupPoint: ozonPoint,
    pickupPointId: ozonPoint.id,
  };
  let drafts = createDeliveryPickerDrafts({
    cityCode: 44,
    pickupPointId: "persisted-cdek",
    provider: "cdek",
  });

  assert.equal(drafts.cdek.cityCode, 44);
  assert.equal(drafts.cdek.city, undefined);
  drafts = selectDraftPickupPoint({ ...drafts, ozon: ozonDraft }, "cdek", cdekPointA);
  drafts = selectDraftCity(drafts, { code: 137, countryCode: "RU", name: "Санкт-Петербург" });

  assert.equal(drafts.cdek.cityCode, 137);
  assert.equal(drafts.cdek.pickupPoint, undefined);
  assert.equal(drafts.cdek.pickupPointId, undefined);
  assert.strictEqual(drafts.ozon, ozonDraft);
});

test("Ozon city locator stays in its draft and resets only dependent Ozon state", async () => {
  const {
    getDeliveryDraftCandidate,
    selectOzonDraftCity,
    selectDraftPickupPoint,
    setOzonDraftMapRequest,
  } = await loadDraftState();
  const cdekDraft = {
    city: { code: 44, countryCode: "RU", name: "Москва" },
    cityCode: 44,
    pickupPoint: cdekPointA,
    pickupPointId: cdekPointA.id,
  };
  const city = { code: 137, countryCode: "RU", name: "Санкт-Петербург" };
  let drafts = { cdek: cdekDraft, ozon: {} };

  drafts = setOzonDraftMapRequest(drafts, ozonViewport);
  drafts = selectDraftPickupPoint(drafts, "ozon", ozonPoint);
  drafts = selectOzonDraftCity(drafts, city);

  assert.strictEqual(drafts.cdek, cdekDraft);
  assert.deepEqual(drafts.ozon, { city, cityCode: city.code });
  assert.equal(drafts.ozon.pickupPoint, undefined);
  assert.equal(drafts.ozon.pickupPointId, undefined);
  assert.equal(drafts.ozon.mapRequest, undefined);
  assert.equal(getDeliveryDraftCandidate(drafts, "ozon"), undefined);

  drafts = selectDraftPickupPoint(drafts, "ozon", ozonPoint);
  assert.deepEqual(getDeliveryDraftCandidate(drafts, "ozon"), {
    pickupPointId: ozonPoint.id,
    provider: "ozon",
  });
  assert.equal("cityCode" in getDeliveryDraftCandidate(drafts, "ozon"), false);
});

test("Ozon locator focus ignores stale cities and points without coordinates", async () => {
  const { getOzonLocatorMapFocus } = await loadDraftState();
  const points = [
    cdekPointA,
    cdekPointB,
    { ...cdekPointB, id: "without-coordinates", latitude: undefined, longitude: undefined },
  ];

  assert.equal(getOzonLocatorMapFocus(137, 44, points), undefined);
  assert.equal(
    getOzonLocatorMapFocus(137, 137, [
      { ...cdekPointA, latitude: undefined, longitude: undefined },
    ]),
    undefined,
  );
  assert.deepEqual(getOzonLocatorMapFocus(137, 137, points), {
    key: "ozon-city:137",
    points: [
      { lat: cdekPointA.latitude, long: cdekPointA.longitude },
      { lat: cdekPointB.latitude, long: cdekPointB.longitude },
    ],
  });
});

test("Ozon server seed supplies point coordinates and preserves viewport", async () => {
  const {
    createDeliveryPickerDrafts,
    getOzonDraftInitialView,
    setOzonDraftMapRequest,
    seedDeliveryPickerDrafts,
  } = await loadDraftState();
  const confirmed = { pickupPointId: ozonPoint.id, provider: "ozon" };
  let drafts = createDeliveryPickerDrafts(confirmed);

  drafts = setOzonDraftMapRequest(drafts, ozonViewport);
  drafts = seedDeliveryPickerDrafts(drafts, confirmed, calculation(confirmed));

  assert.deepEqual(drafts.ozon.pickupPoint, ozonPoint);
  assert.strictEqual(drafts.ozon.mapRequest, ozonViewport);
  assert.deepEqual(getOzonDraftInitialView(drafts.ozon), {
    center: { lat: ozonPoint.latitude, long: ozonPoint.longitude },
    zoom: ozonViewport.zoom,
  });
  assert.deepEqual(getOzonDraftInitialView({ mapRequest: ozonViewport }), {
    center: { lat: 55.75, long: 37.65 },
    zoom: 13,
  });
  assert.deepEqual(getOzonDraftInitialView({}), {
    center: { lat: 55.75, long: 37.62 },
    zoom: 11,
  });
});

test("point selection changes only draft and produces strict candidates", async () => {
  const {
    createDeliveryPickerDrafts,
    getDeliveryDraftCandidate,
    isSameDeliverySelection,
    selectDraftPickupPoint,
  } = await loadDraftState();
  let commits = 0;
  let closes = 0;
  let drafts = createDeliveryPickerDrafts();

  drafts = selectDraftPickupPoint(drafts, "ozon", ozonPoint);

  assert.deepEqual(getDeliveryDraftCandidate(drafts, "ozon"), {
    pickupPointId: ozonPoint.id,
    provider: "ozon",
  });
  assert.equal(getDeliveryDraftCandidate(drafts, "cdek"), undefined);
  assert.equal(
    isSameDeliverySelection(
      { pickupPointId: ozonPoint.id, provider: "ozon" },
      { pickupPointId: ozonPoint.id, provider: "ozon" },
    ),
    true,
  );
  assert.equal(
    isSameDeliverySelection(
      { cityCode: 44, pickupPointId: cdekPointA.id, provider: "cdek" },
      { cityCode: 137, pickupPointId: cdekPointA.id, provider: "cdek" },
    ),
    false,
  );
  assert.equal(commits, 0);
  assert.equal(closes, 0);
});

test("confirmation commits, writes, and closes once only for a matching fresh response", async () => {
  const { createDeliveryConfirmationCoordinator } = await loadDraftState();
  const candidate = { cityCode: 44, pickupPointId: cdekPointB.id, provider: "cdek" };
  const events = [];
  const coordinator = createDeliveryConfirmationCoordinator();
  const result = await coordinator.confirm({
    calculate: async () => calculation(candidate),
    candidate,
    cartId: "cart-a",
    commit: () => events.push("commit"),
  });

  if (result.status === "confirmed") events.push("write", "close");

  assert.equal(result.status, "confirmed");
  assert.deepEqual(events, ["commit", "write", "close"]);
});

test("confirmation failures and response mismatches never mutate confirmed state", async () => {
  const { createDeliveryConfirmationCoordinator } = await loadDraftState();
  const candidate = { cityCode: 44, pickupPointId: cdekPointB.id, provider: "cdek" };
  const cases = [
    async () => {
      throw new Error("offline");
    },
    async () => calculation(candidate, { cartId: "cart-b" }),
    async () => calculation(candidate, { delivery: { pickupPoint: cdekPointB, provider: "ozon" } }),
    async () =>
      calculation(candidate, {
        delivery: { pickupPoint: { ...cdekPointB, id: "wrong" }, provider: "cdek" },
      }),
    async () =>
      calculation(candidate, {
        delivery: { pickupPoint: { ...cdekPointB, cityCode: 137 }, provider: "cdek" },
      }),
    async () => ({ cartId: "cart-a", delivery: null }),
  ];

  for (const calculate of cases) {
    let commits = 0;
    const result = await createDeliveryConfirmationCoordinator().confirm({
      calculate,
      candidate,
      cartId: "cart-a",
      commit: () => {
        commits += 1;
      },
    });

    assert.equal(result.status, "error");
    assert.equal(commits, 0);
  }
});

test("late request A is ignored after B succeeds", async () => {
  const { createDeliveryConfirmationCoordinator } = await loadDraftState();
  const coordinator = createDeliveryConfirmationCoordinator();
  const candidateA = { pickupPointId: "OZON-A", provider: "ozon" };
  const candidateB = { pickupPointId: ozonPoint.id, provider: "ozon" };
  const commits = [];
  let resolveA;
  const requestA = coordinator.confirm({
    calculate: () => new Promise((resolve) => (resolveA = resolve)),
    candidate: candidateA,
    cartId: "cart-a",
    commit: ({ candidate }) => commits.push(candidate.pickupPointId),
  });
  const requestB = coordinator.confirm({
    calculate: async () => calculation(candidateB),
    candidate: candidateB,
    cartId: "cart-a",
    commit: ({ candidate }) => commits.push(candidate.pickupPointId),
  });

  assert.equal((await requestB).status, "confirmed");
  resolveA(
    calculation(candidateA, {
      delivery: { pickupPoint: { ...ozonPoint, id: "OZON-A" }, provider: "ozon" },
    }),
  );
  assert.equal((await requestA).status, "stale");
  assert.deepEqual(commits, [ozonPoint.id]);
});

test("close, cart, promo, account, and unmount invalidations reject pending confirmation", async () => {
  const { createDeliveryConfirmationCoordinator } = await loadDraftState();
  const invalidationReasons = ["close", "cart", "promo", "account", "unmount"];

  for (const reason of invalidationReasons) {
    const coordinator = createDeliveryConfirmationCoordinator();
    const candidate = { pickupPointId: ozonPoint.id, provider: "ozon" };
    let resolveRequest;
    let commits = 0;
    const request = coordinator.confirm({
      calculate: () => new Promise((resolve) => (resolveRequest = resolve)),
      candidate,
      cartId: "cart-a",
      commit: () => {
        commits += 1;
      },
    });

    coordinator.invalidate(reason);
    resolveRequest(calculation(candidate));

    assert.equal((await request).status, "stale", reason);
    assert.equal(commits, 0, reason);
  }
});

test("persisted CDEK without cityCode is rejected", async () => {
  const source = await readSource("src/features/checkout/lib/pickup-selection-storage.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  const values = new Map();
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  new Function("require", "module", "exports", output)(
    (specifier) => {
      throw new Error(`Unexpected test module import: ${specifier}`);
    },
    testModule,
    testModule.exports,
  );
  globalThis.window = {};
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };

  try {
    const key = "artmate:checkout-pickup:cart-a";
    values.set(
      key,
      JSON.stringify({ expiresAt: 10_000, pickupPointId: "CDEK-A", provider: "cdek" }),
    );
    assert.equal(testModule.exports.readPersistedPickupSelection("cart-a", 1_000), undefined);

  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});

test("provider exposes confirmation rather than a destructive candidate setter", async () => {
  const [context, provider, query] = await Promise.all([
    readSource("src/features/checkout/lib/checkout-provider/checkout.context.tsx"),
    readSource("src/features/checkout/lib/checkout-provider/checkout-provider.tsx"),
    readSource("src/features/checkout/model/query.ts"),
  ]);

  assert.doesNotMatch(context, /setSelectedDelivery/u);
  assert.match(context, /confirmDelivery/u);
  assert.match(context, /invalidateDeliveryConfirmation/u);
  assert.match(provider, /createDeliveryConfirmationCoordinator/u);
  assert.match(provider, /writePersistedPickupSelection/u);
  assert.match(provider, /navigator\.onLine\s*===\s*false/u);
  assert.match(
    provider,
    /confirmationIdentity\s*=\s*JSON\.stringify\(\[[\s\S]*cart\.isOzonDeliveryAvailable/u,
  );
  assert.doesNotMatch(provider, /if\s*\(!isMatching[^}]*clearPersistedPickupSelection/su);
  assert.match(query, /checkoutCalculationQueryOptions/u);
  assert.match(query, /checkoutCalculationQueryKey/u);
});

test("field owns controlled carrier drafts and point clicks do not close or commit", async () => {
  const [field, picker, selector] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-method-field.tsx"),
    readSource("src/features/checkout/ui/delivery-picker.tsx"),
    readSource("src/features/checkout/ui/delivery-selector/delivery-selector.tsx"),
  ]);

  assert.match(field, /useState\(\(\)\s*=>\s*createDeliveryPickerDrafts/u);
  assert.match(field, /value=\{selectedDelivery\?\.provider\}/u);
  assert.doesNotMatch(field, /setSelectedDelivery/u);
  assert.match(field, /seedDeliveryPickerDrafts/u);
  assert.match(field, /invalidatePendingConfirmation/u);
  assert.doesNotMatch(field, /draftsRef/u);
  assert.match(picker, /Подтвердить ПВЗ/u);
  assert.match(picker, /min-h-11/u);
  assert.match(picker, /disabled=\{!canConfirm\s*\|\|\s*isConfirming\}/u);
  assert.match(picker, /const confirmLockRef\s*=\s*useRef\(false\)/u);
  assert.match(
    picker,
    /if\s*\(!canConfirm\s*\|\|\s*isConfirming\s*\|\|\s*confirmLockRef\.current\)\s*return/u,
  );
  assert.match(picker, /confirmLockRef\.current\s*=\s*true/u);
  assert.match(picker, /onClick=\{handleConfirm\}/u);
  assert.match(picker, /DrawerClose/u);
  assert.doesNotMatch(picker, /sr-only">Изменить ПВЗ/u);
  assert.doesNotMatch(selector, /onChange/u);
  assert.match(selector, /onDraftChange/u);
  assert.doesNotMatch(
    selector.slice(
      selector.indexOf("type DeliverySelectorProps"),
      selector.indexOf("export function"),
    ),
    /onOpenChange/u,
  );
  assert.match(selector, /useState\(\(\)\s*=>\s*getOzonDraftInitialView/u);
  assert.doesNotMatch(selector, /const ozonInitialView\s*=\s*getOzonDraftInitialView/u);
});

test("display and submit require the server calculation matching confirmed delivery", async () => {
  const [provider, summary, field] = await Promise.all([
    readSource("src/features/checkout/lib/checkout-provider/checkout-provider.tsx"),
    readSource("src/features/checkout/ui/order-summary.tsx"),
    readSource("src/features/checkout/ui/delivery-method-field.tsx"),
  ]);

  assert.match(provider, /isMatchingCheckoutCalculation/u);
  assert.match(provider, /checkoutCalculation\.status\s*!==\s*"ready"/u);
  assert.match(provider, /createCheckoutOrderAttempt\([\s\S]*selectedDelivery/u);
  assert.match(summary, /calculation\.delivery\.pickupPoint\.address/u);
  assert.match(field, /calculation\?\.delivery\.pickupPoint\.address/u);
});

test("calculation query rejects mismatched responses before they enter the confirmed cache", async () => {
  const query = await readSource("src/features/checkout/model/query.ts");

  assert.match(query, /isMatchingCheckoutCalculation/u);
  assert.match(query, /throw new Error\("Checkout calculation does not match delivery"\)/u);
  assert.doesNotMatch(query, /staleTime:\s*Infinity/u);
});
