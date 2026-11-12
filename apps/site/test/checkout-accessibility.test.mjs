import { noopFeatureAnalytics } from "./helpers/noop-feature-analytics.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { loadPriceSummary } from "./helpers/price-summary.mjs";

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
      if (specifier === "../lib/analytics") return noopFeatureAnalytics;
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
    {
      "react/jsx-runtime": jsxRuntime,
      "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
    },
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
    Button: component("Button"),
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
    "./contact-fields.module.css": { phoneHint: "phoneHint" },
    "@/shared/ui": sharedUi,
    "lucide-react": { Plus: component("Plus") },
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
  assert.equal(
    inputById["checkout-phone"].props["aria-describedby"],
    "checkout-phone-error checkout-phone-helper",
  );
  assert.equal(
    findNodes(contactTree, (node) => node.props?.id === "checkout-phone-helper").length,
    1,
  );
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
  const [commentDisclosure] = findNodes(contactTree, (node) => node.type === "details");
  assert.ok(findNodes(commentDisclosure, (node) => node === inputById["checkout-comment"]).length);
  const details = { open: false };
  commentDisclosure.props.ref(details);
  assert.equal(details.open, true);
  assert.equal(
    findNodes(contactTree, (node) => node.props?.id === "checkout-email-helper").length,
    1,
  );

  const { PaymentMethodField } = evaluateComponent(
    await readSource("src/features/checkout/ui/payment-method-field.tsx"),
    {
      ...commonMocks,
      "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
      "@/shared/ui/payment-logos": { PaymentLogo: component("PaymentLogo") },
    },
  );
  const paymentTree = PaymentMethodField();
  const group = findNodes(paymentTree, (node) => node.type === "RadioGroup")[0];
  const brands = findNodes(paymentTree, (node) => node.type === "PaymentLogo").map(
    (node) => node.props.brand,
  );
  assert.equal(group.props["aria-labelledby"], "checkout-payment-heading");
  assert.equal(group.props["aria-describedby"], "checkout-payment-error");
  assert.equal(group.props["aria-invalid"], true);
  assert.deepEqual(brands, ["tbank", "mir", "sbp", "dolyame", "ozonbank", "mir", "sbp"]);
  assert.deepEqual(
    findNodes(paymentTree, (node) => node.type === "RadioGroupItem").map(
      (node) => node.props.value,
    ),
    ["tbank_acquiring", "ozon_acquiring"],
  );
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
      "../lib/use-checkout-auth": {
        useCheckoutAuth: () => ({ onLoginRequested: async () => undefined, isPending: false }),
      },
      "@/features/auth": {
        withAuth: (Component) => Component,
        useAuth: () => ({ onAuth() {}, isPending: false }),
      },
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
      "../lib/analytics": { useAnalytics: () => ({ step() {} }) },
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
      "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
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

