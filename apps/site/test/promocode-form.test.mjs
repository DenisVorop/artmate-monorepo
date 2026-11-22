import { noopFeatureAnalytics } from "./helpers/noop-feature-analytics.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }
    if (specifier === "../lib/analytics") return noopFeatureAnalytics;

    return require(specifier);
  };

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

async function loadPromoCodeModules() {
  const promoCode = evaluateTypeScript(
    await readSource("src/features/promocode/lib/promo-code.ts"),
    { "@/entities/cart": {} },
  );
  const form = evaluateTypeScript(
    await readSource("src/features/promocode/lib/promo-code-form.ts"),
    { "./promo-code": promoCode },
  );

  return { ...promoCode, ...form };
}

function findNode(node, predicate) {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if (predicate(node)) {
    return node;
  }

  const children = Array.isArray(node) ? node : node.props?.children;

  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findNode(child, predicate);

    if (match) {
      return match;
    }
  }

  return undefined;
}

function renderedText(node) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  const children = Array.isArray(node) ? node : node.props?.children;

  return (Array.isArray(children) ? children : [children]).map(renderedText).join("");
}

async function createFormHarness(initialState = {}) {
  const promoCode = await loadPromoCodeModules();
  const calls = { apply: [], clear: 0, close: 0, login: 0, registeredOnChange: [], focus: [] };
  let submittedCode = initialState.selectedCode ?? "";
  const state = {
    applyCode: async (code) => {
      calls.apply.push(code);
      return initialState.applyResult ?? true;
    },
    clearCode: () => {
      calls.clear++;
    },
    isError: false,
    isGuest: false,
    isHydrating: false,
    isPaused: false,
    isPending: false,
    onLoginRequested: undefined,
    ...initialState,
  };
  const formErrors = initialState.formErrors ?? {};
  const jsx = (type, props, key) =>
    typeof type === "function" ? type(props) : { key, props, type };
  const mocks = {
    "../lib/analytics": noopFeatureAnalytics,
    "../lib/promo-code-provider": { usePromocode: () => state },
    "../lib/promo-code": promoCode,
    "@/shared/ui": {
      Button: "Button",
      CtaGradientButton: "Button",
      DrawerBody: "div",
      DrawerFooter: "div",
      Input: "Input",
      Label: "Label",
    },
    "lucide-react": { LoaderCircle: "LoaderCircle", LogIn: "LogIn" },
    react: { useEffect: (effect) => effect(), useRef: (value) => ({ current: value }) },
    "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
  };
  const status = evaluateTypeScript(
    await readSource("src/features/promocode/ui/promo-code-status.tsx"),
    mocks,
  );
  const { ManualPromoCodeForm } = evaluateTypeScript(
    await readSource("src/features/promocode/ui/manual-promo-code-form.tsx"),
    { ...mocks, "./promo-code-status": status },
  );
  const form = {
    formState: { errors: formErrors, isSubmitting: initialState.isSubmitting ?? false },
    handleSubmit: (submit) => () => submit({ code: submittedCode }),
    register: () => ({
      name: "code",
      onBlur: () => {},
      onChange: (event) => {
        calls.registeredOnChange.push(event.target.value);
        submittedCode = event.target.value;
      },
      ref: () => {},
    }),
    watch: () => submittedCode,
    clearErrors: (name) => {
      delete formErrors[name];
    },
    setFocus: (name) => calls.focus.push(name),
  };
  return { calls, render: () => ManualPromoCodeForm({ form, onClose: () => calls.close++ }) };
}

test("promo schema allows empty optional values and normalizes valid ASCII codes", async () => {
  const { promoCodeFormSchema } = await loadPromoCodeModules();
  for (const code of ["ab", "A".repeat(41), "SAVE CODE", "ПРОМО"])
    assert.equal(promoCodeFormSchema.safeParse({ code }).success, false);
  assert.deepEqual(promoCodeFormSchema.parse({ code: " save-10 " }), { code: "SAVE-10" });
  assert.deepEqual(promoCodeFormSchema.parse({ code: "   " }), { code: "" });
});
test("manual picker closes only after a confirmed server result", async () => {
  for (const applyResult of [true, false]) {
    const harness = await createFormHarness({ selectedCode: "save10", applyResult });
    const tree = harness.render();
    await findNode(tree, (node) => node.type === "form").props.onSubmit();
    assert.deepEqual(harness.calls.apply, ["SAVE10"]);
    assert.equal(harness.calls.close, applyResult ? 1 : 0);
    assert.deepEqual(harness.calls.focus, ["code"]);
  }
});
test("clearing the manual input preserves registration and removes the selected code", async () => {
  const harness = await createFormHarness({ selectedCode: "SAVE10" });
  const input = findNode(harness.render(), (node) => node.type === "Input");
  input.props.onChange({ target: { value: "NEW10" } });
  assert.equal(harness.calls.clear, 0);
  input.props.onChange({ target: { value: "" } });
  assert.equal(harness.calls.clear, 1);
  assert.deepEqual(harness.calls.registeredOnChange, ["NEW10", ""]);
});
test("pending and hydration disable submission, while offline state permits retry", async () => {
  for (const state of [
    { isHydrating: true },
    { isPending: true },
    { isPending: true, isPaused: true, isSubmitting: true },
  ]) {
    const harness = await createFormHarness({ selectedCode: "SAVE10", ...state });
    const tree = harness.render();
    const button = findNode(tree, (node) => node.type === "Button" && node.props.type === "submit");
    assert.equal(button.props.disabled, !state.isPaused);
    if (state.isPaused) assert.match(renderedText(tree), /Нет сети/u);
    else assert.match(renderedText(tree), /Проверяем/u);
  }
});
test("manual validation has linked errors and server failures remain readable", async () => {
  const harness = await createFormHarness({
    selectedCode: "ab",
    formErrors: { code: { message: "Проверьте написание промокода" } },
  });
  const tree = harness.render(),
    input = findNode(tree, (node) => node.type === "Input");
  assert.equal(input.props["aria-invalid"], true);
  assert.equal(input.props["aria-describedby"], "promo-code-error promo-code-status");
  assert.equal(findNode(tree, (node) => node.props?.id === "promo-code-error").props.role, "alert");
  const failed = await createFormHarness({ isError: true, error: new Error("fetch failed") });
  assert.match(renderedText(failed.render()), /Не удалось проверить промокод/u);
});
test("guest login closes the picker before opening authentication", async () => {
  let login = 0;
  const harness = await createFormHarness({
    isError: true,
    isGuest: true,
    error: new Error("Требуется вход"),
    onLoginRequested: () => {
      login++;
    },
  });
  const button = findNode(
    harness.render(),
    (node) => node.type === "Button" && renderedText(node).includes("Войти и применить"),
  );
  button.props.onClick();
  assert.equal(login, 1);
  assert.equal(harness.calls.close, 1);
});
