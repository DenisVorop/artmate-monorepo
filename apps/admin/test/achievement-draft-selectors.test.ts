import assert from "node:assert/strict";
import test from "node:test";

import {
  canActivateAchievement,
  getAchievementConditionLabel,
  getAchievementStatusLabel,
  hasUnpublishedAchievementChanges,
} from "../src/entities/achievement-drafts/lib/achievement-draft-selectors.ts";
import type { AchievementDraft } from "../src/entities/achievement-drafts/model/types.ts";

type ActivationState = Pick<
  AchievementDraft,
  "activeVersion" | "conditionKind" | "status" | "version"
>;

test("collection diversity can activate independently of the coloring count", () => {
  assert.equal(
    canActivateAchievement({
      activeVersion: null,
      conditionKind: "distinct_collection_count",
      status: "draft",
      version: 1,
    }),
    true,
  );
  assert.equal(
    getAchievementConditionLabel("distinct_collection_count"),
    "Работы из разных тематик",
  );
});

test("completed albums can activate with an independently configured target", () => {
  assert.equal(
    canActivateAchievement({
      activeVersion: null,
      conditionKind: "completed_collection_count",
      status: "draft",
      version: 1,
    }),
    true,
  );
  assert.equal(
    getAchievementConditionLabel("completed_collection_count"),
    "Завершённые альбомы",
  );
});

test("published coloring draft can activate its current version", () => {
  const achievement = {
    activeVersion: null,
    conditionKind: "published_coloring_count",
    status: "draft",
    version: 1,
  } satisfies ActivationState;

  assert.equal(canActivateAchievement(achievement), true);
  assert.equal(hasUnpublishedAchievementChanges(achievement), false);
});

test("active achievement exposes a newer inactive revision", () => {
  const achievement = {
    activeVersion: 2,
    conditionKind: "published_coloring_count",
    status: "active",
    version: 3,
  } satisfies ActivationState;

  assert.equal(canActivateAchievement(achievement), true);
  assert.equal(hasUnpublishedAchievementChanges(achievement), true);
  assert.equal(getAchievementStatusLabel(achievement.status), "Активна");
});

test("completed orders activate while archived and already active revisions do not", () => {
  const orders = {
    activeVersion: null,
    conditionKind: "completed_order_count",
    status: "draft",
    version: 1,
  } satisfies ActivationState;
  const archived = {
    activeVersion: 1,
    conditionKind: "published_coloring_count",
    status: "archived",
    version: 1,
  } satisfies ActivationState;

  assert.equal(canActivateAchievement(orders), true);
  assert.equal(
    canActivateAchievement({ ...orders, status: "active", activeVersion: 1 }),
    false,
  );
  assert.equal(canActivateAchievement(archived), false);
  assert.equal(getAchievementStatusLabel(archived.status), "Архив");
});
