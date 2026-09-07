import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function loadTypeScriptModule(path, mocks = {}) {
  const source = await readSource(path);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    return require(specifier);
  };

  new Function("module", "exports", "require", output)(
    loadedModule,
    loadedModule.exports,
    localRequire,
  );
  return loadedModule.exports;
}

test("cached pricing data is unusable while fetching and after refetch error", async () => {
  const { getFreshQueryData } = await loadTypeScriptModule("src/shared/lib/query-freshness.ts");
  const cachedTotal = { discount: 100, total: 900 };

  assert.equal(
    getFreshQueryData({ data: cachedTotal, isError: false, isFetching: true }),
    undefined,
  );
  assert.equal(
    getFreshQueryData({ data: cachedTotal, isError: true, isFetching: false }),
    undefined,
  );
  assert.equal(
    getFreshQueryData({ data: cachedTotal, isError: true, isFetching: true }),
    undefined,
  );
  assert.equal(
    getFreshQueryData({ data: cachedTotal, isError: false, isFetching: false }),
    cachedTotal,
  );
});

test("a real offline QueryObserver cannot expose cached payable data", async () => {
  const { QueryClient, QueryObserver, onlineManager } = require("@tanstack/react-query");
  const { getFreshQueryData } = await loadTypeScriptModule("src/shared/lib/query-freshness.ts");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queryKey = ["offline-promocode-pricing"];
  const oldTotal = { discount: 100, total: 900 };
  const newTotal = { discount: 200, total: 800 };
  let unsubscribe;

  queryClient.setQueryData(queryKey, oldTotal);
  onlineManager.setOnline(false);

  try {
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: async () => newTotal,
      staleTime: 0,
    });
    unsubscribe = observer.subscribe(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    const pausedResult = observer.getCurrentResult();
    assert.equal(pausedResult.fetchStatus, "paused");
    assert.equal(pausedResult.isFetching, false);
    assert.equal(pausedResult.isError, false);
    assert.equal(pausedResult.data, oldTotal);
    assert.equal(getFreshQueryData(pausedResult), undefined);

    onlineManager.setOnline(true);
    const freshResult = await observer.refetch();
    assert.deepEqual(getFreshQueryData(freshResult), newTotal);
  } finally {
    unsubscribe?.();
    queryClient.clear();
    onlineManager.setOnline(true);
  }
});

