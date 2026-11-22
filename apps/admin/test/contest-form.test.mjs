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
  prizeMode: "EQUAL",
  prizePlaces: [],
  hasParticipationPrize: false,
  participationPromoCodeId: null,
  title: "Конкурс",
  slug: "rabota-noyabrya",
  description: "Описание",
  task: "Задание",
  rules: " Одна работа \n\n Только своя фотография ",
  appearance: "new-year",
  hasMarkerPrize: false,
  prizeMarkerQuantity: 1,
  prizeMarkerIds: [],
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
      hasMarkerPrize: false,
      prizeMarkerQuantity: 1,
      prizeMarkerIds: [],
      hasAlbumPrize: true,
      prizeAlbumQuantity: 2,
      prizeAlbumIds: ["one"],
    }).success,
    false,
  );
  const parsed = contestFormSchema.parse({
    ...values,
    hasMarkerPrize: false,
    prizeMarkerQuantity: 1,
    prizeMarkerIds: [],
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

test("ranked prizes validate each place and require a participation code", () => {
  const base = {
    ...values,
    prizeMode: "PLACES",
    prize: "",
    prizeDetail: "",
    prizePlaces: [
      {
        prize: "Три альбома",
        prizeDetail: "",
        hasMarkerPrize: false,
        prizeMarkerQuantity: 1,
        prizeMarkerIds: [],
        hasAlbumPrize: true,
        prizeAlbumQuantity: 3,
        prizeAlbumIds: ["a", "b", "c"],
        prizePromoCodeId: null,
      },
      {
        prize: "Скидка 20%",
        prizeDetail: "",
        hasMarkerPrize: false,
        prizeMarkerQuantity: 1,
        prizeMarkerIds: [],
        hasAlbumPrize: false,
        prizeAlbumQuantity: 1,
        prizeAlbumIds: [],
        prizePromoCodeId: "promo-20",
      },
    ],
    hasParticipationPrize: true,
    participationPromoCodeId: "promo-10",
  };
  assert.equal(contestFormSchema.safeParse(base).success, true);
  assert.equal(
    contestFormSchema.safeParse({ ...base, participationPromoCodeId: null })
      .success,
    false,
  );
  assert.equal(
    contestFormSchema.safeParse({ ...base, prizePlaces: [] }).success,
    false,
  );
  assert.equal(
    contestFormSchema.safeParse({
      ...base,
      prizePlaces: [{ ...base.prizePlaces[0], prizeAlbumIds: ["a", "a", "b"] }],
    }).success,
    false,
  );
  const input = toContestInput(contestFormSchema.parse(base));
  assert.equal(input.prizeMode, "PLACES");
  assert.equal(input.winnersCount, 2);
  assert.deepEqual(input.prizePlaces[0].prizeAlbumIds, ["a", "b", "c"]);
  assert.equal(input.prizePlaces[1].prizePromoCodeId, "promo-20");
  assert.equal(input.participationPromoCodeId, "promo-10");
  assert.equal(input.prizeAlbumQuantity, null);
  const reopened = toContestForm({
    ...input,
    prizePromoTerms: null,
    participationPromoTerms: null,
    prizePlaces: input.prizePlaces.map((prize) => ({
      ...prize,
      prizePromoTerms: null,
    })),
    id: "contest",
    version: 1,
  });
  assert.equal(reopened.prizePlaces[0].hasAlbumPrize, true);
  assert.equal(reopened.hasParticipationPrize, true);
  assert.equal(toContestInput(reopened).winnersCount, 2);
});

test("inactive prize settings do not block switching back to equal prizes", () => {
  const inactive = {
    prize: "",
    prizeDetail: "",
    hasMarkerPrize: false,
    prizeMarkerQuantity: 1,
    prizeMarkerIds: [],
    hasAlbumPrize: true,
    prizeAlbumQuantity: "",
    prizeAlbumIds: [],
    prizePromoCodeId: null,
  };
  assert.equal(
    contestFormSchema.safeParse({ ...values, prizePlaces: [inactive] }).success,
    true,
  );
  assert.equal(
    contestFormSchema.safeParse({
      ...values,
      prizeMode: "PLACES",
      winnersCount: "",
      prizeAlbumQuantity: "",
      prizePlaces: [
        {
          ...inactive,
          prize: "Скидка",
          hasMarkerPrize: false,
          prizeMarkerQuantity: 1,
          prizeMarkerIds: [],
          hasAlbumPrize: false,
          prizePromoCodeId: "promo",
        },
      ],
    }).success,
    true,
  );
});

test("marker prizes validate quantities and choices independently from albums", () => {
  const marker = {
    ...values,
    hasMarkerPrize: true,
    prizeMarkerQuantity: 1,
    prizeMarkerIds: ["markers-24"],
  };
  const parsed = contestFormSchema.parse(marker);
  assert.deepEqual(toContestInput(parsed).prizeMarkerIds, ["markers-24"]);
  for (const patch of [
    { prizeMarkerQuantity: 0 },
    { prizeMarkerQuantity: 1.5 },
    { prizeMarkerQuantity: 2 },
    { prizeMarkerIds: [] },
  ])
    assert.equal(
      contestFormSchema.safeParse({ ...marker, ...patch }).success,
      false,
    );
  const place = {
    prize: "Альбом и маркеры",
    prizeDetail: "",
    hasAlbumPrize: true,
    prizeAlbumQuantity: 1,
    prizeAlbumIds: ["album"],
    prizePromoCodeId: null,
    hasMarkerPrize: true,
    prizeMarkerQuantity: 1,
    prizeMarkerIds: ["marker"],
  };
  assert.equal(
    contestFormSchema.safeParse({
      ...values,
      prizeMode: "PLACES",
      prizePlaces: [place],
    }).success,
    true,
  );
  assert.equal(
    contestFormSchema.safeParse({
      ...values,
      prizeMode: "PLACES",
      prizePlaces: [{ ...place, prizeMarkerIds: ["album"] }],
    }).success,
    false,
  );
  assert.equal(
    contestFormSchema.safeParse({
      ...values,
      prizeMode: "PLACES",
      prizePlaces: [{ ...place, hasAlbumPrize: false, prizeAlbumIds: [] }],
    }).success,
    true,
  );
});