test("delivery choices open their picker even when already selected", async (t) => {
  const source = await readSource("src/features/checkout/ui/delivery-method-field.tsx");
  const cases = [
    { provider: undefined, clicked: "ozon", available: true },
    { provider: "ozon", clicked: "ozon", available: true },
    { provider: undefined, clicked: "ozon", available: false },
  ];

  for (const { provider, clicked, available } of cases) {
    await t.test(`${provider ?? "none"} → ${clicked}, available: ${available}`, () => {
      const states = [];
      let stateIndex = 0;
      let openCount = 0;
      let confirmationCount = 0;
      const { DeliveryMethodField } = evaluateComponent(source, {
        "lucide-react": { MapPin: component("MapPin") },
        "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
        react: {
          useEffect: () => undefined,
          useRef: (value) => ({ current: value }),
          useState: (initialValue) => {
            const index = stateIndex++;
            if (!(index in states)) {
              states[index] = typeof initialValue === "function" ? initialValue() : initialValue;
            }
            return [
              states[index],
              (value) => {
                states[index] = typeof value === "function" ? value(states[index]) : value;
              },
            ];
          },
        },
        "@/shared/ui": {
          Label: component("Label"),
          RadioGroup: component("RadioGroup"),
          RadioGroupItem: component("RadioGroupItem"),
        },
        "../lib": {
          createDeliveryPickerDrafts: () => ({}),
          formatMoney: String,
          getDeliveryDraftCandidate: () => undefined,
          isSameDeliverySelection: () => true,
          seedDeliveryPickerDrafts: (drafts) => drafts,
          useCheckout: () => ({
            checkoutCalculation: { status: "idle" },
            confirmDelivery: () => {
              confirmationCount += 1;
            },
            invalidateDeliveryConfirmation: () => undefined,
            selectedDelivery: provider ? { provider, pickupPointId: "saved-pickup" } : undefined,
            isDeliveryPickerOpen: openCount > 0,
            setDeliveryPickerOpen: (isOpen) => {
              if (isOpen) openCount += 1;
            },
          }),
        },
        "./delivery-picker": { DeliveryPicker: component("DeliveryPicker") },
        "./delivery-selector/delivery-options": {
          deliveryCompanies: [{ code: "ozon", label: "Ozon" }],
        },
        "react/jsx-runtime": jsxRuntime,
      });
      const props = { isOzonDeliveryAvailable: available, minimumDeliveryPrices: { ozon: 100 } };
      const tree = DeliveryMethodField(props);
      const choice = findNodes(
        tree,
        (node) => node.type === "RadioGroupItem" && node.props.value === clicked,
      )[0];
      assert.equal(choice.props.disabled, !available && clicked === "ozon");
      choice.props.onClick();
      stateIndex = 0;
      const picker = findNodes(
        DeliveryMethodField(props),
        (node) => node.type === "DeliveryPicker",
      )[0];
      assert.equal(picker.props.isOpen, available);
      if (available) assert.equal(picker.props.selectedCompany, clicked);
      assert.equal(openCount, available ? 1 : 0);
      assert.equal(confirmationCount, 0);
    });
  }
});

