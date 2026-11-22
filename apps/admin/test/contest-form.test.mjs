import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url),
  ts = require("typescript");
const source = await readFile(
  new URL(
    "../src/features/contests-management/lib/form-values.ts",
    import.meta.url,
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = { exports: {} };
new Function("require", "exports", compiled)(
  (id) =>
    id === "@repo/ui/contest-design"
      ? { contestAppearances: { none: {}, "new-year": {}, autumn: {} } }
      : require(id),
  loaded.exports,
);
const {
  contestFormSchema,
  toMoscowInput,
  fromMoscowInput,
  toContestInput,
  toContestForm,
} = loaded.exports;
const values = {
  title: "Конкурс",
  slug: "rabota-noyabrya",
  description: "Описание",
  task: "Задание",
  rules: " Одна работа \n\n Только своя фотография ",
  appearance: "new-year",
  hasAlbumPrize: false,
  prizePromoCodeId: null,
  prizeAlbumQuantity: 1,
  prizeAlbumIds: [],
  prize: "Альбом",
  prizeDetail: "По альбому каждому",
  winnersCount: 3,
  selectionMode: "AUTOMATIC",
  manualCriteria: "",
  manualTieBreak: "",
  manualEvaluator: "",
  opensAt: "2026-11-01T00:00",
  closesAt: "2026-11-28T23:59",
  drawAt: "2026-11-30T18:00",
  published: false,
};
test("form preserves Moscow deadlines and explicit appearance through save/reopen", () => {
  const parsed = contestFormSchema.parse(values),
    input = toContestInput(parsed);
  assert.equal(input.closesAt, "2026-11-28T20:59:00.000Z");
  assert.equal(input.opensAt, "2026-10-31T21:00:00.000Z");
  assert.equal(input.appearance, "new-year");
  assert.deepEqual(input.rules, ["Одна работа", "Только своя фотография"]);
  const form = toContestForm({ ...input, id: "contest", version: 1 });
  assert.equal(form.closesAt, values.closesAt);
  assert.deepEqual(toContestInput(contestFormSchema.parse(form)), input);
});
test("Moscow conversion works across midnight and year boundaries", () => {
  assert.equal(toMoscowInput("2026-12-31T21:30:00Z"), "2027-01-01T00:30");
  assert.equal(fromMoscowInput("2027-01-01T00:30"), "2026-12-31T21:30:00.000Z");
});
test("form rejects impossible dates, reversed periods and unknown themes", () => {
  for (const patch of [
    { closesAt: "2026-02-30T12:00" },
    { closesAt: values.opensAt },
    { drawAt: values.closesAt },
    { appearance: "unknown" },
    { selectionMode: "VOTES" },
    { rules: " \n " },
    { winnersCount: "1.5" },
    { slug: "../contest" },
  ])
    assert.equal(
      contestFormSchema.safeParse({ ...values, ...patch }).success,
      false,
      JSON.stringify(patch),
    );
});

test("album prize requires enough choices and excludes UI switches from the API payload", () => {
  assert.equal(
    contestFormSchema.safeParse({
      ...values,
      hasAlbumPrize: true,
      prizeAlbumQuantity: 2,
      prizeAlbumIds: ["one"],
    }).success,
    false,
  );
  const parsed = contestFormSchema.parse({
    ...values,
    hasAlbumPrize: true,
    prizeAlbumQuantity: 2,
    prizeAlbumIds: ["one", "two"],
  });
  const input = toContestInput(parsed);
  assert.equal(input.prizeAlbumQuantity, 2);
  assert.deepEqual(input.prizeAlbumIds, ["one", "two"]);
  assert.equal(Object.hasOwn(input, "hasAlbumPrize"), false);
});
test("editing a locked contest preserves seconds and milliseconds in its frozen deadlines", () => {
  const original = {
    ...toContestInput(contestFormSchema.parse(values)),
    entriesCount: 1,
    stage: "completed",
    opensAt: "2026-11-01T00:00:12.345Z",
    closesAt: "2026-11-28T20:59:42.123Z",
    drawAt: "2026-11-30T15:00:17.456Z",
  };
  const reopened = contestFormSchema.parse(toContestForm(original));
  const saved = toContestInput(reopened, original);
  for (const key of ["opensAt", "closesAt", "drawAt"])
    assert.equal(saved[key], original[key]);
});

test("contest promo template is sent explicitly and remains distinct from album settings", () => {
  const parsed = contestFormSchema.parse({
    ...values,
    prizePromoCodeId: "promo-template",
  });
  const input = toContestInput(parsed);
  assert.equal(input.prizePromoCodeId, "promo-template");
  assert.equal(input.prizeAlbumQuantity, null);
  assert.equal(
    toContestInput({ ...parsed, prizePromoCodeId: null }).prizePromoCodeId,
    null,
  );
});
