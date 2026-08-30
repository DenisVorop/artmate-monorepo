import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260830190000_allow_coloring_derivative_profile_v2/migration.sql",
);

describe("Coloring derivative profile v2 migration", () => {
  it("preserves historical v1 revisions and accepts new v2 revisions", async () => {
    const db = await createLegacyDatabase();

    try {
      await db.exec(`
        INSERT INTO "coloring_revisions" (
          "id", "derivative_profile", "color_space"
        ) VALUES ('revision-v1', 'webp-preview-v1', 'srgb');
      `);
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(`
        INSERT INTO "coloring_revisions" (
          "id", "derivative_profile", "color_space"
        ) VALUES ('revision-v2', 'webp-preview-v2', 'srgb');
      `);

      const revisions = await db.query<{
        colorSpace: string;
        derivativeProfile: string;
        id: string;
      }>(`
        SELECT
          "id",
          "derivative_profile" AS "derivativeProfile",
          "color_space" AS "colorSpace"
        FROM "coloring_revisions"
        ORDER BY "id"
      `);

      assert.deepEqual(revisions.rows, [
        {
          colorSpace: "srgb",
          derivativeProfile: "webp-preview-v1",
          id: "revision-v1",
        },
        {
          colorSpace: "srgb",
          derivativeProfile: "webp-preview-v2",
          id: "revision-v2",
        },
      ]);
    } finally {
      await db.close();
    }
  });

  it("continues to reject unknown profiles and non-sRGB derivatives", async () => {
    const db = await createLegacyDatabase();

    try {
      await db.exec(await readFile(migrationPath, "utf8"));

      await rejectsConstraint(
        db,
        insertRevision("revision-v3", "webp-preview-v3", "srgb"),
      );
      await rejectsConstraint(
        db,
        insertRevision("revision-p3", "webp-preview-v2", "display-p3"),
      );
    } finally {
      await db.close();
    }
  });
});

async function createLegacyDatabase() {
  const db = new PGlite();

  await db.exec(`
    CREATE TABLE "coloring_revisions" (
      "id" VARCHAR(32) PRIMARY KEY,
      "derivative_profile" VARCHAR(40) NOT NULL,
      "color_space" VARCHAR(20) NOT NULL,
      CONSTRAINT "coloring_revisions_profile_check" CHECK (
        "derivative_profile" = 'webp-preview-v1'
        AND "color_space" = 'srgb'
      )
    );
  `);

  return db;
}

async function rejectsConstraint(db: PGlite, sql: string) {
  await assert.rejects(db.exec(sql));
}

function insertRevision(
  id: string,
  derivativeProfile: string,
  colorSpace: string,
) {
  return `
    INSERT INTO "coloring_revisions" (
      "id", "derivative_profile", "color_space"
    ) VALUES ('${id}', '${derivativeProfile}', '${colorSpace}')
  `;
}
