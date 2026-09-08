import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AmbiguousLocalityBoundaryError,
  containsPoint,
  InvalidLocalityBoundaryError,
  MissingLocalityBoundaryError,
  selectLocalityBoundary,
  validateBoundary,
} from "../src/delivery/nominatim-geometry";

const locality = { name: "Тестовый", latitude: 1, longitude: 1 };

function square(min: number, max: number) {
  return [
    [min, min],
    [max, min],
    [max, max],
    [min, max],
    [min, min],
  ];
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    address: { country_code: "ru" },
    addresstype: "city",
    category: "place",
    geojson: { type: "Polygon", coordinates: [square(0, 10)] },
    name: locality.name,
    place_rank: 16,
    type: "city",
    ...overrides,
  };
}

describe("Nominatim boundary independent safety regressions", () => {
  it("rejects a broad administrative boundary even when name, city rank and center match", () => {
    assert.throws(
      () =>
        selectLocalityBoundary(
          [candidate({ category: "boundary", type: "administrative" })],
          locality,
        ),
      MissingLocalityBoundaryError,
    );
  });

  it("does not substitute a municipality or state for a settlement footprint", () => {
    for (const type of ["municipality", "state"]) {
      assert.throws(
        () =>
          selectLocalityBoundary(
            [candidate({ addresstype: type, type })],
            locality,
          ),
        MissingLocalityBoundaryError,
      );
    }
  });

  it("does not match a district through its parent address.city", () => {
    const district = candidate({
      address: { city: locality.name, country_code: "ru" },
      name: "Центральный район",
      namedetails: {
        name: "Центральный район",
        "name:ru": "Центральный район",
      },
    });

    assert.throws(
      () => selectLocalityBoundary([district], locality),
      MissingLocalityBoundaryError,
    );
  });

  it("requires the locality type and country to match", () => {
    for (const item of [
      candidate({ type: "suburb" }),
      candidate({ addresstype: "suburb", type: "suburb" }),
      candidate({ address: { country_code: "by" } }),
      candidate({ address: {} }),
    ]) {
      assert.throws(
        () => selectLocalityBoundary([item], locality),
        MissingLocalityBoundaryError,
      );
    }
  });

  it("accepts a matching object's Russian name with whitespace and ё normalization", () => {
    const boundary = selectLocalityBoundary(
      [
        candidate({
          name: "Other name",
          namedetails: { "name:ru": "  ЁЛКИ  " },
        }),
      ],
      { ...locality, name: "елки" },
    );

    assert.equal(containsPoint(boundary, 1, 1), true);
  });

  it("reports ambiguity instead of selecting the first overlapping valid match", () => {
    assert.throws(
      () =>
        selectLocalityBoundary(
          [
            candidate(),
            candidate({
              geojson: { type: "Polygon", coordinates: [square(-1, 9)] },
            }),
          ],
          locality,
        ),
      AmbiguousLocalityBoundaryError,
    );
  });

  it("does not replace a point result with its bounding box", () => {
    assert.throws(
      () =>
        selectLocalityBoundary(
          [
            candidate({
              boundingbox: ["0", "10", "0", "10"],
              geojson: { type: "Point", coordinates: [1, 1] },
            }),
          ],
          locality,
        ),
      MissingLocalityBoundaryError,
    );
  });

  it("excludes a hole and its edge while including the outer edge and vertex", () => {
    const boundary = validateBoundary({
      type: "Polygon",
      coordinates: [square(0, 10), square(3, 7)],
    });

    assert.equal(containsPoint(boundary, 1, 1), true);
    assert.equal(containsPoint(boundary, 5, 5), false);
    assert.equal(containsPoint(boundary, 3, 5), false);
    assert.equal(containsPoint(boundary, 3, 3), false);
    assert.equal(containsPoint(boundary, 0, 5), true);
    assert.equal(containsPoint(boundary, 0, 0), true);
    assert.equal(containsPoint(boundary, 11, 5), false);
  });

  it("requires the CDEK center to lie in the actual footprint, not a hole", () => {
    assert.throws(
      () =>
        selectLocalityBoundary(
          [
            candidate({
              geojson: {
                type: "Polygon",
                coordinates: [square(0, 10), square(3, 7)],
              },
            }),
          ],
          { ...locality, longitude: 5, latitude: 5 },
        ),
      MissingLocalityBoundaryError,
    );
  });

  it("includes separate MultiPolygon plots without including the gap between them", () => {
    const boundary = validateBoundary({
      type: "MultiPolygon",
      coordinates: [[square(0, 10), square(3, 7)], [square(20, 22)]],
    });

    assert.equal(containsPoint(boundary, 1, 1), true);
    assert.equal(containsPoint(boundary, 5, 5), false);
    assert.equal(containsPoint(boundary, 21, 21), true);
    assert.equal(containsPoint(boundary, 20, 21), true);
    assert.equal(containsPoint(boundary, 15, 15), false);
  });

  it("does not use a concave polygon's bounding box as a membership test", () => {
    const boundary = validateBoundary({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 2],
          [2, 2],
          [2, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    });

    assert.equal(containsPoint(boundary, 1, 8), true);
    assert.equal(containsPoint(boundary, 8, 1), true);
    assert.equal(containsPoint(boundary, 8, 8), false);
  });

  it("rejects open, collapsed and collinear zero-area rings", () => {
    for (const ring of [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      [
        [1, 1],
        [1, 1],
        [1, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 1],
        [2, 2],
        [0, 0],
      ],
    ]) {
      assert.throws(
        () => validateBoundary({ type: "Polygon", coordinates: [ring] }),
        InvalidLocalityBoundaryError,
      );
    }
  });

  it("rejects invalid geometry and non-finite or out-of-range positions", () => {
    for (const value of [
      null,
      { type: "Point", coordinates: [1, 1] },
      { type: "Polygon", coordinates: [] },
      { type: "MultiPolygon", coordinates: [] },
      ...[NaN, Infinity, 181, "1"].map((longitude) => ({
        type: "Polygon",
        coordinates: [
          [
            [longitude, 0],
            [2, 0],
            [2, 2],
            [longitude, 0],
          ],
        ],
      })),
      {
        type: "Polygon",
        coordinates: [
          [
            [0, 91],
            [2, 0],
            [2, 2],
            [0, 91],
          ],
        ],
      },
    ]) {
      assert.throws(
        () => validateBoundary(value),
        InvalidLocalityBoundaryError,
      );
    }
  });

  it("rejects malformed or oversized result lists without guessing", () => {
    for (const response of [
      null,
      {},
      Array.from({ length: 11 }, () => candidate()),
    ]) {
      assert.throws(
        () => selectLocalityBoundary(response, locality),
        InvalidLocalityBoundaryError,
      );
    }
  });
});
