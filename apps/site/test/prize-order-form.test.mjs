import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url),
  ts = require("typescript");
async function load(name, mocks = {}) {
  const source = await readFile(
    new URL(`../src/features/prizes/lib/${name}.ts`, import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
const products = await load("product-prize", { "./format": await load("format") });
const forms = await load("forms", { "./product-prize": products });
const prize = {
  kind: "products",
  title: "Альбомы",
  groups: [
    {
      kind: "albums",
      quantity: 2,
      products: ["one", "two", "three"].map((id) => ({ id, available: id !== "three" })),
    },
  ],
};

test("album selection rejects missing, duplicate, foreign and unavailable choices", () => {
  const schema = forms.createProductSelectionSchema(prize);
  assert.equal(schema.safeParse({ productIds: ["one", "two"] }).success, true);
  for (const albumIds of [[], ["one"], ["one", "one"], ["one", "foreign"], ["one", "three"]])
    assert.equal(schema.safeParse({ productIds: albumIds }).success, false);
});
test("prize payload contains selected products and contacts, with no amount, cart or payment fields", () => {
  const values = {
    name: " Иван Иванов ",
    email: "winner@example.test",
    phone: "89991234567",
    comment: " ",
    pickupPointId: "ozon-point",
    acceptedLegal: true,
    acceptedPersonalDataConsent: true,
  };
  const ids = ["one", "two"];
  const input = forms.toPrizeOrderInput(ids, values);
  assert.deepEqual(input, {
    productIds: ["one", "two"],
    customer: { name: "Иван Иванов", email: "winner@example.test", phone: "+7 (999) 123-45-67" },
    pickupPointId: "ozon-point",
    acceptedLegal: true,
    acceptedPersonalDataConsent: true,
    comment: undefined,
  });
  ids.pop();
  assert.deepEqual(input.productIds, ["one", "two"]);
});
test("checkout requires the selected point and both consents", () => {
  const values = {
    name: "Иван Иванов",
    email: "winner@example.test",
    phone: "+7 (999) 123-45-67",
    comment: "",
    pickupPointId: "ozon-point",
    acceptedLegal: true,
    acceptedPersonalDataConsent: true,
  };
  assert.equal(forms.prizeCheckoutSchema.safeParse(values).success, true);
  for (const patch of [
    { pickupPointId: "" },
    { acceptedLegal: false },
    { acceptedPersonalDataConsent: false },
    { phone: "123" },
  ])
    assert.equal(forms.prizeCheckoutSchema.safeParse({ ...values, ...patch }).success, false);
});

test("a bundle requires the album and marker quotas separately", () => {
  const bundle = {
    kind: "products",
    title: "Альбомы и маркеры",
    groups: [
      {
        kind: "albums",
        quantity: 2,
        products: ["a", "b", "c"].map((id) => ({ id, available: true })),
      },
      {
        kind: "markers",
        quantity: 1,
        products: [
          { id: "markers-24", available: true },
          { id: "markers-48", available: false },
        ],
      },
    ],
  };
  const schema = forms.createProductSelectionSchema(bundle);
  assert.equal(schema.safeParse({ productIds: ["a", "b", "markers-24"] }).success, true);
  for (const productIds of [
    ["a", "b", "c"],
    ["a", "markers-24"],
    ["a", "b", "markers-48"],
    ["a", "a", "markers-24"],
    ["a", "b", "foreign"],
  ])
    assert.equal(schema.safeParse({ productIds }).success, false);
  assert.deepEqual(
    products.selectedPrizeProducts(bundle, ["b", "markers-24"]).map((item) => item.id),
    ["b", "markers-24"],
  );
});
test("a marker-only prize needs no album and rejects overlapping product pools", () => {
  const group = { kind: "markers", quantity: 1, products: [{ id: "markers", available: true }] };
  assert.equal(
    products.isPrizeSelectionComplete({ kind: "products", groups: [group] }, ["markers"]),
    true,
  );
  assert.equal(
    products.isPrizeSelectionComplete(
      { kind: "products", groups: [group, { ...group, kind: "albums" }] },
      ["markers"],
    ),
    false,
  );
});
