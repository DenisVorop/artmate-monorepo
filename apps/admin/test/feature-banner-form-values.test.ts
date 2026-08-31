import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultFeatureBannerFormValues,
  featureBannerAudiencesSchema,
  featureBannerFormSchema,
  getNextFeatureBannerAudiences,
  toCreateFeatureBannerInput,
  type FeatureBannerFormValues,
} from "../src/features/feature-banners-management/lib/form-values.ts";

test("audience validation accepts a unique nonempty OR group", () => {
  assert.equal(
    featureBannerAudiencesSchema.safeParse(["anonymous", "telegram_unlinked"])
      .success,
    true,
  );
  assert.equal(featureBannerAudiencesSchema.safeParse([]).success, false);
  assert.equal(
    featureBannerAudiencesSchema.safeParse(["anonymous", "anonymous"]).success,
    false,
  );
  assert.equal(
    featureBannerAudiencesSchema.safeParse(["all", "anonymous"]).success,
    false,
  );
  assert.equal(
    featureBannerAudiencesSchema.safeParse(["unknown"]).success,
    false,
  );
});

test("create mapper sends only the plural audiences API contract", () => {
  const values: FeatureBannerFormValues = {
    ...defaultFeatureBannerFormValues,
    audiences: ["anonymous", "telegram_unlinked"],
    ctaHref: " /account ",
    ctaLabel: " Открыть ",
    description: "Описание",
    slug: "welcome-bonus",
    title: "Приветственный бонус",
  };

  assert.equal(featureBannerFormSchema.safeParse(values).success, true);
  assert.deepEqual(toCreateFeatureBannerInput(values), {
    audiences: ["anonymous", "telegram_unlinked"],
    ctaHref: "/account",
    ctaLabel: "Открыть",
    description: "Описание",
    enabled: false,
    slug: "welcome-bonus",
    sortOrder: 100,
    title: "Приветственный бонус",
    tone: "info",
  });
  assert.equal("audience" in toCreateFeatureBannerInput(values), false);
});

test("selecting all replaces specific audiences", () => {
  assert.deepEqual(
    getNextFeatureBannerAudiences(
      ["anonymous", "telegram_unlinked"],
      "all",
      true,
    ),
    ["all"],
  );
});

test("selecting a specific audience removes all and keeps unique groups", () => {
  assert.deepEqual(
    getNextFeatureBannerAudiences(["all"], "anonymous", true),
    ["anonymous"],
  );
  assert.deepEqual(
    getNextFeatureBannerAudiences(["anonymous"], "anonymous", true),
    ["anonymous"],
  );
});

test("unchecking the last audience yields an invalid empty selection", () => {
  const audiences = getNextFeatureBannerAudiences(
    ["telegram_unlinked"],
    "telegram_unlinked",
    false,
  );

  assert.deepEqual(audiences, []);
  assert.equal(featureBannerAudiencesSchema.safeParse(audiences).success, false);
});
