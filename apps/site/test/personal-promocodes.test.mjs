import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url),
  ts = require("typescript");
async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
const helpers = await load("features/promocode/lib/personal-promocodes.ts");
const now = Date.parse("2026-11-21T12:00:00Z");
const gift = {
  id: "gift",
  kind: "promocode",
  code: "GIFT15",
  status: "available",
  contestTitle: "Зимняя работа",
  discountPercent: 15,
  amount: null,
  minSubtotal: 500,
  maxDiscount: 200,
  startsAt: null,
  endsAt: null,
};
test("personal choices contain eligible prizes and the welcome offer, without used, reserved or expired codes", () => {
  const prizes = [
    gift,
    { kind: "albums", id: "album" },
    ...["used", "reserved", "expired", "disabled"].map((status) => ({
      ...gift,
      id: status,
      code: status,
      status,
    })),
    { ...gift, id: "too-late", code: "OLD", endsAt: "2026-11-01T00:00:00Z" },
    { ...gift, id: "later", code: "LATER", status: "upcoming", startsAt: "2026-12-01T00:00:00Z" },
  ];
  const result = helpers.getPersonalPromoCodes(prizes, { ...gift, code: "WELCOME" }, now);
  assert.deepEqual(
    result.map((p) => p.code),
    ["GIFT15", "LATER", "WELCOME"],
  );
  assert.equal(result[0].title, "Зимняя работа");
  assert.equal(result[2].title, "За знакомство");
});
test("personal choices preserve discount limits and do not repeat the same code", () => {
  const result = helpers.getPersonalPromoCodes([gift, gift], null, now);
  assert.equal(result.length, 1);
  assert.equal(result[0].minSubtotal, 500);
  assert.equal(result[0].maxDiscount, 200);
  assert.equal(helpers.personalPromoDiscount(result[0]), "15%");
  assert.equal(
    helpers.personalPromoDiscount({ ...result[0], discountPercent: null, amount: 100 }),
    "100 ₽",
  );
});
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  const children = Array.isArray(node) ? node : node.props?.children;
  return [node, ...(Array.isArray(children) ? children : [children]).flatMap(nodes)];
}
async function harness(state = {}, code = helpers.getPersonalPromoCodes([gift], null, now)[0]) {
  const calls = { apply: [], analytics: [], clear: 0, info: 0 };
  const current = {
    subtotal: 799,
    selectedCode: undefined,
    isPending: false,
    isHydrating: false,
    isPaused: false,
    isError: false,
    preview: undefined,
    ...state,
    applyCode: async (value) => {
      calls.apply.push(value);
      return true;
    },
    clearCode: () => {
      calls.clear++;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const pricing = await load("features/promocode/lib/promo-pricing-state.ts");
  const component = await load("features/promocode/ui/personal-promo-card.tsx", {
    react: { useId: () => "personal-promo" },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": { Info: "Info", LoaderCircle: "LoaderCircle" },
    "@/shared/ui": { Label: "Label", Button: "Button" },
    "@/shared/ui/switch": { Switch: "Switch" },
    "@/shared/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "../lib/analytics": {
      useAnalytics: () => ({
        submitted: () => calls.analytics.push("submit"),
        replaced: () => calls.analytics.push("replace"),
        removed: () => calls.analytics.push("remove"),
      }),
    },
    "../lib/promo-code-provider": { usePromocode: () => current },
    "../lib/promo-pricing-state": pricing,
    "../lib/personal-promocodes": helpers,
  });
  return {
    calls,
    tree: component.PersonalPromoCard({
      code,
      compact: true,
      onInfo: () => {
        calls.info++;
      },
    }),
  };
}
test("personal switches use the existing apply, replacement and remove flow", async () => {
  const fresh = await harness();
  nodes(fresh.tree)
    .find((n) => n.type === "Switch")
    .props.onCheckedChange(true);
  assert.deepEqual(fresh.calls.apply, ["GIFT15"]);
  assert.deepEqual(fresh.calls.analytics, ["submit"]);
  const replacing = await harness({ selectedCode: "OLD" });
  nodes(replacing.tree)
    .find((n) => n.type === "Switch")
    .props.onCheckedChange(true);
  assert.deepEqual(replacing.calls.analytics, ["replace"]);
  const active = await harness({ selectedCode: "GIFT15", preview: { code: "GIFT15" } });
  nodes(active.tree)
    .find((n) => n.type === "Switch")
    .props.onCheckedChange(false);
  assert.equal(active.calls.clear, 1);
});
test("a personal switch is checked only after a fresh successful server preview", async () => {
  const state = { selectedCode: "GIFT15", preview: { code: "GIFT15" } };
  const confirmed = await harness(state);
  assert.ok(nodes(confirmed.tree).some((n) => n.type === "Switch" && n.props.checked));
  for (const changes of [{ isPending: true }, { isPaused: true }, { isError: true }]) {
    const other = await harness({ ...state, ...changes });
    assert.ok(!nodes(other.tree).some((n) => n.type === "Switch" && n.props.checked));
  }
});
test("unmet amounts disable selection and the info action reveals conditions", async () => {
  const code = { ...helpers.getPersonalPromoCodes([gift], null, now)[0], minSubtotal: 1000 };
  const availability = helpers.personalPromoAvailability(code, 799, now);
  assert.equal(availability.missing, 201);
  assert.equal(availability.canApply, false);
  const result = await harness({}, code);
  assert.equal(nodes(result.tree).find((n) => n.type === "Switch").props.disabled, true);
  assert.ok(!JSON.stringify(result.tree).includes("201"));
  const info = nodes(result.tree).find(
    (n) => n.type === "Button" && n.props["aria-label"]?.startsWith("Условия скидки"),
  );
  info.props.onClick();
  assert.equal(result.calls.info, 1);
  assert.deepEqual(result.calls.apply, []);
  const jsx = (type, props) => ({ type, props });
  const conditions = await load("features/promocode/ui/promo-code-conditions.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "../lib/promo-code-provider": { usePromocode: () => ({ subtotal: 799 }) },
    "../lib/personal-promocodes": helpers,
  });
  const terms = JSON.stringify(conditions.PromoCodeConditions({ code }));
  assert.ok(terms.includes("201"));
  assert.ok(terms.includes("Максимальная скидка"));
  assert.ok(terms.includes("Один раз"));
  const later = helpers.personalPromoAvailability(
    { ...code, startsAt: "2026-12-01T00:00:00Z" },
    1500,
    now,
  );
  assert.equal(later.upcoming, true);
  assert.equal(later.canApply, false);
  assert.equal(helpers.personalPromoAvailability(code, 1000, now).canApply, true);
});
test("copying in My prizes writes the exact code and reports clipboard failure without applying", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const written = [];
  let state = "idle";
  const hook = await load("features/prizes/lib/use-copy-prize-promocode.ts", {
    react: {
      useState: () => [
        state,
        (next) => {
          state = next;
        },
      ],
    },
  });
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: async (code) => written.push(code) } },
    });
    await hook.useCopyPrizePromocode("GIFT15").copy();
    assert.deepEqual(written, ["GIFT15"]);
    assert.equal(state, "copied");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: {
          writeText: async () => {
            throw Error("denied");
          },
        },
      },
    });
    await hook.useCopyPrizePromocode("GIFT15").copy();
    assert.equal(state, "error");
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
});

test("guest state does not expose personal codes even when a query has cached data", async () => {
  const requests = [];
  const hook = await load("features/promocode/model/use-personal-promocodes.ts", {
    "@/entities/session": { useUser: () => null },
    "@/entities/prize": {
      usePrizes: (owner) => {
        requests.push(owner);
        return {
          data: { available: [gift] },
          isPending: false,
          isError: false,
          refetch: async () => {},
        };
      },
    },
    "@/entities/promocode": {
      useWelcomePromo: (input) => {
        assert.equal(input.enabled, false);
        return { data: { promo: gift }, isPending: false, isError: false, refetch: async () => {} };
      },
    },
    "../lib/personal-promocodes": helpers,
  });
  const result = hook.usePersonalPromocodes();
  assert.equal(result.owner, "");
  assert.deepEqual(result.codes, []);
  assert.deepEqual(requests, [""]);
});
