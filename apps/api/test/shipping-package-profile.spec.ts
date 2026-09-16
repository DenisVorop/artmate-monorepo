import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import {
  createShippingPackageSnapshot,
  parseShippingPackageProfile,
  parseShippingPackageSnapshot,
  type ShippingPackageProfile,
} from "../src/products/shipping-package-profile";

const markers: ShippingPackageProfile = {
  id: "shipping_markers",
  code: "markers",
  weightGrams: 2600,
  lengthCm: 31,
  widthCm: 16,
  heightCm: 11,
};

describe("Shipping package profile validation", () => {
  it("keeps confirmed marker dimensions and copies only logistics fields", () => {
    const input = { ...markers, title: "ignored", characteristics: [] };
    const result = parseShippingPackageProfile(input);
    assert.deepEqual(result, markers);
    assert.notEqual(result, input);
    input.weightGrams = 1;
    assert.equal(result.weightGrams, 2600);
  });

  it("does not change album settings supplied by the caller", () => {
    for (const dimensions of [
      { weightGrams: 400, lengthCm: 40, widthCm: 30, heightCm: 1 },
      { weightGrams: 570, lengthCm: 36, widthCm: 27, heightCm: 2 },
    ]) {
      const album = { id: "shipping_album", code: "album", ...dimensions };
      assert.deepEqual(parseShippingPackageProfile(album), album);
    }
  });

  it("rejects missing/partial profiles rather than inventing album defaults", () => {
    for (const input of [undefined, null, {}, [], "album", 0]) {
      assert.throws(
        () => parseShippingPackageProfile(input),
        BadRequestException,
      );
    }
  });

  for (const field of [
    "weightGrams",
    "lengthCm",
    "widthCm",
    "heightCm",
  ] as const) {
    it(`rejects malformed ${field} without coercing or rounding`, () => {
      for (const invalid of [
        undefined,
        null,
        0,
        -1,
        1.2,
        NaN,
        Infinity,
        -Infinity,
        "31",
        "2.6kg",
        true,
        {},
        2_147_483_648,
      ]) {
        assert.throws(
          () => parseShippingPackageProfile({ ...markers, [field]: invalid }),
          (error: unknown) => {
            assert(error instanceof BadRequestException);
            assert.deepEqual(error.getResponse(), {
              code: "SHIPPING_PACKAGE_PROFILE_INVALID",
              message: "Некорректные параметры упаковки товара.",
              field,
            });
            return true;
          },
        );
      }
    });
  }

  it("rejects malformed profile identifiers", () => {
    for (const id of [
      undefined,
      null,
      "",
      " ",
      " markers",
      "x".repeat(33),
      1,
    ]) {
      assert.throws(
        () => parseShippingPackageProfile({ ...markers, id }),
        BadRequestException,
      );
    }
    for (const code of [
      undefined,
      null,
      "",
      "Markers",
      " marker",
      "markers\n",
      "<b>",
      "x".repeat(65),
      1,
    ]) {
      assert.throws(
        () => parseShippingPackageProfile({ ...markers, code }),
        BadRequestException,
      );
    }
  });
});

describe("Shipping package snapshot validation", () => {
  it("adds a version and copies confirmed dimensions through JSON roundtrip", () => {
    const input = { ...markers };
    const snapshot = createShippingPackageSnapshot(input);
    assert.deepEqual(snapshot, { ...markers, version: 1 });
    input.weightGrams = 1;
    assert.equal(snapshot.weightGrams, 2600);
    const result = parseShippingPackageSnapshot(
      JSON.parse(JSON.stringify({ ...snapshot, ignored: "extra" })),
    );
    assert.deepEqual(result, snapshot);
    assert.notEqual(result, snapshot);
  });

  it("rejects missing and unsupported snapshot versions", () => {
    for (const input of [
      undefined,
      null,
      [],
      markers,
      ...[null, 0, 2, "1"].map((version) => ({ ...markers, version })),
    ]) {
      assert.throws(
        () => parseShippingPackageSnapshot(input),
        (error: unknown) => {
          assert(error instanceof BadRequestException);
          assert.equal(
            (error.getResponse() as { code: string }).code,
            "SHIPPING_PACKAGE_SNAPSHOT_INVALID",
          );
          return true;
        },
      );
    }
  });

  it("validates dimensions even when the snapshot version is supported", () => {
    assert.throws(
      () =>
        parseShippingPackageSnapshot({
          ...markers,
          version: 1,
          weightGrams: "2600",
        }),
      BadRequestException,
    );
  });
});