test("loyalty shows the balance and applies only the confirmed spending limit", async () => {
  let editing = false;
  const applied = [];
  const { BaseLoyaltyField } = evaluateComponent(
    await readSource("src/features/checkout/ui/loyalty-field.tsx"),
    {
      "../lib/use-checkout-auth": {
        useCheckoutAuth: () => ({ onLoginRequested: async () => undefined, isPending: false }),
      },
      "@hookform/resolvers/zod": { zodResolver: (schema) => schema },
      "lucide-react": { Coins: component("Coins"), LoaderCircle: component("LoaderCircle") },
      react: {
        useState: () => [
          editing,
          (value) => {
            editing = value;
          },
        ],
      },
      "react-hook-form": {
        useForm: () => ({
          formState: { errors: {} },
          handleSubmit: (submit) => submit,
          register: () => ({}),
        }),
      },
      "@/entities/loyalty": { LoyaltyPoints: component("LoyaltyPoints") },
      "@/shared/lib": { decline: () => "баллов" },
      "@/entities/session": {},
      "@/shared/ui/checkbox": { Checkbox: component("Checkbox") },
      "@/shared/constants": { routes: { auth: "/auth", checkout: "/checkout", loyalty: "/club" } },
      "@/shared/ui": {
        Accordion: component("Accordion"),
        AccordionContent: component("AccordionContent"),
        AccordionItem: component("AccordionItem"),
        AccordionTrigger: component("AccordionTrigger"),
        Button: component("Button"),
        Checkbox: component("Checkbox"),
        Input: component("Input"),
        Label: component("Label"),
      },
      "@/shared/ui/link": { Link: component("Link") },
      "../lib": { formatMoney: (value) => `${value} ₽` },
      "../lib/loyalty-form": { createLoyaltyFormSchema: () => ({}) },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const props = {
    isSignedIn: true,
    isSessionPending: false,
    isSubmitting: false,
    hasDelivery: true,
    overview: {
      isPending: false,
      isError: false,
      data: {
        enrolled: true,
        member: { status: "active", historyState: "ready", wallet: { availablePoints: 1250 } },
      },
    },
    checkoutCalculation: { status: "ready" },
    loyalty: {
      isPending: false,
      pointsToSpend: 0,
      setPoints: (value) => applied.push(value),
      preview: { availablePoints: 1250, maxPoints: 1230, pointsToSpend: 0, discountKopecks: 0 },
    },
  };
  const tree = BaseLoyaltyField(props);
  assert.equal(findNodes(tree, (node) => node.type === "LoyaltyPoints")[0].props.points, 1250);
  assert.match(getText(tree), /Списать 1\s230 баллов/u);
  assert.equal(findNodes(tree, (node) => node.type === "Input").length, 0);
  let checkbox = findNodes(tree, (node) => node.type === "Checkbox")[0];
  assert.equal(checkbox.props.disabled, false);
  assert.equal(checkbox.props.checked, false);
  checkbox.props.onCheckedChange(true);
  assert.deepEqual(applied, [1230]);

  const spending = {
    ...props,
    loyalty: {
      ...props.loyalty,
      pointsToSpend: 500,
      preview: { ...props.loyalty.preview, pointsToSpend: 500, discountKopecks: 10000 },
    },
  };
  const spendingTree = BaseLoyaltyField(spending);
  assert.match(getText(spendingTree), /Списать 500 баллов/u);
  assert.doesNotMatch(getText(spendingTree), /−100 ₽/u);
  findNodes(
    spendingTree,
    (node) => node.type === "Button" && getText(node) === "Изменить",
  )[0].props.onClick();
  const editor = findNodes(
    BaseLoyaltyField(spending),
    (node) => typeof node.type === "function",
  )[0];
  assert.equal(editor.props.maxPoints, 1230);
  editor.props.onApply(333);
  assert.deepEqual(applied, [1230, 333]);
  assert.equal(editing, false);
  checkbox = findNodes(BaseLoyaltyField(spending), (node) => node.type === "Checkbox")[0];
  checkbox.props.onCheckedChange(false);
  assert.deepEqual(applied, [1230, 333, 0]);

  for (const unavailable of [
    { ...props, hasDelivery: false, checkoutCalculation: { status: "idle" } },
    { ...props, loyalty: { ...props.loyalty, isPending: true } },
    { ...props, isSubmitting: true },
    {
      ...props,
      loyalty: { ...props.loyalty, preview: { ...props.loyalty.preview, maxPoints: 0 } },
    },
  ]) {
    assert.equal(
      findNodes(BaseLoyaltyField(unavailable), (node) => node.type === "Checkbox")[0].props
        .disabled,
      true,
    );
  }
  const failed = BaseLoyaltyField({ ...spending, checkoutCalculation: { status: "error" } });
  assert.equal(findNodes(failed, (node) => node.type === "Checkbox")[0].props.disabled, false);
});

test("delivery lists keep their local spacing and payment has a named bank selection", async () => {
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
      "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
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
      "@/shared/lib": { cn: (...values) => values.filter(Boolean).join(" ") },
      "@/shared/ui/payment-logos": { PaymentLogo: component("PaymentLogo") },
      "@/shared/ui": sharedUi,
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
  const paymentGroup = findNodes(PaymentMethodField(), (node) => node.type === "RadioGroup")[0];

  const { DeliveryCompanySelector } = evaluateComponent(
    await readSource("src/features/checkout/ui/delivery-selector/delivery-company-selector.tsx"),
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

  assert.equal(paymentGroup.props["aria-labelledby"], "checkout-payment-heading");
  assert.equal(paymentGroup.props["aria-describedby"], undefined);
  assert.equal(deliveryGroup.props.className, paymentGroup.props.className);
  assert.ok(deliveryGroup.props["aria-labelledby"]);
  for (const group of [companyGroup]) {
    assert.match(group.props.className, /(?:^|\s)gap-0(?:\s|$)/u);
    assert.match(group.props.className, /(?:^|\s)divide-y(?:\s|$)/u);
    assert.match(group.props.className, /(?:^|\s)border-y(?:\s|$)/u);
    assert.ok(group.props["aria-labelledby"]);
  }

  const sharedRadioGroup = await readSource("src/shared/ui/radio-group.tsx");
  assert.match(sharedRadioGroup, /cn\("grid gap-2", className\)/u);
});

test("checkout calculation errors are assertive alerts and order errors go to the summary", async (t) => {
  const priceSummary = await loadPriceSummary();
  let checkoutCalculation;
  const { CheckoutFlow } = evaluateComponent(
    await readSource("src/features/checkout/ui/checkout-flow.tsx"),
    {
      "../lib/price-summary": priceSummary,
      "@/features/promocode": {
        getPromoPricingState: () => ({ isReady: true }),
        usePromocode: () => ({}),
      },
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
      "./order-summary": { OrderSummary: component("OrderSummary") },
      "./payment-method-field": { PaymentMethodField: component("PaymentMethodField") },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const cart = {
    items: [],
    subtotal: 1000,
    isOzonDeliveryAvailable: true,
    minimumDeliveryPrices: { ozon: 100 },
  };
  const retry = () => undefined;
  checkoutCalculation = { status: "idle" };
  const idleTree = CheckoutFlow({ cart, createOrderError: null });
  assert.equal(
    findNodes(idleTree, (node) => node.type === "OrderSummary")[0].props.isSubmitDisabled,
    false,
  );
  assert.equal(
    findNodes(idleTree, (node) => node.type === "CheckoutSubmitButton")[0].props.disabled,
    false,
  );
  const deliverySection = findNodes(
    idleTree,
    (node) => typeof node.type === "function" && node.props?.number === "02",
  )[0];
  const deliverySectionTree = deliverySection.type(deliverySection.props);
  const deliveryHeading = findNodes(deliverySectionTree, (node) => node.type === "h2")[0];

  assert.equal(deliveryHeading.props.id, "checkout-section-02-heading");
  const paymentSection = findNodes(
    idleTree,
    (node) => typeof node.type === "function" && node.props?.number === "03",
  )[0];
  assert.equal(paymentSection.props.title, "Способ оплаты");
  assert.equal(findNodes(paymentSection, (node) => node.type === "PaymentMethodField").length, 1);

  async function assertCalculationAlert(name, state) {
    await t.test(name, () => {
      checkoutCalculation = state;
      const tree = CheckoutFlow({ cart, createOrderError: null });
      assert.equal(
        findNodes(tree, (node) => node.type === "OrderSummary")[0].props.isSubmitDisabled,
        false,
      );
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

  await t.test("calculation in progress keeps both submit buttons busy", () => {
    checkoutCalculation = { status: "pending" };
    const tree = CheckoutFlow({ cart, createOrderError: null });
    assert.equal(
      findNodes(tree, (node) => node.type === "OrderSummary")[0].props.isSubmitDisabled,
      true,
    );
    assert.equal(
      findNodes(tree, (node) => node.type === "CheckoutSubmitButton")[0].props.disabled,
      true,
    );
  });

  await t.test("create-order feedback", () => {
    checkoutCalculation = { status: "idle" };
    const error = new Error("Заказ не создан");
    const orderErrorTree = CheckoutFlow({ cart, createOrderError: error });
    const summary = findNodes(orderErrorTree, (node) => node.type === "OrderSummary")[0];
    assert.equal(summary.props.createOrderError, error);
    assert.equal(findNodes(orderErrorTree, (node) => node.type === "form").length, 1);
    assert.equal(findNodes(orderErrorTree, (node) => node.type === "PaymentMethodField").length, 1);
  });
});

test("checkout announces calculation progress and updated totals without repeating errors", async () => {
  const priceSummary = await loadPriceSummary();
  let checkoutCalculation = { status: "idle" };
  const summaryComponents = evaluateComponent(
    await readSource("src/features/checkout/ui/order-summary.tsx"),
    {
      "next/image": component("Image"),
      "lucide-react": {
        ChevronDown: component("ChevronDown"),
        LoaderCircle: component("LoaderCircle"),
        Tag: component("Tag"),
        Truck: component("Truck"),
        ShoppingBag: component("ShoppingBag"),
      },
      "@/entities/feature-banners": {
        useDevelopmentBanner: () => ({ hasDevelopmentBanner: false }),
      },
      "@/entities/session": { useSession: () => ({ isPending: false, user: undefined }) },
      "@/features/promocode": {
        PromoCodeForm: component("PromoCodeForm"),
        getPromoPricingState: () => ({ isReady: true }),
        usePromocode: () => ({}),
      },
      "../lib/price-summary": priceSummary,
      "@/entities/loyalty": { LoyaltyPoints: component("LoyaltyPoints") },
      "@/entities/products": { ProductPrice: component("ProductPrice") },
      "./loyalty-field": { LoyaltyField: component("LoyaltyField") },
      "./legal-field": { LegalField: component("LegalField") },
      "./payment-method-field": { PaymentMethodField: component("PaymentMethodField") },
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
        Accordion: component("Accordion"),
        AccordionContent: component("AccordionContent"),
        AccordionItem: component("AccordionItem"),
        AccordionTrigger: component("AccordionTrigger"),
        DiscountBreakdown: component("DiscountBreakdown"),
        DataState: component("DataState"),
        Separator: component("Separator"),
      },
      "../lib": {
        checkoutOrderFormId: "checkout-order-form",
        formatEstimatedDeliveryDateRange: () => undefined,
        formatMoney: (value) => `${value} ₽`,
        getCheckoutExpectedEarnedPoints: (state) =>
          state.status === "ready" &&
          state.calculation.loyalty.pointsToSpend === 0 &&
          state.calculation.loyalty.expectedEarnedPoints > 0
            ? state.calculation.loyalty.expectedEarnedPoints
            : undefined,
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
  const OrderSummary = (props) => {
    const container = summaryComponents.OrderSummary(props);
    return summaryComponents.BaseOrderSummary(container.props);
  };
  const cart = { items: [], itemsCount: 0, subtotal: 1000 };

  const summaryTree = OrderSummary({
    cart,
    createOrderError: new Error("Заказ не создан"),
    isSubmitDisabled: false,
    isSubmitting: false,
    submitLabel: "Оплатить",
  });
  const orderAlert = findNodes(summaryTree, (node) => node.props?.role === "alert")[0];
  assert.equal(orderAlert.props["aria-live"], "assertive");
  assert.equal(orderAlert.props["aria-atomic"], true);
  assert.equal(
    findNodes(orderAlert, (node) => node.type === "DataState")[0].props.description,
    "Заказ не создан",
  );
  assert.equal(findNodes(summaryTree, (node) => node.type === "PaymentMethodField").length, 0);
  assert.equal(findNodes(summaryTree, (node) => node.type === "LegalField").length, 1);
  assert.equal(
    findNodes(summaryTree, (node) => node.type === "CheckoutSubmitButton")[0].props.form,
    "checkout-order-form",
  );

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
      subtotal: 1000,
      deliveryPrice: 200,
      discount: 0,
      loyalty: { expectedEarnedPoints: 50, pointsToSpend: 0, discountKopecks: 0 },
      total: 1200,
    },
    status: "ready",
  };
  assert.equal(getText(getCalculationStatus()), "Стоимость доставки 200 ₽. Итого 1200 ₽.");
  let earningBadges = findNodes(
    OrderSummary({ cart, isSubmitDisabled: true, isSubmitting: false, submitLabel: "Оплатить" }),
    (node) => node.props?.["aria-label"] === "Будет начислено 50 баллов",
  );
  assert.equal(earningBadges.length, 1);
  const earningPoints = findNodes(earningBadges[0], (node) => node.type === "LoyaltyPoints")[0];
  assert.equal(earningPoints.props.points, 50);
  assert.equal(earningPoints.props.prefix, "+");

  checkoutCalculation = {
    ...checkoutCalculation,
    calculation: {
      ...checkoutCalculation.calculation,
      loyalty: { ...checkoutCalculation.calculation.loyalty, pointsToSpend: 1 },
    },
  };
  earningBadges = findNodes(
    OrderSummary({ cart, isSubmitDisabled: true, isSubmitting: false, submitLabel: "Оплатить" }),
    (node) => node.props?.["aria-label"]?.startsWith("Будет начислено"),
  );
  assert.equal(earningBadges.length, 0);
  assert.doesNotMatch(
    getText(
      OrderSummary({ cart, isSubmitDisabled: true, isSubmitting: false, submitLabel: "Оплатить" }),
    ),
    /Кешбэк баллами|Не начисляется/u,
  );

  checkoutCalculation = { error: new Error("Расчет не выполнен"), status: "error" };
  assert.equal(getText(getCalculationStatus()), "");
  assert.equal(
    findNodes(
      OrderSummary({ cart, isSubmitDisabled: true, isSubmitting: false, submitLabel: "Оплатить" }),
      (node) => node.props?.["aria-label"]?.startsWith("Будет начислено"),
    ).length,
    0,
  );
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
      "../lib": { checkoutOrderFormId: "checkout-order-form" },
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
  assert.equal(offer.props.form, "checkout-order-form");
  assert.equal(consent.props.form, "checkout-order-form");
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
