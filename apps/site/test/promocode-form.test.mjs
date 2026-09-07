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
  const calls = { apply: [], clear: 0, login: 0, registeredOnChange: [] };
  let submittedCode = initialState.selectedCode ?? "";
  const state = {
    applyCode: (code) => calls.apply.push(code),
    clearCode: () => {
      calls.clear += 1;
    },
    error: undefined,
    isError: false,
    isGuest: false,
    isHydrating: false,
    isPaused: false,
    isPending: false,
    onLoginRequested: undefined,
    preview: undefined,
    retry: () => undefined,
    selectedCode: undefined,
    ...initialState,
  };
  const formErrors = initialState.formErrors ?? {};
  const jsx = (type, props, key) => ({ key, props, type });
  const component = (name) => name;
  const { PromoCodeForm } = evaluateTypeScript(
    await readSource("src/features/promocode/ui/promo-code-form.tsx"),
    {
      "../lib": { ...promoCode, usePromocode: () => state },
      "@/shared/ui": {
        Button: component("Button"),
        Input: component("Input"),
        Label: component("Label"),
      },
      "@hookform/resolvers/zod": { zodResolver: (schema) => schema },
      "lucide-react": {
        LoaderCircle: component("LoaderCircle"),
        LogIn: component("LogIn"),
        Tag: component("Tag"),
      },
      react: { useEffect: (effect) => effect() },
      "react-hook-form": {
        useForm: () => ({
          formState: { errors: formErrors },
          handleSubmit: (submit) => () => submit({ code: submittedCode }),
          register: () => ({
            name: "code",
            onBlur: () => undefined,
            onChange: (event) => {
              calls.registeredOnChange.push(event.target.value);
              submittedCode = event.target.value;
            },
            ref: () => undefined,
          }),
          reset: ({ code }) => {
            submittedCode = code;
          },
        }),
      },
      "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
    },
  );

  return { calls, render: () => PromoCodeForm() };
}

test("promo schema keeps normalization and uses one concise validation error", async () => {
  const { promoCodeFormSchema } = await loadPromoCodeModules();

  for (const code of ["", "ab", "A".repeat(41), "SAVE CODE", "ПРОМО"]) {
    const result = promoCodeFormSchema.safeParse({ code });

    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].message, "Введите промокод");
  }

  assert.deepEqual(promoCodeFormSchema.parse({ code: " save-10 " }), { code: "SAVE-10" });
  assert.deepEqual(promoCodeFormSchema.parse({ code: "save_10" }), { code: "SAVE_10" });
  assert.equal(promoCodeFormSchema.parse({ code: "abc" }).code, "ABC");
  assert.equal(promoCodeFormSchema.parse({ code: "a".repeat(40) }).code, "A".repeat(40));
});

test("selected, error and paused states omit secondary retry and delete actions", async () => {
  for (const state of [
    { selectedCode: "SAVE10" },
    { error: new Error("Промокод истек"), isError: true, selectedCode: "SAVE10" },
    { isPaused: true, isPending: true, selectedCode: "SAVE10" },
  ]) {
    const { render } = await createFormHarness(state);
    const text = renderedText(render());

    assert.doesNotMatch(text, /Повторить проверку|Удалить промокод/u);
    assert.match(text, /Заменить/u);
  }
});

test("main action reapplies the same selected code while paused and guest login remains", async () => {
  const paused = await createFormHarness({
    isPaused: true,
    isPending: true,
    selectedCode: "SAVE10",
  });
  const pausedTree = paused.render();
  const submitButton = findNode(
    pausedTree,
    (node) => node.type === "Button" && node.props.type === "submit",
  );
  const form = findNode(pausedTree, (node) => node.type === "form");

  assert.equal(submitButton.props.disabled, false);
  assert.match(renderedText(submitButton), /Заменить/u);
  assert.match(renderedText(pausedTree), /Нет сети\. Скидка будет доступна/u);
  form.props.onSubmit();
  assert.deepEqual(paused.calls.apply, ["SAVE10"]);

  const guest = await createFormHarness({
    error: new Error("Требуется вход"),
    isError: true,
    isGuest: true,
    onLoginRequested: () => {
      guest.calls.login += 1;
    },
  });
  const guestTree = guest.render();
  const loginButton = findNode(guestTree, (node) => renderedText(node) === "Войти и проверить");

  assert.ok(loginButton);
  loginButton.props.onClick();
  assert.equal(guest.calls.login, 1);
});

