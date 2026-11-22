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
const forms = await load("forms", { "./format": await load("format") });
const prize = {
  quantity: 2,
  albumIds: ["one", "two", "three"],
  albums: ["one", "two", "three"].map((id) => ({ id, available: id !== "three" })),
};
test("album selection rejects missing, duplicate, foreign and unavailable choices", () => {
  const schema = forms.createAlbumSelectionSchema(prize);
  assert.equal(schema.safeParse({ albumIds: ["one", "two"] }).success, true);
  for (const albumIds of [[], ["one"], ["one", "one"], ["one", "foreign"], ["one", "three"]])
    assert.equal(schema.safeParse({ albumIds }).success, false);
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
    albumIds: ["one", "two"],
    customer: { name: "Иван Иванов", email: "winner@example.test", phone: "+7 (999) 123-45-67" },
    pickupPointId: "ozon-point",
    acceptedLegal: true,
    acceptedPersonalDataConsent: true,
    comment: undefined,
  });
  ids.pop();
  assert.deepEqual(input.albumIds, ["one", "two"]);
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
