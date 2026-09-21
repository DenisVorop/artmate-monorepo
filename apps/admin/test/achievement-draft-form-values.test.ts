import assert from "node:assert/strict";
import test from "node:test";

import {
  achievementDraftFormSchema,
  achievementImageMaxBytes,
  createAchievementDraftDefaultValues,
  getAchievementImageFileError,
  getAchievementImageUploadFormData,
  toCreateAchievementDraftInput,
  toUpdateAchievementDraftInput,
  type AchievementDraftFormValues,
} from "../src/features/achievement-drafts-management/lib/form-values.ts";

test("achievement form validates API integer bounds and uploaded image URLs", () => {
  const valid = {
    ...createAchievementDraftDefaultValues,
    imageUrl: "https://cdn.example.test/achievement.png",
    rewardPoints: "0",
    title: "Первая публикация",
  } satisfies AchievementDraftFormValues;

  assert.equal(achievementDraftFormSchema.safeParse(valid).success, true);
  assert.equal(
    achievementDraftFormSchema.safeParse({
      ...valid,
      imageUrl: "http://example.test/a.png",
    }).success,
    true,
  );
  assert.equal(
    achievementDraftFormSchema.safeParse({
      ...valid,
      imageUrl: "file:///tmp/a.png",
    }).success,
    false,
  );
  assert.equal(
    achievementDraftFormSchema.safeParse({ ...valid, target: 0 }).success,
    false,
  );
  assert.equal(
    achievementDraftFormSchema.safeParse({ ...valid, rewardPoints: "-1" })
      .success,
    false,
  );
  assert.equal(
    achievementDraftFormSchema.safeParse({ ...valid, sortOrder: 2_147_483_648 })
      .success,
    false,
  );
});

test("create mapper trims text and maps an empty image URL to null", () => {
  const values: AchievementDraftFormValues = {
    ...createAchievementDraftDefaultValues,
    conditionKind: "completed_order_count",
    description: " Описание ",
    imageUrl: "   ",
    rewardPoints: "25",
    sortOrder: 3,
    target: 2,
    title: " Постоянный покупатель ",
  };

  assert.deepEqual(toCreateAchievementDraftInput(values), {
    conditionKind: "completed_order_count",
    description: "Описание",
    imageUrl: null,
    rewardPoints: 25,
    sortOrder: 3,
    target: 2,
    title: "Постоянный покупатель",
  });
});

test("update mapper sends the full editable body with the current version", () => {
  const values: AchievementDraftFormValues = {
    ...createAchievementDraftDefaultValues,
    description: "Текст",
    imageUrl: "https://cdn.example.test/achievement.png",
    rewardPoints: "10",
    title: "Коллекционер",
  };

  assert.deepEqual(toUpdateAchievementDraftInput(values, 7), {
    conditionKind: "published_coloring_count",
    description: "Текст",
    expectedVersion: 7,
    imageUrl: "https://cdn.example.test/achievement.png",
    rewardPoints: 10,
    sortOrder: 0,
    target: 1,
    title: "Коллекционер",
  });
});

test("create defaults keep reward blank after reset and require fresh input", () => {
  assert.equal(createAchievementDraftDefaultValues.rewardPoints, "");
  assert.equal(
    achievementDraftFormSchema.safeParse(createAchievementDraftDefaultValues)
      .success,
    false,
  );
});

test("image file validation accepts supported files within the upload limit", () => {
  assert.equal(
    getAchievementImageFileError({ size: 1, type: "image/png" }),
    undefined,
  );
  assert.equal(
    getAchievementImageFileError({ size: 1, type: "image/gif" }),
    "Поддерживаются JPEG, PNG и WebP",
  );
  assert.equal(
    getAchievementImageFileError({
      size: achievementImageMaxBytes + 1,
      type: "image/webp",
    }),
    "Размер изображения не должен превышать 5 МБ",
  );
});

test("image upload mapper uses the multipart file field", () => {
  const file = new File(["image"], "achievement.png", { type: "image/png" });
  const fileList = {
    0: file,
    item: (index: number) => (index === 0 ? file : null),
    length: 1,
  } as unknown as FileList;

  const formData = getAchievementImageUploadFormData({ file: fileList });

  assert.equal(formData.get("file"), file);
});
