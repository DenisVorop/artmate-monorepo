import assert from "node:assert/strict";
import test from "node:test";

import {
  workshopModerationDecisionSchema,
  workshopModerationDetailSchema,
  workshopModerationQueueSchema,
} from "../src/shared/actions/workshop-moderation/workshop-moderation.schemas.ts";
import {
  getWorkshopModerationReasonInput,
  workshopModerationReasonFormSchema,
  workshopModerationReasonMaxLength,
} from "../src/features/workshop-moderation/lib/reason-form.ts";

const queueItem = {
  revisionId: "11111111111111111111111111111111",
  workId: "22222222222222222222222222222222",
  status: "PENDING",
  submittedAt: "2026-09-01T10:00:00.000Z",
  createdAt: "2026-09-01T09:55:00.000Z",
  author: { id: "user-1", name: "Анна" },
  workshopHandle: "anna",
  collection: {
    id: "collection-1",
    slug: "flowers",
    title: "Коллекция",
  },
  coloring: { id: "coloring-1", number: 12, title: "Лис" },
  suspectedOfficialCopy: false,
  isPublishedRevision: false,
};

test("workshop moderation queue schema is strict and bounded", () => {
  assert.equal(
    workshopModerationQueueSchema.safeParse([queueItem]).success,
    true,
  );
  assert.equal(
    workshopModerationQueueSchema.safeParse([
      { ...queueItem, storageKey: "private/key.webp" },
    ]).success,
    false,
  );
  assert.equal(
    workshopModerationQueueSchema.safeParse([
      { ...queueItem, submittedAt: undefined },
    ]).success,
    false,
  );
  assert.equal(
    workshopModerationQueueSchema.safeParse(
      Array.from({ length: 501 }, (_, index) => ({
        ...queueItem,
        revisionId: index.toString(16).padStart(32, "0"),
      })),
    ).success,
    false,
  );
});

test("moderation detail accepts the exact backend response shape", () => {
  const detail = {
    ...queueItem,
    caption: "Моя работа",
    advertisingConsent: false,
    officialComparison: {
      revisionId: "33333333333333333333333333333333",
      version: 2,
      coloredUrl:
        "http://localhost:3002/admin/colorings/coloring-1/revisions/33333333333333333333333333333333/assets/colored/content",
      palette: {
        label: "Artmate 168",
        version: "v1",
        colors: [
          {
            symbolPosition: 1,
            symbol: "1",
            colorNumber: 23,
            pantone: "P 1",
            hex: "#AABBCC",
            markerNumber: "023",
          },
        ],
      },
    },
    materials: [
      {
        position: 1,
        type: "ARTMATE_168",
        brand: "Artmate",
        line: "168",
      },
    ],
    symbolMappings: [
      {
        symbol: "1",
        markerNumber: "023",
        materialPosition: 1,
        officialColor: {
          id: "marker-color-023",
          colorNumber: 23,
          pantone: "P 1",
          hex: "#AABBCC",
          markerNumber: "023",
        },
      },
    ],
    assets: {
      normalized:
        "http://localhost:3002/admin/workshop-moderation/11111111111111111111111111111111/assets/normalized",
      web: "http://localhost:3002/admin/workshop-moderation/11111111111111111111111111111111/assets/web",
      thumb:
        "http://localhost:3002/admin/workshop-moderation/11111111111111111111111111111111/assets/thumb",
    },
    decisionHistory: [
      {
        id: "44444444444444444444444444444444",
        revisionId: "11111111111111111111111111111111",
        decision: "SUBMITTED",
        actor: { id: "user-1", name: "Анна" },
        createdAt: "2026-09-01T10:00:00.000Z",
      },
    ],
  };

  assert.equal(workshopModerationDetailSchema.safeParse(detail).success, true);
  assert.equal(
    workshopModerationDetailSchema.safeParse({
      ...detail,
      advertisingConsent: true,
    }).success,
    false,
  );
  assert.equal(
    workshopModerationDetailSchema.safeParse({
      ...detail,
      advertisingConsentAt: "2026-09-01T10:00:00.000Z",
    }).success,
    false,
  );
  assert.equal(
    workshopModerationDetailSchema.safeParse({
      ...detail,
      advertisingConsent: true,
      advertisingConsentAt: "2026-09-01T10:00:00.000Z",
    }).success,
    true,
  );
  assert.equal(
    workshopModerationDetailSchema.safeParse({
      ...detail,
      materials: [{ ...detail.materials[0], position: 19 }],
      symbolMappings: [{ ...detail.symbolMappings[0], materialPosition: 19 }],
    }).success,
    true,
  );
  assert.equal(
    workshopModerationDetailSchema.safeParse({
      ...detail,
      symbolMappings: [
        {
          symbol: "1",
          markerNumber: "",
          materialPosition: 1,
        },
      ],
    }).success,
    true,
  );
  assert.equal(
    workshopModerationDetailSchema.safeParse({
      ...detail,
      materials: [{ ...detail.materials[0], position: 20 }],
    }).success,
    false,
  );
  assert.equal(
    workshopModerationDetailSchema.safeParse({
      ...detail,
      privateStorageKey: "private/work.webp",
    }).success,
    false,
  );
});

test("request changes and hide decisions require a bounded reason", () => {
  for (const decision of ["REQUEST_CHANGES", "HIDE"] as const) {
    assert.equal(
      workshopModerationDecisionSchema.safeParse({ decision }).success,
      false,
    );
    assert.equal(
      workshopModerationDecisionSchema.safeParse({ decision, reason: "  " })
        .success,
      false,
    );
    assert.equal(
      workshopModerationDecisionSchema.safeParse({
        decision,
        reason: "Причина",
      }).success,
      true,
    );
  }

  assert.equal(
    workshopModerationDecisionSchema.safeParse({ decision: "APPROVE" }).success,
    true,
  );
  assert.equal(
    workshopModerationDecisionSchema.safeParse({
      decision: "REQUEST_CHANGES",
      reason: "Исправьте подпись\nhttps://spam.example",
    }).success,
    false,
  );
  assert.equal(
    workshopModerationReasonFormSchema.safeParse({
      reason: "x".repeat(workshopModerationReasonMaxLength + 1),
    }).success,
    false,
  );
});

test("reason input trims author-facing moderation text", () => {
  assert.deepEqual(
    getWorkshopModerationReasonInput("REQUEST_CHANGES", {
      reason: "  Добавьте фото при дневном свете  ",
    }),
    {
      decision: "REQUEST_CHANGES",
      reason: "Добавьте фото при дневном свете",
    },
  );
});
