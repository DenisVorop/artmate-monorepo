import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { artmateMarkerColors } from "../src/colorings/marker-colors.data";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260830120000_add_marker_colors/migration.sql",
);

describe("Marker colors migration", () => {
  it("seeds the exact normalized Artmate 168 catalog", async () => {
    const db = new PGlite();

    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      const stored = await db.query<{
        id: string;
        colorNumber: number;
        hex: string;
        markerNumber: string;
        pantone: string;
        catalogPosition: number;
      }>(`
        SELECT
          "id",
          "color_number" AS "colorNumber",
          "pantone",
          "hex",
          "catalog_position" AS "catalogPosition",
          "marker_number" AS "markerNumber"
        FROM "marker_colors"
        ORDER BY "catalog_position"
      `);

      assert.deepEqual(
        stored.rows,
        artmateMarkerColors.map((color) => ({
          id: `marker-color-${String(color.colorNumber).padStart(3, "0")}`,
          ...color,
        })),
      );
      assert.equal(
        stored.rows.filter(({ markerNumber }) => markerNumber.startsWith("0"))
          .length,
        14,
      );

      const checksum = createHash("sha256")
        .update(
          stored.rows
            .map(
              ({ catalogPosition, colorNumber, hex, markerNumber, pantone }) =>
                `${colorNumber}|${pantone}|${hex.slice(1)}|${catalogPosition}|${markerNumber}\n`,
            )
            .join(""),
        )
        .digest("hex");

      assert.equal(
        checksum,
        "79b135ade6f62a4a206902d7e1eccd9c5660953b8beed93daf5866c635439854",
      );
      assert.deepEqual(stored.rows[100], {
        id: "marker-color-196",
        colorNumber: 196,
        pantone: "248U",
        hex: "#A14F8C",
        catalogPosition: 101,
        markerNumber: "249",
      });
      assert.deepEqual(stored.rows[151], {
        id: "marker-color-061",
        colorNumber: 61,
        pantone: "2304C",
        hex: "#A0AB4D",
        catalogPosition: 152,
        markerNumber: "241",
      });
      assert.deepEqual(stored.rows[157], {
        id: "marker-color-173",
        colorNumber: 173,
        pantone: "5595C",
        hex: "#BFCEC2",
        catalogPosition: 158,
        markerNumber: "027",
      });
    } finally {
      await db.close();
    }
  });

  it("enforces identifiers, ranges and catalog uniqueness", async () => {
    const db = new PGlite();

    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(
        `DELETE FROM "marker_colors" WHERE "catalog_position" = 168`,
      );

      await rejectsConstraint(
        db,
        insertMarker({ id: "invalid", catalogPosition: 168 }),
      );
      await rejectsConstraint(
        db,
        insertMarker({ colorNumber: 0, catalogPosition: 168 }),
      );
      await rejectsConstraint(
        db,
        insertMarker({ colorNumber: 1000, catalogPosition: 168 }),
      );
      await rejectsConstraint(
        db,
        insertMarker({ pantone: " ", catalogPosition: 168 }),
      );

      await rejectsConstraint(
        db,
        insertMarker({
          id: "marker-color-999",
          markerNumber: "99",
          catalogPosition: 168,
        }),
      );
      await rejectsConstraint(
        db,
        insertMarker({
          id: "marker-color-999",
          hex: "#GGGGGG",
          catalogPosition: 168,
        }),
      );
      await rejectsConstraint(
        db,
        insertMarker({
          id: "marker-color-999",
          markerNumber: "006",
          catalogPosition: 168,
        }),
      );
      await rejectsConstraint(
        db,
        insertMarker({ id: "marker-color-999", catalogPosition: 1 }),
      );
      await rejectsConstraint(
        db,
        insertMarker({
          id: "marker-color-999",
          colorNumber: 104,
          catalogPosition: 168,
        }),
      );

      const allowedDuplicates = await db.query<{
        hex: string;
        markerNumbers: string[];
      }>(`
        SELECT
          "hex",
          array_agg("marker_number" ORDER BY "marker_number") AS "markerNumbers"
        FROM "marker_colors"
        GROUP BY "hex"
        HAVING count(*) > 1
        ORDER BY "hex"
      `);

      assert.deepEqual(allowedDuplicates.rows, [
        { hex: "#DAAB9C", markerNumbers: ["065", "751"] },
        { hex: "#FFB7AE", markerNumbers: ["168", "488"] },
        { hex: "#FFDDE2", markerNumbers: ["075", "704"] },
      ]);
    } finally {
      await db.close();
    }
  });
});

async function rejectsConstraint(db: PGlite, sql: string) {
  await assert.rejects(db.exec(sql));
}

function insertMarker(
  overrides: Partial<{
    colorNumber: number;
    hex: string;
    id: string;
    markerNumber: string;
    pantone: string;
    catalogPosition: number;
  }> = {},
) {
  return `
    INSERT INTO "marker_colors" (
      "id", "color_number", "pantone", "hex", "catalog_position", "marker_number"
    ) VALUES (
      '${overrides.id ?? "marker-color-999"}',
      ${overrides.colorNumber ?? 999},
      '${overrides.pantone ?? "Test U"}',
      '${overrides.hex ?? "#ABCDEF"}',
      ${overrides.catalogPosition ?? 168},
      '${overrides.markerNumber ?? "999"}'
    )
  `;
}
