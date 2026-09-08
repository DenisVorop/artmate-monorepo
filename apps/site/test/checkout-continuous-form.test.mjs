import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, appendedSource = "") {
  const output = ts.transpileModule(`${source}\n${appendedSource}`, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };

  new Function("require", "module", "exports", output)(require, testModule, testModule.exports);

  return testModule.exports;
}

test("checkout is one continuous RHF form with the three numbered sections", async () => {
  const [flow, provider] = await Promise.all([
    readSource("src/features/checkout/ui/checkout-flow.tsx"),
    readSource("src/features/checkout/lib/checkout-provider/checkout-provider.tsx"),
  ]);

  assert.match(flow, /<form\s+id=\{checkoutOrderFormId\}\s+onSubmit=\{submitOrder\}>/u);
  assert.match(flow, /01[\s\S]*Получатель/u);
  assert.match(flow, /02[\s\S]*Доставка/u);
  assert.match(flow, /03[\s\S]*Оплата/u);
  assert.doesNotMatch(flow, /CheckoutStepProgress|hidden=\{step|continueFrom|goBack/u);
  assert.match(provider, /useForm<CheckoutFormValues>/u);
  assert.doesNotMatch(provider, /CheckoutStep|setStep|continueFrom|goBack|goToStep/u);
});

test("checkout sections and owned field errors have stable accessible relationships", async () => {
  const [flow, payment, legal] = await Promise.all([
    readSource("src/features/checkout/ui/checkout-flow.tsx"),
    readSource("src/features/checkout/ui/payment-method-field.tsx"),
    readSource("src/features/checkout/ui/legal-field.tsx"),
  ]);

  assert.match(flow, /<section\s+aria-labelledby=\{headingId\}/u);
  assert.match(flow, /<h2\s+id=\{headingId\}/u);
  assert.doesNotMatch(flow, /<FieldError/u);
  assert.match(payment, /id="checkout-payment-heading"/u);
  assert.match(payment, /aria-labelledby="checkout-payment-heading"/u);
  assert.match(payment, /id="checkout-payment-error"/u);
  assert.match(legal, /id="checkout-legal-error"/u);
  assert.match(legal, /id="checkout-personal-data-consent-error"/u);
});

test("delivery popup controls keep native button semantics and 44px targets", async () => {
  const [field, option] = await Promise.all([
    readSource("src/features/checkout/ui/delivery-selector/combobox-field.tsx"),
    readSource("src/features/checkout/ui/delivery-selector/combobox-option.tsx"),
  ]);

  assert.match(field, /useId\(\)/u);
  assert.match(field, /<Label htmlFor=\{triggerId\}>/u);
  assert.match(field, /id=\{triggerId\}/u);
  assert.match(field, /aria-haspopup="dialog"/u);
  assert.match(field, /aria-expanded=\{isOpen\}/u);
  assert.match(field, /aria-label=\{placeholder\}/u);
  assert.match(field, /min-h-11/u);
  assert.doesNotMatch(field, /role="combobox"|role="listbox"/u);
  assert.match(option, /min-h-11/u);
  assert.doesNotMatch(option, /role="option"/u);
});

test("checkout recipient phone is required, formatted, and included in create input", async () => {
  const [form, fields, checkout, sharedTypes] = await Promise.all([
    readSource("src/features/checkout/lib/checkout-form.ts"),
    readSource("src/features/checkout/ui/contact-fields.tsx"),
    readSource("src/features/checkout/ui/checkout.tsx"),
    readSource("src/shared/actions/orders/order.types.ts"),
  ]);

  const checkoutForm = evaluateTypeScript(form);

  assert.equal(checkoutForm.checkoutPhonePlaceholder, "+7 (999) 999-99-99");
  for (const [input, expected] of [
    ["89991234567", "+7 (999) 123-45-67"],
    ["79991234567", "+7 (999) 123-45-67"],
    ["+7 (999) 123-45-67", "+7 (999) 123-45-67"],
  ]) {
    assert.equal(checkoutForm.formatCheckoutPhone(input), expected);
  }
  assert.equal(
    checkoutForm.getDefaultCheckoutFormValues({ phone: "89991234567" }).phone,
    "+7 (999) 123-45-67",
  );
  assert.equal(checkoutForm.checkoutFormValidationSchema.shape.phone.safeParse("").success, false);
  assert.equal(
    checkoutForm.checkoutFormValidationSchema.shape.phone.safeParse("+7 (999) 123-45-67").success,
    true,
  );
  assert.equal(
    checkoutForm.checkoutFormValidationSchema.shape.phone.safeParse("+7 (999) 123-45").success,
    false,
  );
  assert.match(fields, /Телефон/u);
  assert.match(fields, /type="tel"/u);
  assert.match(fields, /inputMode="tel"/u);
  assert.match(fields, /autoComplete="tel"/u);
  assert.match(fields, /checkout-phone-error/u);
  assert.match(checkout, /user\?\.phone/u);
  assert.match(sharedTypes, /CreateOrderCustomerInputDTO\s*=\s*\{[\s\S]*phone: string/u);
  assert.match(
    sharedTypes,
    /CreateOrderInputDTO\s*=\s*\{[\s\S]*customer: CreateOrderCustomerInputDTO/u,
  );
  assert.match(sharedTypes, /OrderDTO\s*=\s*\{[\s\S]*customer: OrderCustomerDTO/u);
  assert.match(sharedTypes, /phone\?: string/u);
  assert.match(fields, /Имя/u);
  assert.match(fields, /Электронная почта/u);
  assert.match(fields, /Комментарий/u);
});

test("checkout name validation accepts Russian names and rejects invalid separators and characters", async () => {
  const form = evaluateTypeScript(await readSource("src/features/checkout/lib/checkout-form.ts"));

  for (const value of ["Анна Иванова", "Анна-Мария", "Ёлкина", "А".repeat(120)]) {
    assert.equal(
      form.checkoutFormValidationSchema.shape.name.safeParse(value).success,
      true,
      value,
    );
  }
  for (const value of ["Anna Maria", "Анна2", "Анна_Мария", "Анна  Мария", "-Анна", "Анна-"]) {
    const invalid = form.checkoutFormValidationSchema.shape.name.safeParse(value);
    assert.equal(invalid.success, false, value);
    assert.equal(invalid.error.issues[0].message, "Используйте русские буквы, пробелы и дефисы");
  }
  const oversized = form.checkoutFormValidationSchema.shape.name.safeParse("А".repeat(121));
  assert.equal(oversized.success, false);
  assert.equal(oversized.error.issues[0].message, "Имя должно быть не длиннее 120 символов");
});

test("checkout email validation accepts 254 characters and rejects 255", async () => {
  const form = evaluateTypeScript(await readSource("src/features/checkout/lib/checkout-form.ts"));
  const maximumEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  const oversizedEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;

  assert.equal(maximumEmail.length, 254);
  assert.equal(oversizedEmail.length, 255);
  assert.equal(form.checkoutFormValidationSchema.shape.email.safeParse(maximumEmail).success, true);
  const oversized = form.checkoutFormValidationSchema.shape.email.safeParse(oversizedEmail);
  assert.equal(oversized.success, false);
  assert.equal(oversized.error.issues[0].message, "Email должен быть не длиннее 254 символов");
});

test("checkout keeps exactly one responsive submit CTA bound to its continuous form", async () => {
  const [flow, summary] = await Promise.all([
    readSource("src/features/checkout/ui/checkout-flow.tsx"),
    readSource("src/features/checkout/ui/order-summary.tsx"),
  ]);

  assert.match(flow, /lg:grid-cols-\[minmax\(0,1fr\)_/u);
  assert.doesNotMatch(flow, /mt-6\s+hidden\s+justify-end/u);
  assert.match(summary, /hidden\s+lg:block[\s\S]*form=\{checkoutOrderFormId\}/u);
  assert.match(summary, /className="min-h-11\s+w-full"/u);
  assert.match(flow, /fixed\s+inset-x-0[\s\S]*lg:hidden/u);
  assert.match(flow, /form=\{checkoutOrderFormId\}/u);
  assert.match(flow, /min-h-11/u);
  assert.doesNotMatch(flow, /md:hidden|md:pb-0/u);
  assert.match(flow, /lg:pb-0/u);
  assert.match(flow, /env\(safe-area-inset-bottom\)/u);
});

test("checkout fixed surfaces reserve cookie consent height and sticky summary follows the header", async () => {
  const [flow, summary, cookieBanner, globals] = await Promise.all([
    readSource("src/features/checkout/ui/checkout-flow.tsx"),
    readSource("src/features/checkout/ui/order-summary.tsx"),
    readSource("src/features/cookie-consent/ui/cookie-consent-banner.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(globals, /:root\s*\{[\s\S]*--site-cookie-consent-height:\s*0px/u);
  assert.match(flow, /pb-\[calc\([^\]]+\+var\(--site-cookie-consent-height\)\)\]/u);
  assert.match(flow, /bottom-\[var\(--site-cookie-consent-height\)\]/u);
  assert.match(summary, /useSession/u);
  assert.match(summary, /useDevelopmentBanner/u);
  assert.match(summary, /getQueryOwner\(user\?\.id\)/u);
  assert.match(summary, /top-\[calc\(var\(--site-header-nav-height\)\+1rem\)\]/u);
  assert.match(
    summary,
    /top-\[calc\(var\(--site-header-banner-height\)\+var\(--site-header-nav-height\)\+1px\+1rem\)\]/u,
  );
  assert.doesNotMatch(summary, /lg:top-24/u);
  assert.match(cookieBanner, /getBoundingClientRect\(\)\.height/u);
  assert.match(cookieBanner, /new ResizeObserver/u);
});

test("desktop checkout summary keeps its footer visible while only its middle scrolls", async () => {
  const summary = await readSource("src/features/checkout/ui/order-summary.tsx");

  assert.match(
    summary,
    /lg:max-h-\[calc\(100dvh-var\(--site-header-nav-height\)-var\(--site-cookie-consent-height\)-2rem\)\]/u,
  );
  assert.match(
    summary,
    /lg:max-h-\[calc\(100dvh-var\(--site-header-banner-height\)-var\(--site-header-nav-height\)-var\(--site-cookie-consent-height\)-1px-2rem\)\]/u,
  );
  assert.match(
    summary,
    /<CardContent className="space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">/u,
  );
  assert.match(
    summary,
    /<CardFooter className="shrink-0 flex-col items-stretch gap-4">[\s\S]*Итого[\s\S]*hidden\s+lg:block[\s\S]*form=\{checkoutOrderFormId\}/u,
  );
  assert.doesNotMatch(summary, /(?<!lg:)max-h-\[/u);
  assert.doesNotMatch(summary, /(?<!lg:)overflow-y-auto/u);
});

test("cookie consent publishes its offset in a layout effect", async () => {
  const source = await readSource("src/features/cookie-consent/ui/cookie-consent-banner.tsx");

  assert.match(source, /import \{ useLayoutEffect, useRef \} from "react"/u);
  assert.match(source, /useLayoutEffect\(\(\) => \{/u);
  assert.doesNotMatch(source, /\buseEffect\b/u);
});

test("cookie consent publishes its measured height and resets it after resize, hiding, and unmount", async () => {
  const source = await readSource("src/features/cookie-consent/ui/cookie-consent-banner.tsx");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };
  const consent = { isAccepted: false, isReady: true };
  const section = {
    height: 132,
    getBoundingClientRect() {
      return { height: this.height };
    },
  };
  const styles = new Map();
  const effectSlots = [];
  const observers = [];
  let effectCursor = 0;
  let pendingEffects = [];
  class TestResizeObserver {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }

    observe(target) {
      this.target = target;
    }

    disconnect() {
      this.disconnected = true;
    }
  }
  const react = {
    useLayoutEffect(effect, dependencies) {
      const index = effectCursor++;
      const previous = effectSlots[index];
      const changed =
        !previous ||
        dependencies.some(
          (dependency, dependencyIndex) =>
            !Object.is(dependency, previous.dependencies[dependencyIndex]),
        );

      if (changed) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effectSlots[index] = { dependencies, cleanup: effect() };
        });
      }
    },
    useRef: () => ({ current: section }),
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react,
    "lucide-react": { Check: "Check", Cookie: "Cookie" },
    "@/shared/constants": { routes: { legal: { cookiePolicy: "/cookie" } } },
    "@/shared/lib/cookie-consent": {
      acceptCookieConsent() {},
      useCookieConsent: () => consent,
    },
    "@/shared/ui": { Button: "Button" },
    "@/shared/ui/link": { Link: "Link" },
  };
  const previousDocument = globalThis.document;
  const previousResizeObserver = globalThis.ResizeObserver;
  globalThis.document = {
    documentElement: {
      style: {
        removeProperty: (name) => styles.delete(name),
        setProperty: (name, value) => styles.set(name, value),
      },
    },
  };
  globalThis.ResizeObserver = TestResizeObserver;

  try {
    new Function("require", "module", "exports", output)(
      (name) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected test import: ${name}`);
        return dependencies[name];
      },
      testModule,
      testModule.exports,
    );

    const render = () => {
      effectCursor = 0;
      pendingEffects = [];
      const rendered = testModule.exports.CookieConsentBanner();
      pendingEffects.forEach((runEffect) => runEffect());
      return rendered;
    };

    assert.ok(render());
    assert.equal(styles.get("--site-cookie-consent-height"), "132px");
    const observer = observers.at(-1);
    assert.strictEqual(observer.target, section);

    section.height = 168;
    observer.callback();
    assert.equal(styles.get("--site-cookie-consent-height"), "168px");

    consent.isAccepted = true;
    assert.equal(render(), null);
    assert.equal(styles.has("--site-cookie-consent-height"), false);
    assert.equal(observer.disconnected, true);

    consent.isAccepted = false;
    assert.ok(render());
    assert.equal(styles.get("--site-cookie-consent-height"), "168px");
    effectSlots.forEach((slot) => slot.cleanup?.());
    assert.equal(styles.has("--site-cookie-consent-height"), false);
    assert.equal(observers.at(-1).disconnected, true);
  } finally {
    globalThis.document = previousDocument;
    globalThis.ResizeObserver = previousResizeObserver;
  }
});

test("order summary shows two item rows and discloses remaining positions natively", async () => {
  const summary = await readSource("src/features/checkout/ui/order-summary.tsx");

  assert.match(summary, /cart\.items\.slice\(0,\s*2\)/u);
  assert.match(summary, /cart\.items\.slice\(2\)/u);
  assert.match(summary, /<OrderItem\s+key=\{item\.id\}\s+item=\{item\}/u);
  assert.match(summary, /<details/u);
  assert.match(summary, /<summary[^>]*className="[^"]*min-h-11/u);
  assert.match(summary, /hiddenItems\.length/u);
  assert.doesNotMatch(summary, /useState|Accordion|Collapsible/u);
});

test("pickup picker uses a large desktop Dialog and a mobile Drawer", async () => {
  const source = await readSource("src/features/checkout/ui/delivery-picker.tsx");

  assert.match(source, /Dialog/u);
  assert.match(source, /Drawer/u);
  assert.match(source, /useDeviceInfo/u);
  assert.match(source, /max-w-\[/u);
  assert.match(source, /Подтвердить ПВЗ/u);
  assert.match(source, /DrawerClose/u);
});

test("pickup persistence is cart-keyed, technical-only, exception-safe, and keeps its original 24h expiry", async () => {
  const source = await readSource("src/features/checkout/lib/pickup-selection-storage.ts");
  const storage = evaluateTypeScript(source);
  const values = new Map();
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  globalThis.window = {};
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };

  try {
    const selection = { cityCode: 44, pickupPointId: "MSK-1", provider: "cdek" };
    storage.writePersistedPickupSelection("cart-a", selection, 1_000);
    const [storageKey, originalValue] = [...values.entries()][0];

    assert.match(storageKey, /cart-a/u);
    assert.doesNotMatch(originalValue, /cartId|address|title|workHours|deliveryPrice/u);
    assert.deepEqual(storage.readPersistedPickupSelection("cart-a", 2_000), selection);
    assert.equal(storage.readPersistedPickupSelection("cart-b", 2_000), undefined);

    storage.writePersistedPickupSelection("cart-a", selection, 60_000);
    assert.equal(values.get(storageKey), originalValue);
    assert.deepEqual(
      storage.readPersistedPickupSelection("cart-a", 1_000 + 86_400_000 - 1),
      selection,
    );
    storage.writePersistedPickupSelection("cart-a", selection, 1_000 + 86_400_000);
    assert.equal(values.has(storageKey), false);

    storage.writePersistedPickupSelection(
      "cart-a",
      { ...selection, pickupPointId: "x".repeat(161) },
      1_000,
    );
    assert.equal(values.size, 0);
    values.set(
      storageKey,
      JSON.stringify({
        expiresAt: 1_000_000_000_000,
        pickupPointId: "MSK-1",
        provider: "cdek",
      }),
    );
    assert.equal(storage.readPersistedPickupSelection("cart-a", 2_000), undefined);

    globalThis.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    assert.doesNotThrow(() => storage.readPersistedPickupSelection("cart-a"));
    assert.doesNotThrow(() => storage.writePersistedPickupSelection("cart-a", selection));
    assert.doesNotThrow(() => storage.clearPersistedPickupSelection("cart-a"));
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }

  assert.match(source, /24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/u);
  assert.match(source, /provider/u);
  assert.match(source, /pickupPointId/u);
  assert.match(source, /cityCode/u);
  assert.doesNotMatch(source, /address|title|workHours|deliveryPrice/u);

  const provider = await readSource(
    "src/features/checkout/lib/checkout-provider/checkout-provider.tsx",
  );
  assert.match(provider, /readPersistedPickupSelection/u);
  assert.match(provider, /clearPersistedPickupSelection/u);
  assert.match(provider, /writePersistedPickupSelection/u);
  assert.match(provider, /isMatchingCheckoutCalculation/u);
});

test("checkout attempt id is reused for an identical payload and rotated after payload changes", async () => {
  const [form, types] = await Promise.all([
    readSource("src/features/checkout/lib/checkout-form.ts"),
    readSource("src/shared/actions/orders/order.types.ts"),
  ]);

  assert.match(types, /checkoutAttemptId: string/u);
  assert.match(form, /crypto\.randomUUID\(\)/u);
  assert.match(form, /JSON\.stringify/u);
  assert.match(form, /previousAttempt/u);
  assert.match(form, /payloadSignature/u);

  const { createCheckoutOrderAttempt } = evaluateTypeScript(form);
  {
    const values = {
      acceptedLegal: true,
      acceptedPersonalDataConsent: true,
      comment: "",
      email: "buyer@example.com",
      name: "Иван",
      phone: "+7 (999) 123-45-67",
      paymentMethod: "ozon_acquiring",
    };
    const delivery = { cityCode: 44, pickupPointId: "MSK-1", provider: "cdek" };
    const first = createCheckoutOrderAttempt(values, delivery);
    const retry = createCheckoutOrderAttempt(values, delivery, undefined, first.attempt);
    const changed = createCheckoutOrderAttempt(
      { ...values, phone: "+7 (999) 123-45-68" },
      delivery,
      undefined,
      retry.attempt,
    );

    assert.equal(first.input.checkoutAttemptId, retry.input.checkoutAttemptId);
    assert.equal(first.input.customer.phone, "+7 (999) 123-45-67");
    assert.notEqual(retry.input.checkoutAttemptId, changed.input.checkoutAttemptId);
  }
});

test("CDEK search is debounced by 300ms and client map clustering is deterministic runtime logic", async () => {
  const [cities, debounce, map, clusteringSource, packageJson] = await Promise.all([
    readSource("src/features/checkout/model/use-cdek-cities.ts"),
    readSource("src/features/checkout/lib/use-debounced-city-query.ts"),
    readSource("src/features/checkout/ui/delivery-selector/pickup-points-map.tsx"),
    readSource("src/features/checkout/lib/cluster-pickup-points.ts"),
    readSource("package.json"),
  ]);

  assert.match(cities, /useDebouncedCityQuery\(normalizedQuery\)/u);
  assert.match(debounce, /300/u);
  assert.match(debounce, /setTimeout/u);
  assert.match(map, /clusterPickupPoints/u);
  assert.doesNotMatch(packageJson, /markercluster|supercluster/u);

  const { clusterPickupPoints } = evaluateTypeScript(clusteringSource);
  const points = [
    { id: "b", latitude: 55.7501, longitude: 37.6101 },
    { id: "a", latitude: 55.75, longitude: 37.61 },
    { id: "far", latitude: 59.93, longitude: 30.31 },
  ];
  const forward = clusterPickupPoints(points, 10);
  const reversed = clusterPickupPoints([...points].reverse(), 10);

  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward[0].pointIds, ["a", "b"]);
  assert.deepEqual(forward[1].pointIds, ["far"]);
});

test("checkout displays only server-derived delivery prices", async () => {
  const sources = await Promise.all([
    readSource("src/features/checkout/ui/checkout-flow.tsx"),
    readSource("src/features/checkout/ui/delivery-method-field.tsx"),
    readSource("src/features/checkout/ui/order-summary.tsx"),
  ]);
  const source = sources.join("\n");

  assert.doesNotMatch(source, /\b(?:100|200)\s*(?:₽|руб)/u);
  assert.match(source, /calculation\?\.deliveryPrice|calculation\.deliveryPrice/u);
  assert.match(source, /cart\.minimumDeliveryPrices/u);
  assert.match(source, /Доставка от/u);
});

test("checkout owns one calculation retry surface and summary stays neutral", async () => {
  const [flow, summary] = await Promise.all([
    readSource("src/features/checkout/ui/checkout-flow.tsx"),
    readSource("src/features/checkout/ui/order-summary.tsx"),
  ]);

  assert.equal((flow.match(/Повторить расчет/gu) ?? []).length, 1);
  assert.match(flow, /status === "offline"/u);
  assert.match(flow, /Нет сети/u);
  assert.match(flow, /<Button[^>]*className="min-h-11"[\s\S]*Повторить расчет/u);
  assert.doesNotMatch(summary, /Повторить расчет|onClick=\{checkoutCalculation\.retry\}/u);
  assert.doesNotMatch(summary, /role="alert"/u);
});

test("offline calculation never renders calculating delivery copy", async () => {
  const field = await readSource("src/features/checkout/ui/delivery-method-field.tsx");

  assert.match(field, /checkoutCalculation\.status === "pending"/u);
  assert.match(field, /variant="link"[\s\S]*className="min-h-11 h-auto/u);
  assert.doesNotMatch(field, /isPending|isPaused/u);
});
