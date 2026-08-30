import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { CreateColoringRevisionRequestDTO } from "../src/colorings/dto/create-coloring-revision-request.dto";
import { ColoringRevisionDTO } from "../src/colorings/dto/coloring-revision.dto";
import { ReviewColoringRevisionRequestDTO } from "../src/colorings/dto/review-coloring-revision-request.dto";

describe("Coloring revision DTOs", () => {
  it("parses ordered marker IDs from multipart JSON and trims alt text", () => {
    const dto = plainToInstance(CreateColoringRevisionRequestDTO, {
      markerColorIds: '["marker-color-104","marker-color-001"]',
      outlineAlt: "  Контур лесных друзей  ",
      coloredAlt: "  Цветная версия лесных друзей  ",
    });

    assert.deepEqual(validateSync(dto), []);
    assert.deepEqual(
      { ...dto },
      {
        markerColorIds: ["marker-color-104", "marker-color-001"],
        outlineAlt: "Контур лесных друзей",
        coloredAlt: "Цветная версия лесных друзей",
      },
    );
  });

  it("accepts all 19 palette positions", () => {
    const markerColorIds = Array.from(
      { length: 19 },
      (_, index) => `marker-color-${String(index + 1).padStart(3, "0")}`,
    );
    const dto = plainToInstance(CreateColoringRevisionRequestDTO, {
      markerColorIds: JSON.stringify(markerColorIds),
      outlineAlt: "Контур",
      coloredAlt: "Цветная версия",
    });

    assert.deepEqual(validateSync(dto), []);
    assert.deepEqual(dto.markerColorIds, markerColorIds);
  });

  for (const value of [
    "",
    "not-json",
    "{}",
    "[]",
    '["marker-color-104","marker-color-104"]',
    '["unknown"]',
    JSON.stringify(
      Array.from(
        { length: 20 },
        (_, index) => `marker-color-${String(index + 1).padStart(3, "0")}`,
      ),
    ),
  ]) {
    it(`rejects invalid multipart markerColorIds ${JSON.stringify(value)}`, () => {
      const dto = plainToInstance(CreateColoringRevisionRequestDTO, {
        markerColorIds: value,
        outlineAlt: "Контур",
        coloredAlt: "Цветная версия",
      });

      assert.equal(
        validateSync(dto).some((error) => error.property === "markerColorIds"),
        true,
      );
    });
  }

  it("rejects blank and overlong revision alt text", () => {
    const dto = plainToInstance(CreateColoringRevisionRequestDTO, {
      markerColorIds: '["marker-color-104"]',
      outlineAlt: "o".repeat(221),
      coloredAlt: " ",
    });
    const properties = validateSync(dto).map((error) => error.property);

    assert.deepEqual(properties.sort(), ["coloredAlt", "outlineAlt"]);
  });

  it("requires a trimmed comment for rejection and permits approval without one", () => {
    const rejected = plainToInstance(ReviewColoringRevisionRequestDTO, {
      decision: "rejected",
      comment: "   ",
    });
    const approved = plainToInstance(ReviewColoringRevisionRequestDTO, {
      decision: "approved",
    });

    assert.equal(
      validateSync(rejected).some((error) => error.property === "comment"),
      true,
    );
    assert.deepEqual(validateSync(approved), []);
  });

  it("trims an optional review comment", () => {
    const dto = plainToInstance(ReviewColoringRevisionRequestDTO, {
      decision: "approved",
      comment: "  Looks good  ",
    });

    assert.deepEqual(validateSync(dto), []);
    assert.equal((dto as { comment?: string }).comment, "Looks good");
  });

  it("rejects private storage fields in revision responses", () => {
    const response = createRevisionResponse();
    const dto = plainToInstance(ColoringRevisionDTO, {
      ...response,
      outline: {
        ...response.outline,
        storageKey: "private/path.webp",
      },
    });
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    assert.equal(
      errors.some(
        (error) =>
          error.property === "outline" &&
          error.children?.some((child) => child.property === "storageKey"),
      ),
      true,
    );
  });

  for (const derivativeProfile of [
    "webp-preview-v1",
    "webp-preview-v2",
    "webp-preview-v3",
  ] as const) {
    it(`accepts ${derivativeProfile} revision responses`, () => {
      const dto = plainToInstance(ColoringRevisionDTO, {
        ...createRevisionResponse(),
        derivativeProfile,
      });

      assert.deepEqual(
        validateSync(dto, {
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
        [],
      );
    });
  }

  it("accepts native and maximum geometry and rejects dimensions above 4096", () => {
    for (const [width, height] of [
      [2450, 3436],
      [4096, 4096],
    ]) {
      const dto = plainToInstance(ColoringRevisionDTO, {
        ...createRevisionResponse(),
        derivativeProfile: "webp-preview-v3",
        width,
        height,
      });

      assert.deepEqual(validateSync(dto), []);
    }

    for (const [width, height] of [
      [4097, 1600],
      [1200, 4097],
      [0, 1600],
    ]) {
      const dto = plainToInstance(ColoringRevisionDTO, {
        ...createRevisionResponse(),
        width,
        height,
      });

      assert.ok(
        validateSync(dto).some(
          (error) => error.property === "width" || error.property === "height",
        ),
      );
    }
  });
});

function createRevisionResponse() {
  const asset = {
    sourceMime: "image/png",
    sourceChecksum: "a".repeat(64),
    mimeType: "image/webp",
    byteSize: 1024,
    checksum: "b".repeat(64),
    alt: "Контур",
    previewUrl:
      "/admin/colorings/coloring-1/revisions/revision-1/assets/outline/content",
  };

  return {
    id: "a".repeat(32),
    coloringId: "coloring-1",
    version: 1,
    status: "review_required",
    paletteLabel: "Artmate 168",
    paletteVersion: "2026-08",
    usedColorCount: 12,
    paletteColors: [],
    width: 1200,
    height: 1600,
    derivativeProfile: "webp-preview-v1",
    colorSpace: "srgb",
    outline: asset,
    colored: {
      ...asset,
      sourceMime: "image/webp",
      checksum: "c".repeat(64),
      alt: "Цветная версия",
      previewUrl:
        "/admin/colorings/coloring-1/revisions/revision-1/assets/colored/content",
    },
    createdById: "admin-1",
    createdAt: "2026-08-28T10:00:00.000Z",
  };
}
