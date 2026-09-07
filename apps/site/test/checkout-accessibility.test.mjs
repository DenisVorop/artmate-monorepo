import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateComponent(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };

  new Function("require", "module", "exports", output)(
    (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      throw new Error(`Unexpected test module import: ${specifier}`);
    },
    loadedModule,
    loadedModule.exports,
  );

  return loadedModule.exports;
}

function findNodes(node, predicate, matches = []) {
  if (!node || typeof node !== "object") return matches;
  if (predicate(node)) matches.push(node);
  const children = Array.isArray(node) ? node : node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    findNodes(child, predicate, matches);
  }
  return matches;
}

function getText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  const children = Array.isArray(node) ? node : node.props?.children;
  return (Array.isArray(children) ? children : [children]).map(getText).join("");
}

const jsx = (type, props, key) => ({ key, props, type });
const component = (name) => name;
const jsxRuntime = { Fragment: Symbol("Fragment"), jsx, jsxs: jsx };

test("FieldError renders a stable alert contract", async () => {
  const { FieldError } = evaluateComponent(
    await readSource("src/features/checkout/ui/field-error.tsx"),
    { "react/jsx-runtime": jsxRuntime },
  );

  assert.equal(FieldError({ id: "name-error" }), null);
  const error = FieldError({ id: "name-error", message: "Укажите имя" });
  assert.equal(error.type, "p");
  assert.equal(error.props.id, "name-error");
  assert.equal(error.props.role, "alert");
});

test("checkout fields describe only their stable helper and error nodes", async () => {
  const errors = {
    acceptedLegal: { message: "Примите условия" },
    acceptedPersonalDataConsent: { message: "Подтвердите согласие" },
    comment: { message: "Слишком длинный комментарий" },
    email: { message: "Введите email" },
    name: { message: "Укажите имя" },
    phone: { message: "Укажите телефон" },
    paymentMethod: { message: "Выберите способ оплаты" },
  };
  const sharedUi = {
    Badge: component("Badge"),
    Input: component("Input"),
    Label: component("Label"),
    PersonalDataConsentCheckbox: component("PersonalDataConsentCheckbox"),
    RadioGroup: component("RadioGroup"),
    RadioGroupItem: component("RadioGroupItem"),
    Textarea: component("Textarea"),
  };
  const fieldError = component("FieldError");
  const formContext = {
    formState: { errors },
    register: (name) => ({ name }),
    setValue: () => undefined,
    watch: () => "ozon_acquiring",
  };
  const commonMocks = {
    "../lib": {
      checkoutPhonePlaceholder: "+7 (999) 999-99-99",
      formatCheckoutPhone: (value) => value,
      useCheckout: () => ({ isEmailLocked: false }),
    },
    "./field-error": { FieldError: fieldError },
    "@/shared/ui": sharedUi,
    "react-hook-form": { useFormContext: () => formContext },
    "react/jsx-runtime": jsxRuntime,
  };
  const { ContactFields } = evaluateComponent(
    await readSource("src/features/checkout/ui/contact-fields.tsx"),
    commonMocks,
  );
  const contactTree = ContactFields();
  const inputById = Object.fromEntries(
    findNodes(contactTree, (node) => ["Input", "Textarea"].includes(node.type)).map((node) => [
      node.props.id,
      node,
    ]),
  );

  assert.equal(inputById["checkout-name"].props["aria-describedby"], "checkout-name-error");
  assert.equal(inputById["checkout-phone"].props["aria-describedby"], "checkout-phone-error");
  assert.equal(
    inputById["checkout-email"].props["aria-describedby"],
    "checkout-email-helper checkout-email-error",
  );
  assert.equal(inputById["checkout-comment"].props["aria-describedby"], "checkout-comment-error");
  for (const node of [
    inputById["checkout-name"],
    inputById["checkout-phone"],
    inputById["checkout-email"],
  ]) {
    assert.equal(node.props["aria-required"], true);
    assert.equal(node.props["aria-invalid"], true);
    assert.match(node.props.className, /min-h-11/u);
  }
  assert.equal(inputById["checkout-comment"].props["aria-invalid"], true);
  assert.equal(inputById["checkout-comment"].props.maxLength, 1000);
  assert.equal(inputById["checkout-phone"].props.type, "tel");
  assert.equal(inputById["checkout-phone"].props.inputMode, "tel");
  assert.equal(inputById["checkout-phone"].props.autoComplete, "tel");
  assert.equal(inputById["checkout-phone"].props.placeholder, "+7 (999) 999-99-99");
  assert.equal(inputById["checkout-phone"].props.maxLength, 18);
  assert.equal(inputById["checkout-email"].props.maxLength, 254);
  assert.match(inputById["checkout-comment"].props.className, /min-h-24/u);
  assert.equal(
    findNodes(contactTree, (node) => node.props?.id === "checkout-email-helper").length,
    1,
  );

  const { PaymentMethodField } = evaluateComponent(
    await readSource("src/features/checkout/ui/payment-method-field.tsx"),
    {
      ...commonMocks,
      "lucide-react": {
        CreditCard: component("CreditCard"),
        WalletCards: component("WalletCards"),
      },
    },
  );
  const paymentTree = PaymentMethodField();
  const group = findNodes(paymentTree, (node) => node.type === "RadioGroup")[0];
  const badges = findNodes(paymentTree, (node) => node.type === "Badge").map(
    (node) => node.props.children,
  );
  assert.equal(group.props["aria-labelledby"], "checkout-payment-heading");
  assert.equal(group.props["aria-describedby"], "checkout-payment-error");
  assert.equal(group.props["aria-invalid"], true);
  assert.deepEqual(badges, ["Карта", "СБП", "Карта", "СБП"]);
});

