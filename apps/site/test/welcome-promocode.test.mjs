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

test("welcome query isolates users and requests the server-provided promo", async () => {
  const requests = [];
  const { promoCodeQuery } = evaluateTypeScript(
    await readSource("src/entities/promocode/model/query.ts"),
    {
      "@/shared/actions/promocodes": {
        getWelcomePromoCode: async () => {
          requests.push("welcome");
          return { data: { promo: { code: "SERVER20" } } };
        },
        previewPromoCode: async () => ({ data: undefined }),
      },
      "@/shared/lib/api-result": {
        ApiResult: { fromDTO: (result) => ({ unwrap: () => result.data }) },
      },
      "@/shared/lib/query-keys": {
        cartPricingQueryKey: ["cart-pricing"],
        welcomeOfferQueryKey: ["cart-pricing", "welcome-offer"],
      },
      "@tanstack/react-query": { queryOptions: (options) => options },
    },
  );

  const first = promoCodeQuery.welcome("user-1");
  const second = promoCodeQuery.welcome("user-2");

  assert.notDeepEqual(first.queryKey, second.queryKey);
  assert.deepEqual(first.queryKey, ["cart-pricing", "welcome-promocode", "user-1"]);
  assert.deepEqual(await first.queryFn(), { promo: { code: "SERVER20" } });
  assert.deepEqual(requests, ["welcome"]);
});

test("welcome hook hides cached data while disabled, refetching, or failed", async () => {
  let queryResult;
  const queryCalls = [];
  const { getFreshQueryData } = evaluateTypeScript(
    await readSource("src/shared/lib/query-freshness.ts"),
    {},
  );
  const { useWelcomePromo } = evaluateTypeScript(
    await readSource("src/entities/promocode/model/use-welcome-promo.ts"),
    {
      "./query": {
        promoCodeQuery: {
          welcome: (userId) => ({ queryKey: ["welcome", userId] }),
        },
      },
      "@/shared/lib/query-freshness": { getFreshQueryData },
      "@tanstack/react-query": {
        useQuery: (options) => {
          queryCalls.push(options);
          return queryResult;
        },
      },
    },
  );
  const cached = { promo: { code: "OLD-CODE" } };

  queryResult = { data: cached, isError: false, isFetching: false, isPending: false };
  assert.equal(
    useWelcomePromo({ enabled: false, userId: "user-1" }).data,
    undefined,
  );

  queryResult = { data: cached, isError: false, isFetching: true, isPending: false };
  assert.equal(
    useWelcomePromo({ enabled: true, userId: "user-2" }).data,
    undefined,
  );

  queryResult = { data: cached, isError: true, isFetching: false, isPending: false };
  assert.equal(
    useWelcomePromo({ enabled: true, userId: "user-2" }).data,
    undefined,
  );

  queryResult = {
    data: cached,
    fetchStatus: "paused",
    isError: false,
    isFetching: false,
    isPaused: true,
    isPending: false,
  };
  assert.equal(
    useWelcomePromo({ enabled: true, userId: "user-2" }).data,
    undefined,
  );
  assert.equal(queryCalls[0].enabled, false);
  assert.equal(queryCalls[1].enabled, true);
});

test("account welcome card preserves kopecks, uses Moscow expiry, and exposes copy states", async () => {
  let welcomeResult = { data: undefined };
  const state = [];
  let cursor = 0;
  const clipboardWrites = [];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (value) => clipboardWrites.push(value),
      },
    },
  });
  const jsx = (type, props, key) => ({ key, props, type });
  const component = (name) => name;
  const { WelcomePromoCard } = evaluateTypeScript(
    await readSource("src/features/account/ui/welcome-promo-card.tsx"),
    {
      "@/entities/promocode": { useWelcomePromo: () => welcomeResult },
      "@/shared/ui": {
        Badge: component("Badge"),
        Button: component("Button"),
        Card: component("Card"),
        CardContent: component("CardContent"),
        CardHeader: component("CardHeader"),
        CardTitle: component("CardTitle"),
      },
      "lucide-react": {
        Check: component("Check"),
        Copy: component("Copy"),
        Gift: component("Gift"),
      },
      react: {
        useState(initialValue) {
          const index = cursor++;
          if (!(index in state)) {
            state[index] = initialValue;
          }
          return [state[index], (value) => (state[index] = value)];
        },
      },
      "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx, jsxs: jsx },
    },
  );
  const render = () => {
    cursor = 0;
    return WelcomePromoCard({ isTelegramLinked: true, userId: "user-1" });
  };

  assert.equal(render(), null);

  welcomeResult = {
    data: {
      promo: {
        amount: 123.45,
        code: "SERVER20",
        discountPercent: null,
        endsAt: "2026-12-31T21:30:00.000Z",
        maxDiscount: 777.75,
        minSubtotal: 500.5,
      },
    },
  };
  let tree = render();
  assert.match(renderedText(tree), /SERVER20/u);
  assert.match(renderedText(tree), /Скидка 123,45\s*₽/u);
  assert.match(renderedText(tree), /Сумма товаров от 500,5\s*₽/u);
  assert.match(renderedText(tree), /Скидка до 777,75\s*₽/u);
  assert.match(renderedText(tree), /До 01\.01\.2027, 00:30 МСК/u);
  assert.match(renderedText(tree), /один раз/u);
  assert.doesNotMatch(renderedText(tree), /ARTMSTART/u);

  const copyButton = findNode(tree, (node) => node.type === "Button");
  assert.equal(copyButton.props["aria-label"], "Скопировать промокод SERVER20");
  await copyButton.props.onClick();
  tree = render();
  assert.deepEqual(clipboardWrites, ["SERVER20"]);
  assert.match(renderedText(tree), /Скопировано/u);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async () => {
          throw new DOMException("blocked", "NotAllowedError");
        },
      },
    },
  });
  await findNode(tree, (node) => node.type === "Button").props.onClick();
  tree = render();
  assert.match(renderedText(tree), /SERVER20/u);
  assert.match(renderedText(tree), /Не удалось скопировать\. Выделите код вручную\./u);
});

test("welcome action is private no-store and all eligibility transitions invalidate it", async () => {
  const [action, confirmTelegram, unlinkTelegram, createOrder, login, logout, verification] =
    await Promise.all([
      readSource("src/shared/actions/promocodes/promocodes.actions.ts"),
      readSource("src/features/account/model/use-confirm-telegram-link.ts"),
      readSource("src/features/account/model/use-unlink-telegram.ts"),
      readSource("src/features/checkout/model/use-create-order.ts"),
      readSource("src/features/auth/model/use-login.ts"),
      readSource("src/features/auth/model/use-logout.ts"),
      readSource("src/features/auth/model/use-confirm-email-verification.ts"),
    ]);

  assert.match(action, /getWelcomePromoCode/u);
  assert.match(action, /\/promocodes\/welcome/u);
  assert.match(action, /cache: "no-store"/u);
  assert.match(action, /authAccessTokenCookieName/u);
  assert.doesNotMatch(action, /ARTMSTART/u);

  for (const source of [
    confirmTelegram,
    unlinkTelegram,
    createOrder,
    login,
    logout,
    verification,
  ]) {
    assert.match(source, /invalidateQueries\(\{ queryKey: cartPricingQueryKey \}\)/u);
  }
});