test("input preserves registered onChange and clears only an emptied selected code", async () => {
  const harness = await createFormHarness({ selectedCode: "SAVE10" });
  const input = findNode(harness.render(), (node) => node.type === "Input");

  input.props.onChange({ target: { value: "NEW10" } });
  assert.equal(harness.calls.clear, 0);
  input.props.onChange({ target: { value: "   " } });

  assert.deepEqual(harness.calls.registeredOnChange, ["NEW10", "   "]);
  assert.equal(harness.calls.clear, 1);

  const emptyHarness = await createFormHarness({ selectedCode: "SAVE10" });
  const emptyInput = findNode(emptyHarness.render(), (node) => node.type === "Input");
  emptyInput.props.onChange({ target: { value: "" } });
  assert.deepEqual(emptyHarness.calls.registeredOnChange, [""]);
  assert.equal(emptyHarness.calls.clear, 1);
});

test("pending, hydration, success and error states keep their status semantics", async () => {
  const hydrating = await createFormHarness({ isHydrating: true });
  const hydratingTree = hydrating.render();
  assert.equal(findNode(hydratingTree, (node) => node.type === "Input").props.disabled, true);
  assert.equal(
    findNode(hydratingTree, (node) => node.type === "Button" && node.props.type === "submit").props
      .disabled,
    true,
  );
  assert.match(renderedText(hydratingTree), /Проверяем сохраненный промокод/u);

  const pending = await createFormHarness({ isPending: true });
  const pendingTree = pending.render();
  assert.equal(
    findNode(pendingTree, (node) => node.type === "Button" && node.props.type === "submit").props
      .disabled,
    true,
  );
  assert.match(renderedText(pendingTree), /Применить/u);
  assert.match(renderedText(pendingTree), /Проверяем промокод и сумму скидки/u);

  const success = await createFormHarness({
    preview: { code: "SAVE10", discount: 100 },
    selectedCode: "SAVE10",
  });
  assert.match(renderedText(success.render()), /Промокод SAVE10 применен\. Скидка 100 ₽\./u);

  const failure = await createFormHarness({ error: new Error("Промокод истек"), isError: true });
  assert.match(renderedText(failure.render()), /Промокод истек/u);
});

test("promo controls keep 44px targets and associate validation errors without duplicating status", async () => {
  const harness = await createFormHarness({
    formErrors: { code: { message: "Введите промокод" } },
  });
  const tree = harness.render();
  const input = findNode(tree, (node) => node.type === "Input");
  const submit = findNode(tree, (node) => node.type === "Button" && node.props.type === "submit");
  const error = findNode(tree, (node) => node.props?.id === "promo-code-error");
  const status = findNode(tree, (node) => node.props?.id === "promo-code-status");

  assert.match(input.props.className, /min-h-11/u);
  assert.equal(input.props["aria-invalid"], true);
  assert.equal(input.props["aria-describedby"], "promo-code-error promo-code-status");
  assert.match(submit.props.className, /min-h-11/u);
  assert.equal(error.props.role, "alert");
  assert.ok(status);
  assert.equal(
    findNode(status, (node) => node.props?.id === "promo-code-error"),
    undefined,
  );

  const guest = await createFormHarness({
    error: new Error("Требуется вход"),
    isError: true,
    isGuest: true,
    onLoginRequested: () => undefined,
  });
  const login = findNode(guest.render(), (node) => renderedText(node) === "Войти и проверить");
  assert.match(login.props.className, /min-h-11/u);
});