test("checkout return navigation keeps a 44px target", async () => {
  const cart = { items: [{ id: "item-1" }] };
  const react = {
    useEffect: () => undefined,
    useState: (initialValue) => [initialValue === undefined ? cart : initialValue, () => undefined],
  };
  const { Checkout } = evaluateComponent(
    await readSource("src/features/checkout/ui/checkout.tsx"),
    {
      "lucide-react": { ArrowLeft: component("ArrowLeft"), ShoppingBag: component("ShoppingBag") },
      react,
      "@/entities/cart": { useCartData: () => ({}) },
      "@/entities/session": { useUser: () => undefined },
      "@/features/auth": { AuthForm: component("AuthForm") },
      "@/features/promocode": {
        usePromocode: () => ({ clearCode: () => undefined }),
        withPromocode: (Component) => Component,
      },
      "@/shared/constants": { routes: { cart: "/cart", catalog: "/catalog" } },
      "@/shared/ui": {
        Button: component("Button"),
        DataState: component("DataState"),
        Dialog: component("Dialog"),
        DialogContent: component("DialogContent"),
        DialogDescription: component("DialogDescription"),
        DialogHeader: component("DialogHeader"),
        DialogTitle: component("DialogTitle"),
      },
      "@/shared/ui/link": { Link: component("Link") },
      "@/shared/ui/typography": { PageTitle: component("PageTitle") },
      "../model": {
        useCreateOrderMutation: () => ({
          createOrder: async () => undefined,
          error: null,
          isPending: false,
        }),
      },
      "../lib/use-track-checkout-start": { useTrackCheckoutStart: () => undefined },
      "./checkout-flow": { CheckoutFlow: component("CheckoutFlow") },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const loadedCheckout = Checkout();
  const promocodeCheckout = loadedCheckout.type(loadedCheckout.props);
  const checkoutScenario = promocodeCheckout.type(promocodeCheckout.props);
  const scenarioNode = findNodes(checkoutScenario, (node) => typeof node.type === "function")[0];
  const scenarioTree = scenarioNode.type(scenarioNode.props);
  const backButton = findNodes(
    scenarioTree,
    (node) => node.type === "Button" && getText(node).includes("Вернуться в корзину"),
  )[0];

  assert.match(backButton.props.className, /(?:^|\s)min-h-11(?:\s|$)/u);
});

test("cookie consent action keeps a 44px target at every breakpoint", async () => {
  const { CookieConsentBanner } = evaluateComponent(
    await readSource("src/features/cookie-consent/ui/cookie-consent-banner.tsx"),
    {
      "lucide-react": { Check: component("Check"), Cookie: component("Cookie") },
      react: { useLayoutEffect: () => undefined, useRef: () => ({ current: null }) },
      "@/shared/constants": { routes: { legal: { cookiePolicy: "/cookie" } } },
      "@/shared/lib/cookie-consent": {
        acceptCookieConsent: () => undefined,
        useCookieConsent: () => ({ isAccepted: false, isReady: true }),
      },
      "@/shared/ui": { Button: component("Button") },
      "@/shared/ui/link": { Link: component("Link") },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const acceptButton = findNodes(
    CookieConsentBanner(),
    (node) => node.type === "Button" && getText(node).includes("Принять"),
  )[0];

  assert.match(acceptButton.props.className, /(?:^|\s)min-h-11(?:\s|$)/u);
  assert.doesNotMatch(acceptButton.props.className, /(?:^|\s)(?:h-8|md:h-9)(?:\s|$)/u);
});

test("delivery choices use the checkout delivery section as their accessible name", async () => {
  const { DeliveryMethodField } = evaluateComponent(
    await readSource("src/features/checkout/ui/delivery-method-field.tsx"),
    {
      "lucide-react": { MapPin: component("MapPin") },
      react: {
        useEffect: () => undefined,
        useRef: (value) => ({ current: value }),
        useState: (initialValue) => [
          typeof initialValue === "function" ? initialValue() : initialValue,
          () => undefined,
        ],
      },
      "@/shared/ui": {
        Button: component("Button"),
        Label: component("Label"),
        RadioGroup: component("RadioGroup"),
        RadioGroupItem: component("RadioGroupItem"),
      },
      "../lib": {
        createDeliveryPickerDrafts: () => ({}),
        formatMoney: (value) => String(value),
        getDeliveryDraftCandidate: () => undefined,
        isSameDeliverySelection: () => true,
        seedDeliveryPickerDrafts: (drafts) => drafts,
        useCheckout: () => ({
          checkoutCalculation: { status: "idle" },
          confirmDelivery: async () => ({ status: "error" }),
          invalidateDeliveryConfirmation: () => undefined,
          selectedDelivery: undefined,
        }),
      },
      "./delivery-picker": { DeliveryPicker: component("DeliveryPicker") },
      "./delivery-selector/delivery-options": {
        deliveryCompanies: [
          { code: "cdek", label: "СДЭК" },
          { code: "ozon", label: "Ozon" },
        ],
      },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const tree = DeliveryMethodField({
    isOzonDeliveryAvailable: true,
    minimumDeliveryPrices: { ozon: 100 },
  });
  const group = findNodes(tree, (node) => node.type === "RadioGroup")[0];

  assert.equal(group.props["aria-labelledby"], "checkout-section-02-heading");
});

test("checkout flat radio lists override the shared group gap locally", async () => {
  const sharedUi = {
    Button: component("Button"),
    Label: component("Label"),
    RadioGroup: component("RadioGroup"),
    RadioGroupItem: component("RadioGroupItem"),
  };
  const react = {
    useEffect: () => undefined,
    useRef: (value) => ({ current: value }),
    useState: (initialValue) => [
      typeof initialValue === "function" ? initialValue() : initialValue,
      () => undefined,
    ],
  };
  const { DeliveryMethodField } = evaluateComponent(
    await readSource("src/features/checkout/ui/delivery-method-field.tsx"),
    {
      "lucide-react": { MapPin: component("MapPin") },
      react,
      "@/shared/ui": sharedUi,
      "../lib": {
        createDeliveryPickerDrafts: () => ({}),
        formatMoney: (value) => String(value),
        getDeliveryDraftCandidate: () => undefined,
        isSameDeliverySelection: () => true,
        seedDeliveryPickerDrafts: (drafts) => drafts,
        useCheckout: () => ({
          checkoutCalculation: { status: "idle" },
          confirmDelivery: async () => ({ status: "error" }),
          invalidateDeliveryConfirmation: () => undefined,
          selectedDelivery: undefined,
        }),
      },
      "./delivery-picker": { DeliveryPicker: component("DeliveryPicker") },
      "./delivery-selector/delivery-options": {
        deliveryCompanies: [
          { code: "cdek", label: "СДЭК" },
          { code: "ozon", label: "Ozon" },
        ],
      },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const deliveryGroup = findNodes(
    DeliveryMethodField({
      isOzonDeliveryAvailable: true,
      minimumDeliveryPrices: { ozon: 100 },
    }),
    (node) => node.type === "RadioGroup",
  )[0];

  const { PaymentMethodField } = evaluateComponent(
    await readSource("src/features/checkout/ui/payment-method-field.tsx"),
    {
      "lucide-react": {
        CreditCard: component("CreditCard"),
        WalletCards: component("WalletCards"),
      },
      "@/shared/ui": { ...sharedUi, Badge: component("Badge") },
      "../lib": {},
      "./field-error": { FieldError: component("FieldError") },
      "react-hook-form": {
        useFormContext: () => ({
          formState: { errors: {} },
          setValue: () => undefined,
          watch: () => "ozon_acquiring",
        }),
      },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const paymentGroup = findNodes(
    PaymentMethodField(),
    (node) => node.type === "RadioGroup",
  )[0];

  const { DeliveryCompanySelector } = evaluateComponent(
    await readSource(
      "src/features/checkout/ui/delivery-selector/delivery-company-selector.tsx",
    ),
    {
      "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
      "@/shared/ui": sharedUi,
      "./delivery-options": {
        deliveryCompanies: [
          { code: "cdek", icon: component("CdekIcon"), label: "СДЭК" },
          { code: "ozon", icon: component("OzonIcon"), label: "Ozon" },
        ],
      },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const companyGroup = findNodes(
    DeliveryCompanySelector({
      isOzonDeliveryAvailable: true,
      onSelect: () => undefined,
      selectedCompany: "cdek",
    }),
    (node) => node.type === "RadioGroup",
  )[0];

  for (const group of [deliveryGroup, paymentGroup, companyGroup]) {
    assert.match(group.props.className, /(?:^|\s)gap-0(?:\s|$)/u);
    assert.match(group.props.className, /(?:^|\s)divide-y(?:\s|$)/u);
    assert.match(group.props.className, /(?:^|\s)border-y(?:\s|$)/u);
    assert.ok(group.props["aria-labelledby"]);
  }

  const sharedRadioGroup = await readSource("src/shared/ui/radio-group.tsx");
  assert.match(sharedRadioGroup, /cn\("grid gap-2", className\)/u);
});

test("checkout calculation and order errors are assertive atomic alerts", async (t) => {
  let checkoutCalculation;
  const { CheckoutFlow } = evaluateComponent(
    await readSource("src/features/checkout/ui/checkout-flow.tsx"),
    {
      "lucide-react": { RefreshCw: component("RefreshCw") },
      "@/shared/ui": {
        Button: component("Button"),
        DataState: component("DataState"),
        Separator: component("Separator"),
      },
      "../lib": {
        checkoutOrderFormId: "checkout-order-form",
        formatMoney: (value) => String(value),
        useCheckout: () => ({
          checkoutCalculation,
          isSubmitting: false,
          selectedDelivery: { pickupPointId: "point-1", provider: "cdek" },
          submitLabel: "Перейти к оплате",
          submitOrder: () => undefined,
        }),
        withCheckout: (Component) => Component,
      },
      "./contact-fields": { ContactFields: component("ContactFields") },
      "./checkout-submit-button": { CheckoutSubmitButton: component("CheckoutSubmitButton") },
      "./delivery-method-field": { DeliveryMethodField: component("DeliveryMethodField") },
      "./legal-field": { LegalField: component("LegalField") },
      "./order-summary": { OrderSummary: component("OrderSummary") },
      "./payment-method-field": { PaymentMethodField: component("PaymentMethodField") },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const cart = { isOzonDeliveryAvailable: true, minimumDeliveryPrices: { ozon: 100 } };
  const retry = () => undefined;
  checkoutCalculation = { status: "idle" };
  const idleTree = CheckoutFlow({ cart, createOrderError: null });
  const deliverySection = findNodes(
    idleTree,
    (node) => typeof node.type === "function" && node.props?.number === "02",
  )[0];
  const deliverySectionTree = deliverySection.type(deliverySection.props);
  const deliveryHeading = findNodes(deliverySectionTree, (node) => node.type === "h2")[0];

  assert.equal(deliveryHeading.props.id, "checkout-section-02-heading");

  async function assertCalculationAlert(name, state) {
    await t.test(name, () => {
      checkoutCalculation = state;
      const tree = CheckoutFlow({ cart, createOrderError: null });
      const alerts = findNodes(tree, (node) => node.props?.role === "alert");
      const retryButtons = findNodes(
        tree,
        (node) => node.type === "Button" && getText(node).includes("Повторить расчет"),
      );

      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].props["aria-live"], "assertive");
      assert.equal(alerts[0].props["aria-atomic"], true);
      assert.equal(findNodes(alerts[0], (node) => node.type === "DataState").length, 1);
      assert.equal(findNodes(alerts[0], (node) => node.type === "Button").length, 0);
      assert.equal(retryButtons.length, 1);
    });
  }

  await assertCalculationAlert("offline calculation feedback", { retry, status: "offline" });
  await assertCalculationAlert("failed calculation feedback", {
    error: new Error("Расчет не выполнен"),
    retry,
    status: "error",
  });

  await t.test("create-order feedback", () => {
    checkoutCalculation = { status: "idle" };
    const orderErrorTree = CheckoutFlow({ cart, createOrderError: new Error("Заказ не создан") });
    const orderAlerts = findNodes(orderErrorTree, (node) => node.props?.role === "alert");

    assert.equal(orderAlerts.length, 1);
    assert.equal(orderAlerts[0].props["aria-live"], "assertive");
    assert.equal(orderAlerts[0].props["aria-atomic"], true);
    assert.equal(findNodes(orderAlerts[0], (node) => node.type === "DataState").length, 1);
  });
});

test("checkout announces calculation progress and updated totals without repeating errors", async () => {
  let checkoutCalculation = { status: "idle" };
  const { OrderSummary } = evaluateComponent(
    await readSource("src/features/checkout/ui/order-summary.tsx"),
    {
      "next/image": component("Image"),
      "lucide-react": {
        LoaderCircle: component("LoaderCircle"),
        Truck: component("Truck"),
      },
      "@/entities/feature-banners": {
        useDevelopmentBanner: () => ({ hasDevelopmentBanner: false }),
      },
      "@/entities/session": { useSession: () => ({ isPending: false, user: undefined }) },
      "@/features/promocode": { PromoCodeForm: component("PromoCodeForm") },
      "@/shared/lib": {
        cn: (...values) => values.filter(Boolean).join(" "),
        shouldBypassNextImageOptimization: () => false,
      },
      "@/shared/lib/query-keys": { getQueryOwner: () => "guest" },
      "@/shared/ui": {
        Card: component("Card"),
        CardContent: component("CardContent"),
        CardDescription: component("CardDescription"),
        CardFooter: component("CardFooter"),
        CardHeader: component("CardHeader"),
        CardTitle: component("CardTitle"),
        Separator: component("Separator"),
      },
      "../lib": {
        checkoutOrderFormId: "checkout-order-form",
        formatEstimatedDeliveryDateRange: () => undefined,
        formatMoney: (value) => `${value} ₽`,
        useCheckout: () => ({
          checkoutCalculation,
          selectedDelivery: { pickupPointId: "point-1", provider: "cdek" },
        }),
      },
      "./checkout-submit-button": {
        CheckoutSubmitButton: component("CheckoutSubmitButton"),
      },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const cart = { items: [], itemsCount: 0, subtotal: 1000 };

  function getCalculationStatus() {
    const tree = OrderSummary({
      cart,
      isSubmitDisabled: true,
      isSubmitting: false,
      submitLabel: "Перейти к оплате",
    });
    const statuses = findNodes(tree, (node) => node.props?.role === "status");

    assert.equal(statuses.length, 1);
    assert.equal(statuses[0].props["aria-live"], "polite");
    assert.equal(statuses[0].props["aria-atomic"], true);
    assert.match(statuses[0].props.className, /(?:^|\s)sr-only(?:\s|$)/u);
    assert.equal(findNodes(statuses[0], (node) => node.type === "button").length, 0);

    return statuses[0];
  }

  assert.equal(getText(getCalculationStatus()), "");

  checkoutCalculation = { status: "pending" };
  assert.equal(getText(getCalculationStatus()), "Обновляем стоимость доставки.");

  checkoutCalculation = {
    calculation: {
      delivery: {
        pickupPoint: { address: "Москва", workHours: "Ежедневно" },
        provider: "cdek",
      },
      deliveryPrice: 200,
      discount: 0,
      total: 1200,
    },
    status: "ready",
  };
  assert.equal(
    getText(getCalculationStatus()),
    "Стоимость доставки 200 ₽. Итого 1200 ₽.",
  );

  checkoutCalculation = { error: new Error("Расчет не выполнен"), status: "error" };
  assert.equal(getText(getCalculationStatus()), "");
});

test("legal checkboxes own their errors while keeping legal links separate", async () => {
  const errors = {
    acceptedLegal: { message: "Примите условия" },
    acceptedPersonalDataConsent: { message: "Подтвердите согласие" },
  };
  let id = 0;
  const { LegalField } = evaluateComponent(
    await readSource("src/features/checkout/ui/legal-field.tsx"),
    {
      "../lib": {},
      "./field-error": { FieldError: component("FieldError") },
      "@/shared/constants": { routes: { legal: { publicOffer: "/offer" } } },
      "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
      "@/shared/ui": {
        PersonalDataConsentCheckbox: component("PersonalDataConsentCheckbox"),
      },
      "@/shared/ui/link": { Link: component("Link") },
      react: { useId: () => `id-${++id}` },
      "react-hook-form": {
        useFormContext: () => ({ formState: { errors }, register: (name) => ({ name }) }),
      },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const tree = LegalField();
  const offer = findNodes(tree, (node) => node.type === "input")[0];
  const consent = findNodes(tree, (node) => node.type === "PersonalDataConsentCheckbox")[0];
  const errorsById = findNodes(tree, (node) => node.type === "FieldError").map(
    (node) => node.props.id,
  );

  assert.equal(offer.props["aria-describedby"], "checkout-legal-error");
  assert.equal(consent.props["aria-describedby"], "checkout-personal-data-consent-error");
  assert.deepEqual(errorsById, ["checkout-legal-error", "checkout-personal-data-consent-error"]);
  assert.equal(findNodes(tree, (node) => node.type === "Link").length, 1);
  assert.equal(findNodes(tree, (node) => node.type === "label").length > 0, true);
});

test("personal data consent keeps a 44px label target without nesting legal links", async () => {
  const { PersonalDataConsentCheckbox } = evaluateComponent(
    await readSource("src/shared/ui/personal-data-consent-checkbox.tsx"),
    {
      "./link": { Link: component("Link") },
      "@/shared/constants": {
        routes: {
          legal: { personalDataConsent: "/consent", privacyPolicy: "/privacy" },
        },
      },
      "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
      react: { forwardRef: (render) => render },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const tree = PersonalDataConsentCheckbox({ id: "consent" }, null);
  const target = findNodes(
    tree,
    (node) => node.type === "label" && node.props?.htmlFor === "consent",
  )[0];
  const links = findNodes(tree, (node) => node.type === "Link");

  assert.match(target.props.className, /min-h-11/u);
  assert.match(target.props.className, /min-w-11/u);
  assert.equal(findNodes(target, (node) => node.type === "Link").length, 0);
  assert.equal(links.length, 2);
});

test("checkout FAQ describes guest contacts and both payment methods accurately", async () => {
  const source = await readSource("src/shared/actions/faq/faq.data.ts");

  assert.match(source, /укажите имя, телефон и email/u);
  assert.match(source, /Ozon Pay и T‑Bank поддерживают оплату банковской картой и через СБП/u);
});
