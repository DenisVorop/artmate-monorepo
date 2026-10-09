import assert from "node:assert/strict";
import test from "node:test";

import type { ColoringVariants } from "../src/entities/coloring-variants/model/types.ts";
import {
  getPublicationBlockReason,
  getPublicationError,
  getTargetStatus,
  publicationNeedsReload,
} from "../src/features/coloring-variants-management/lib/publication-values.ts";

function state(): ColoringVariants {
  return {
    coloringId: "coloring-1",
    token: "2026-09-28T00:00:00.000Z",
    width: 100,
    height: 100,
    outlineUrl: "/outline",
    original: {
      status: "draft",
      updatedAt: "2026-09-28T00:00:00.000Z",
      palette: [{ symbolPosition: 1, hex: "#123456" }],
      imageUrl: "/original",
      cardUrl: "/card",
    },
    variants: [
      {
        status: "draft",
        materialSetId: "set-1",
        title: "Набор 1",
        updatedAt: "2026-09-28T00:00:00.000Z",
        palette: [
          {
            symbolPosition: 1,
            hex: "#123456",
            code: "001",
            materialColorId: "color-1",
          },
        ],
        imageUrl: "/variant",
        cardUrl: "/variant-card",
      },
    ],
  };
}

test("draft original can be published before a material adaptation", () => {
  const current = state();
  assert.equal(getPublicationBlockReason(current, "original"), null);
  assert.match(
    getPublicationBlockReason(current, "set-1") ?? "",
    /Сначала опубликуйте оригинал/,
  );
  current.original!.status = "published";
  assert.equal(getPublicationBlockReason(current, "set-1"), null);
});

test("published and archived variants cannot be published again", () => {
  const current = state();
  current.original!.status = "published";
  assert.match(
    getPublicationBlockReason(current, "original") ?? "",
    /уже опубликован/,
  );
  current.variants[0]!.status = "published";
  assert.match(
    getPublicationBlockReason(current, "set-1") ?? "",
    /уже опубликован/,
  );
  current.variants[0]!.status = "archived";
  assert.match(getPublicationBlockReason(current, "set-1") ?? "", /в архиве/);
  current.original!.status = "archived";
  assert.match(
    getPublicationBlockReason(current, "original") ?? "",
    /в архиве/,
  );
});

test("publication requires the exact target to exist", () => {
  const current = state();
  assert.match(
    getPublicationBlockReason(current, "another-set") ?? "",
    /Сначала загрузите/,
  );
  current.original = null;
  assert.match(
    getPublicationBlockReason(current, "original") ?? "",
    /Сначала загрузите/,
  );
  assert.match(
    getPublicationBlockReason(current, "set-1") ?? "",
    /Сначала опубликуйте оригинал/,
  );
});

test("published replacement confirmation applies only to the selected target", () => {
  const current = state();
  current.original!.status = "published";
  assert.equal(getTargetStatus(current, "original"), "published");
  assert.equal(getTargetStatus(current, "set-1"), "draft");
  current.variants[0]!.status = "published";
  assert.equal(getTargetStatus(current, "set-1"), "published");
  assert.equal(getTargetStatus(current, "another-set"), undefined);
});

test("stale or uncertain publication outcomes require a reload before retry", () => {
  for (const [code, status] of [
    ["STALE_UPLOAD", 409],
    [undefined, 409],
    ["UNRECOGNIZED_CONFLICT", 409],
    [undefined, undefined],
    [undefined, 502],
  ] as const) {
    assert.equal(publicationNeedsReload(code, status), true);
  }
  for (const code of [
    "PUBLICATION_NOT_READY",
    "ORIGINAL_NOT_PUBLISHED",
    "VARIANT_ARCHIVED",
  ]) {
    assert.equal(publicationNeedsReload(code, 409), false);
  }
});

test("publication errors explain readiness and never show an unknown server code", () => {
  assert.match(
    getPublicationError("PUBLICATION_NOT_READY", 400),
    /описание и темы/,
  );
  assert.match(
    getPublicationError("ORIGINAL_NOT_PUBLISHED", 409),
    /Сначала опубликуйте оригинал/,
  );
  assert.match(getPublicationError("STALE_UPLOAD", 409), /Обновите страницу/);
  assert.equal(
    getPublicationError("SQL secret details", 500).includes("SQL"),
    false,
  );
});
