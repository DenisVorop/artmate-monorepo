import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { MarkerColorDTO } from "../src/colorings/dto";
import {
  artmateMarkerColors,
  assertMarkerColorCatalog,
} from "../src/colorings/marker-colors.data";
import { MarkerColorsService } from "../src/colorings/marker-colors.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("MarkerColorsService", () => {
  it("returns the bounded catalog in palette order", async () => {
    const calls: unknown[] = [];
    const fixture = artmateMarkerColors.slice(0, 2).map((color) => ({
      id: `marker-color-${String(color.colorNumber).padStart(3, "0")}`,
      ...color,
    }));
    const service = new MarkerColorsService({
      markerColor: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return fixture;
        },
      },
    } as unknown as PrismaService);

    const result = await service.getMarkerColors();

    assert.deepEqual(result, fixture);
    assert.deepEqual(calls, [
      {
        select: {
          id: true,
          colorNumber: true,
          pantone: true,
          hex: true,
          catalogPosition: true,
          markerNumber: true,
        },
        orderBy: { catalogPosition: "asc" },
      },
    ]);
    assert.deepEqual(
      validateSync(plainToInstance(MarkerColorDTO, result[0])),
      [],
    );
  });

  it("keeps the checked-in catalog valid", () => {
    assert.doesNotThrow(() => assertMarkerColorCatalog());
    assert.throws(() =>
      assertMarkerColorCatalog([
        ...artmateMarkerColors.slice(0, -1),
        { ...artmateMarkerColors.at(-1)!, markerNumber: "027" },
      ]),
    );
  });
});
