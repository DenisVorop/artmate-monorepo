import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

export async function loadPriceSummary() {
  const cart = await load("entities/cart/lib/cart-pricing.ts");
  const checkout = await load("features/checkout/lib/price-summary.ts", {
    "@/entities/cart": cart,
  });
  return { ...cart, ...checkout };
}
