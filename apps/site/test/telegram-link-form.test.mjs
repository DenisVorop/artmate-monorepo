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

async function loadTelegramLinkForm() {
  return evaluateTypeScript(
    await readSource("src/features/account/lib/telegram-link-form.ts"),
  );
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

async function createAccountHarness({
  confirmPending = false,
  sessionPending = false,
  user = { email: "user@example.com", id: "user-1", roles: [] },
} = {}) {
  const telegramLinkForm = await loadTelegramLinkForm();
  const calls = { confirm: [], registeredFields: [] };
  const jsx = (type, props, key) => ({ key, props: props ?? {}, type });
  const component = (name) => name;
  const modules = {
    "../lib": telegramLinkForm,
    "../model": {
      useConfirmTelegramLink: () => ({
        isPending: confirmPending,
        mutate: async (input) => calls.confirm.push(input),
      }),
      useUnlinkTelegram: () => ({ isPending: false, mutate: async () => undefined }),
    },
    "./welcome-promo-card": { WelcomePromoCard: component("WelcomePromoCard") },
    "@/entities/orders": {
      getLatestOrder: () => undefined,
      getPreferredCustomerEmail: () => undefined,
      OrderCard: component("OrderCard"),
      useOrdersData: () => ({ data: [], isError: false, isPending: false }),
    },
    "@/entities/session": {
      getSessionUserDisplayName: () => "Test User",
      useSession: () => ({ isPending: sessionPending, user }),
      useTelegramLinkStatus: () => ({
        data: { botUrl: "https://t.me/artmate_bot", linked: false },
        isError: false,
        isPending: false,
      }),
    },
    "@/shared/constants": { routes: { auth: "/auth", catalog: "/catalog" } },
    "@/shared/ui": Object.fromEntries(
      [
        "Badge",
        "Button",
        "Card",
        "CardContent",
        "CardHeader",
        "CardTitle",
        "DataState",
        "Dialog",
        "DialogClose",
        "DialogContent",
        "DialogDescription",
        "DialogFooter",
        "DialogHeader",
        "DialogTitle",
        "DialogTrigger",
        "Input",
        "Label",
        "PersonalDataConsentCheckbox",
      ].map((name) => [name, component(name)]),
    ),
    "@/shared/ui/link": { Link: component("Link") },
    "@/shared/ui/typography": {
      PageTitle: component("PageTitle"),
      SectionTitle: component("SectionTitle"),
    },
    "@hookform/resolvers/zod": { zodResolver: (schema) => schema },
    "lucide-react": new Proxy({}, { get: (_, name) => component(String(name)) }),
    react: {
      useState: (initialValue) => [initialValue, () => undefined],
    },
    "react-hook-form": {
      useForm: () => ({
        formState: { errors: {} },
        handleSubmit: (submit) => () => submit({ code: " 123456 " }),
        register: (name) => {
          calls.registeredFields.push(name);
          return { name };
        },
        reset: () => undefined,
      }),
    },
    "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
  };
  const { Account } = evaluateTypeScript(
    await readSource("src/features/account/ui/account.tsx"),
    modules,
  );

  function render(node) {
    if (Array.isArray(node)) {
      return node.map(render);
    }
    if (!node || typeof node !== "object") {
      return node;
    }
    if (typeof node.type === "function") {
      return render(node.type(node.props));
    }

    return {
      ...node,
      props: { ...node.props, children: render(node.props.children) },
    };
  }

  return { calls, tree: render(Account()) };
}

test("telegram link schema and mapper accept a trimmed six-digit code only", async () => {
  const { telegramLinkFormSchema, toConfirmTelegramLinkInput } = await loadTelegramLinkForm();
  const values = telegramLinkFormSchema.parse({ code: " 123456 " });

  assert.deepEqual(values, { code: "123456" });
  assert.deepEqual(toConfirmTelegramLinkInput(values), { code: "123456" });

  for (const code of ["", "12345", "1234567", "12345a", "１２３４５６"]) {
    assert.equal(telegramLinkFormSchema.safeParse({ code }).success, false);
  }
});

test("rendered Telegram form has no consent field and submits code only", async () => {
  const harness = await createAccountHarness();
  const form = findNode(harness.tree, (node) => node.type === "form");

  assert.ok(form);
  assert.deepEqual(harness.calls.registeredFields, ["code"]);
  assert.equal(
    findNode(harness.tree, (node) => node.type === "PersonalDataConsentCheckbox"),
    undefined,
  );
  assert.doesNotMatch(renderedText(harness.tree), /согласи|персональн/u);

  await form.props.onSubmit();
  assert.deepEqual(harness.calls.confirm, [{ code: "123456" }]);
});

test("account keeps the guest login gate and pending guards", async () => {
  const guest = await createAccountHarness({ user: null });
  assert.equal(
    findNode(guest.tree, (node) => node.type === "DataState").props.title,
    "Войдите в аккаунт",
  );
  assert.equal(findNode(guest.tree, (node) => node.type === "form"), undefined);

  const sessionPending = await createAccountHarness({ sessionPending: true });
  assert.equal(
    findNode(sessionPending.tree, (node) => node.type === "DataState").props.title,
    "Загружаем аккаунт",
  );
  assert.equal(findNode(sessionPending.tree, (node) => node.type === "form"), undefined);

  const confirmationPending = await createAccountHarness({ confirmPending: true });
  const submitButton = findNode(
    confirmationPending.tree,
    (node) => node.type === "Button" && node.props.type === "submit",
  );
  assert.equal(submitButton.props.disabled, true);
});

test("account keeps its responsive grid without a sticky profile column", async () => {
  const { tree } = await createAccountHarness();
  const aside = findNode(tree, (node) => node.type === "aside");

  assert.equal(aside.props.className, "space-y-4");
  assert.equal(aside.props.children.length, 3);
  assert.equal(
    findNode(
      tree,
      (node) =>
        node.type === "div" &&
        node.props.className ===
          "grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start",
    )?.props.className,
    "grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start",
  );
});