test("blocked and quota-limited storage falls back to memory without throwing", async () => {
  const promoCode = await loadTypeScriptModule("src/features/promocode/lib/promo-code.ts");
  const storage = await loadTypeScriptModule("src/features/promocode/lib/promo-code-storage.ts", {
    "./promo-code": promoCode,
  });
  const blockedStorage = {
    getItem() {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem() {
      throw new DOMException("quota", "QuotaExceededError");
    },
    removeItem() {
      throw new DOMException("blocked", "SecurityError");
    },
  };

  storage.clearStoredPromoCode(null);
  assert.equal(
    storage.writeStoredPromoCode({ cartId: "cart-1", code: "save10" }, blockedStorage),
    false,
  );
  assert.deepEqual(storage.readStoredPromoCode(blockedStorage), {
    cartId: "cart-1",
    code: "SAVE10",
  });
  assert.equal(storage.clearStoredPromoCode(blockedStorage), false);
  assert.equal(storage.readStoredPromoCode(blockedStorage), undefined);
});

test("failed replace shadows readable OLD storage until NEW can be persisted", async () => {
  const promoCode = await loadTypeScriptModule("src/features/promocode/lib/promo-code.ts");
  const storage = await loadTypeScriptModule("src/features/promocode/lib/promo-code-storage.ts", {
    "./promo-code": promoCode,
  });
  let canWrite = false;
  let serialized = JSON.stringify({ cartId: "cart-1", code: "OLD" });
  const partiallyBlockedStorage = {
    getItem: () => serialized,
    setItem(_key, value) {
      if (!canWrite) {
        throw new DOMException("quota", "QuotaExceededError");
      }

      serialized = value;
    },
    removeItem: () => {},
  };

  assert.equal(
    storage.writeStoredPromoCode({ cartId: "cart-1", code: "NEW" }, partiallyBlockedStorage),
    false,
  );
  assert.deepEqual(storage.readStoredPromoCode(partiallyBlockedStorage), {
    cartId: "cart-1",
    code: "NEW",
  });

  canWrite = true;
  assert.deepEqual(storage.readStoredPromoCode(partiallyBlockedStorage), {
    cartId: "cart-1",
    code: "NEW",
  });
  assert.equal(JSON.parse(serialized).code, "NEW");
});

test("failed clear keeps a tombstone over readable OLD storage until removal succeeds", async () => {
  const promoCode = await loadTypeScriptModule("src/features/promocode/lib/promo-code.ts");
  const storage = await loadTypeScriptModule("src/features/promocode/lib/promo-code-storage.ts", {
    "./promo-code": promoCode,
  });
  let canRemove = false;
  let serialized = JSON.stringify({ cartId: "cart-1", code: "OLD" });
  const partiallyBlockedStorage = {
    getItem: () => serialized,
    setItem: () => {},
    removeItem() {
      if (!canRemove) {
        throw new DOMException("blocked", "SecurityError");
      }

      serialized = null;
    },
  };

  assert.equal(storage.clearStoredPromoCode(partiallyBlockedStorage), false);
  assert.equal(storage.readStoredPromoCode(partiallyBlockedStorage), undefined);

  canRemove = true;
  assert.equal(storage.readStoredPromoCode(partiallyBlockedStorage), undefined);
  assert.equal(serialized, null);
});

test("a successful external removal authoritatively clears the in-memory value", async () => {
  const promoCode = await loadTypeScriptModule("src/features/promocode/lib/promo-code.ts");
  const storage = await loadTypeScriptModule("src/features/promocode/lib/promo-code-storage.ts", {
    "./promo-code": promoCode,
  });
  let serialized = JSON.stringify({ cartId: "cart-1", code: "OLD" });
  const workingStorage = {
    getItem: () => serialized,
    setItem: (_key, value) => {
      serialized = value;
    },
    removeItem: () => {
      serialized = null;
    },
  };

  assert.deepEqual(storage.readStoredPromoCode(workingStorage), {
    cartId: "cart-1",
    code: "OLD",
  });

  serialized = null;
  assert.equal(storage.readStoredPromoCode(workingStorage), undefined);
  assert.equal(storage.readStoredPromoCode(null), undefined);
});

test("corrupt, JSON null and non-ASCII persisted codes are safely rejected", async () => {
  const promoCode = await loadTypeScriptModule("src/features/promocode/lib/promo-code.ts");
  const storage = await loadTypeScriptModule("src/features/promocode/lib/promo-code-storage.ts", {
    "./promo-code": promoCode,
  });

  for (const serialized of ["{", "null", JSON.stringify({ cartId: "cart-1", code: "ſAVE" })]) {
    let removeCalls = 0;
    const corruptStorage = {
      getItem: () => serialized,
      setItem: () => {},
      removeItem() {
        removeCalls += 1;
        throw new DOMException("blocked", "SecurityError");
      },
    };

    storage.clearStoredPromoCode(null);
    assert.doesNotThrow(() => storage.readStoredPromoCode(corruptStorage));
    assert.equal(storage.readStoredPromoCode(corruptStorage), undefined);
    assert.ok(removeCalls >= 1);
  }
});

test("apply, replace, cart change, empty cart and explicit clear keep storage state coherent", async () => {
  const promoCode = await loadTypeScriptModule("src/features/promocode/lib/promo-code.ts");
  const storage = await loadTypeScriptModule("src/features/promocode/lib/promo-code-storage.ts", {
    "./promo-code": promoCode,
  });
  const values = new Map();
  const workingStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  storage.clearStoredPromoCode(workingStorage);
  storage.writeStoredPromoCode({ cartId: "cart-1", code: "first" }, workingStorage);
  assert.equal(storage.readCartPromoCode("cart-1", true, workingStorage), "FIRST");

  storage.writeStoredPromoCode({ cartId: "cart-1", code: "second" }, workingStorage);
  assert.equal(storage.readCartPromoCode("cart-1", true, workingStorage), "SECOND");
  assert.equal(storage.readCartPromoCode("cart-2", true, workingStorage), undefined);

  storage.writeStoredPromoCode({ cartId: "cart-2", code: "third" }, workingStorage);
  assert.equal(storage.readCartPromoCode("cart-2", false, workingStorage), undefined);

  storage.writeStoredPromoCode({ cartId: "cart-2", code: "fourth" }, workingStorage);
  storage.clearStoredPromoCode(workingStorage);
  assert.equal(storage.readCartPromoCode("cart-2", true, workingStorage), undefined);
});

test("promo normalization uppercases ASCII only and rejects Unicode folds", async () => {
  const { normalizePromoCode, parsePromoCode } = await loadTypeScriptModule(
    "src/features/promocode/lib/promo-code.ts",
  );

  assert.equal(normalizePromoCode(" save-10 "), "SAVE-10");
  assert.equal(parsePromoCode("save_10"), "SAVE_10");
  assert.equal(parsePromoCode("ſAVE"), undefined);
  assert.equal(parsePromoCode("ßA"), undefined);
});

test("cart and checkout use the provider HOC while guest checkout remains immediate", async () => {
  const [cart, checkout, checkoutForm, paymentField] = await Promise.all([
    readSource("src/features/cart/ui/cart.tsx"),
    readSource("src/features/checkout/ui/checkout.tsx"),
    readSource("src/features/checkout/lib/checkout-form.ts"),
    readSource("src/features/checkout/ui/payment-method-field.tsx"),
  ]);

  assert.match(cart, /withPromocode\(BaseLoadedCart\)/u);
  assert.match(checkout, /withPromocode\(BasePromocodeCheckout\)/u);
  assert.doesNotMatch(`${cart}\n${checkout}`, /<PromocodeProvider/u);
  assert.doesNotMatch(checkout, /pendingOrderInput/u);
  assert.match(checkout, /const handleSubmit[\s\S]*await createOrder\(variables\)/u);
  assert.doesNotMatch(checkout, /onAuthRequired|if\s*\(!user\)/u);
  assert.match(checkoutForm, /method: values\.paymentMethod/u);
  assert.match(paymentField, /ozon_acquiring/u);
  assert.match(paymentField, /tbank_acquiring/u);
});

test("all cart and authentication transitions invalidate pricing", async () => {
  const paths = [
    "src/features/cart/model/use-add-cart-item.ts",
    "src/features/cart/model/use-remove-cart-item.ts",
    "src/features/cart/model/use-update-cart-item-quantity.ts",
    "src/features/cart/model/use-clear-cart.ts",
    "src/features/auth/model/use-login.ts",
    "src/features/auth/model/use-logout.ts",
    "src/features/auth/model/use-confirm-email-verification.ts",
    "src/features/checkout/model/use-create-order.ts",
  ];
  const sources = await Promise.all(paths.map(readSource));

  for (const [index, source] of sources.entries()) {
    assert.match(source, /invalidateQueries\(\{ queryKey: cartPricingQueryKey \}\)/u, paths[index]);
  }
});

test("legal promocode page contains only general rules while cart and checkout keep promo entry", async () => {
  const [routes, footer, legalPage, promoForm, cartSummary, checkoutSummary] = await Promise.all([
    readSource("src/shared/constants/routes.ts"),
    readSource("src/widgets/footer/ui/legal-docs.tsx"),
    readSource("src/_pages/legal/index.tsx"),
    readSource("src/features/promocode/ui/promo-code-form.tsx"),
    readSource("src/features/cart/ui/cart-summary.tsx"),
    readSource("src/features/checkout/ui/order-summary.tsx"),
  ]);

  assert.match(routes, /promocodes: "\/legal\/promocodes"/u);
  assert.match(footer, /routes\.legal\.promocodes/u);
  assert.match(legalPage, /documentId === "publicOffer" \? routes\.legal\.promocodes/u);
  assert.match(legalPage, /условиях, сообщаемых покупателю при его предоставлении/u);
  assert.match(legalPage, /зависят от промокода и сообщаются покупателю при его предоставлении/u);
  assert.match(legalPage, /Сроки действия указываются по московскому времени/u);
  assert.match(legalPage, /href=\{routes\.legal\.publicOffer\}/u);
  assert.match(legalPage, /href=\{routes\.legal\.returnPolicy\}/u);
  assert.doesNotMatch(legalPage, /PromoCodeTermsLookup|features\/promocode-terms/u);
  assert.doesNotMatch(legalPage, /<form\b/u);
  assert.doesNotMatch(legalPage, /проверить на этой странице/iu);
  assert.match(cartSummary, /<PromoCodeForm \/>/u);
  assert.match(checkoutSummary, /<PromoCodeForm \/>/u);
  assert.doesNotMatch(promoForm, /legal|оферт|правил.*промокод/iu);
});
