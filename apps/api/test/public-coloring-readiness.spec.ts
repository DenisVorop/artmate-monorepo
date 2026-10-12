import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ColoringStatus } from "../src/generated/prisma/client";
import { isReadyPublishedArtwork } from "../src/colorings/public-coloring-variant-eligibility";

function readyArtwork() {
  return {
    width: 4096,
    height: 4096,
    derivativeProfile: "webp-preview-v3",
    colorSpace: "srgb",
    outlineStorageKey: "outline.webp",
    outlineChecksum: "a".repeat(64),
    outlineByteSize: 20 * 1024 * 1024,
    outlineSourceChecksum: "b".repeat(64),
    outlineSourceMime: "image/png",
    outlineAlt: "Контур",
    updatedAt: new Date("2026-10-12T12:00:00.000Z"),
    original: {
      imageStorageKey: "original.webp",
      imageChecksum: "c".repeat(64),
      imageByteSize: 20 * 1024 * 1024,
      sourceChecksum: "d".repeat(64),
      sourceMime: "image/png",
      imageAlt: "Оригинал",
      cardStorageKey: "card.webp",
      cardChecksum: "e".repeat(64),
      cardByteSize: 1000,
      cardWidth: 640,
      cardHeight: 640,
      status: ColoringStatus.PUBLISHED as ColoringStatus,
      publishedAt: new Date("2026-10-12T12:00:00.000Z") as Date | null,
      updatedAt: new Date("2026-10-12T12:00:00.000Z"),
      colors: [{ symbolPosition: 19, hex: "#123456" }],
    },
  };
}

type Artwork = ReturnType<typeof readyArtwork>;

describe("public artwork readiness", () => {
  it("accepts complete published artwork at public size bounds", () => {
    assert.equal(isReadyPublishedArtwork(readyArtwork()), true);
    assert.equal(isReadyPublishedArtwork(null), false);
    assert.equal(isReadyPublishedArtwork(undefined), false);
    assert.equal(
      isReadyPublishedArtwork({ ...readyArtwork(), original: null }),
      false,
    );
  });

  for (const [name, mutate] of [
    ["blank outline key", (r: Artwork) => (r.outlineStorageKey = " ")],
    ["blank outline alt", (r: Artwork) => (r.outlineAlt = " ")],
    [
      "invalid outline checksum",
      (r: Artwork) => (r.outlineChecksum = "broken"),
    ],
    [
      "uppercase URL checksum",
      (r: Artwork) => (r.original.imageChecksum = "A".repeat(64)),
    ],
    ["missing outline source", (r: Artwork) => (r.outlineSourceChecksum = "")],
    ["zero outline size", (r: Artwork) => (r.outlineByteSize = 0)],
    ["oversized outline", (r: Artwork) => (r.outlineByteSize += 1)],
    ["oversized original", (r: Artwork) => (r.original.imageByteSize += 1)],
    ["unsupported profile", (r: Artwork) => (r.derivativeProfile = "unsafe")],
    ["wrong color space", (r: Artwork) => (r.colorSpace = "cmyk")],
    ["zero width", (r: Artwork) => (r.width = 0)],
    ["oversized width", (r: Artwork) => (r.width = 4097)],
    ["oversized height", (r: Artwork) => (r.height = 4097)],
    ["fractional dimension", (r: Artwork) => (r.width = 1.5)],
    ["zero card width", (r: Artwork) => (r.original.cardWidth = 0)],
    ["oversized card width", (r: Artwork) => (r.original.cardWidth = 641)],
    ["oversized card height", (r: Artwork) => (r.original.cardHeight = 641)],
    [
      "draft original",
      (r: Artwork) => (r.original.status = ColoringStatus.DRAFT),
    ],
    ["missing publication", (r: Artwork) => (r.original.publishedAt = null)],
    ["empty original palette", (r: Artwork) => (r.original.colors = [])],
  ] as const) {
    it(`rejects ${name}`, () => {
      const record = readyArtwork();
      mutate(record);
      assert.equal(isReadyPublishedArtwork(record), false);
    });
  }
});
