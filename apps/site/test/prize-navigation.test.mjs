import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/prizes/ui/prizes.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

test("an already redeemed prize navigates to orders after rendering, without a render-time redirect", () => {
  const effects = [],
    destinations = [];
  const empty = () => null;
  const mocks = {
    react: { ...React, useEffect: (effect) => effects.push(effect) },
    "next/navigation": {
      useRouter: () => ({ replace: (href) => destinations.push(href) }),
      redirect: () => {
        throw new Error("Navigation during render");
      },
    },
    "@/entities/session": { useSession: () => ({ user: { id: "winner" }, isPending: false }) },
    "@/entities/prize": {
      usePrize: () => ({ data: { orderId: "prize-order" }, isPending: false }),
    },
    "@/shared/constants": { routes: { accountOrders: "/account/orders" } },
    "@/shared/ui": { Button: empty, DataState: empty },
    "@/shared/ui/link": { Link: empty },
    "./prize-list": { PrizeList: empty },
    "./product-selection": { ProductSelection: empty },
    "./prize-checkout": { PrizeCheckout: empty },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
    loaded,
    loaded.exports,
  );
  const markup = renderToStaticMarkup(
    React.createElement(loaded.exports.MyPrizes, {
      view: "checkout",
      prizeId: "redeemed-prize",
    }),
  );
  assert.match(markup, /role="status"/);
  assert.deepEqual(destinations, [], "render must not update the Next router");
  effects.forEach((effect) => effect());
  assert.deepEqual(destinations, ["/account/orders"]);
});
