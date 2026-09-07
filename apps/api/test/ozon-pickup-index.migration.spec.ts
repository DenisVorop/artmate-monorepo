import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260907170000_add_ozon_pickup_index/migration.sql",
);

describe("Ozon pickup index migration", () => {
  it("applies additively to empty and existing schemas", async () => {
    for (const hasExistingSchema of [false, true]) {
      const db = new PGlite();

      try {
        if (hasExistingSchema) {
          await db.exec(`
            CREATE TABLE "ozon_oauth_tokens" (
              "id" TEXT PRIMARY KEY,
              "access_token" TEXT NOT NULL
            );
            INSERT INTO "ozon_oauth_tokens" ("id", "access_token")
            VALUES ('existing-token', 'keep-me');
          `);
        }

        await applyMigration(db);

        const tables = await db.query<{ tableName: string }>(`
          SELECT table_name AS "tableName"
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name LIKE 'ozon_%'
          ORDER BY table_name
        `);
        assert.deepEqual(
          tables.rows.map(({ tableName }) => tableName),
          [
            ...(hasExistingSchema ? ["ozon_oauth_tokens"] : []),
            "ozon_localities",
            "ozon_pickup_index_generations",
            "ozon_pickup_point_snapshots",
          ].sort(),
        );

        if (hasExistingSchema) {
          const existing = await db.query<{ accessToken: string }>(`
            SELECT "access_token" AS "accessToken"
            FROM "ozon_oauth_tokens" WHERE "id" = 'existing-token'
          `);
          assert.deepEqual(existing.rows, [{ accessToken: "keep-me" }]);
        }
      } finally {
        await db.close();
      }
    }
  });

  it("allows one global builder lease and multiple completed NULL leases", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        ${insertGeneration("building", "global", "building")};
        ${insertGeneration("ready-1", null, "ready")};
        ${insertGeneration("ready-2", null, "published")};
      `);
      await assert.rejects(
        db.exec(insertGeneration("second-builder", "global", "building")),
        /ozon_pickup_index_generations_lease_slot_key/u,
      );
      await assert.rejects(
        db.exec(
          insertGeneration("builder-with-invalid-lease", "other", "building"),
        ),
        /ozon_pickup_index_generations_lease_slot_check/u,
      );
      await assert.rejects(
        db.exec(insertGeneration("builder-without-lease", null, "building")),
        /ozon_pickup_index_generations_lease_slot_check/u,
      );
      await db.exec(`
        DELETE FROM "ozon_pickup_index_generations" WHERE "id" = 'building'
      `);
      await assert.rejects(
        db.exec(insertGeneration("completed-with-lease", "global", "ready")),
        /ozon_pickup_index_generations_lease_slot_check/u,
      );

      const nullLeases = await db.query<{ count: number }>(`
        SELECT count(*)::int AS "count"
        FROM "ozon_pickup_index_generations"
        WHERE "lease_slot" IS NULL
      `);
      assert.equal(nullLeases.rows[0]?.count, 2);
    } finally {
      await db.close();
    }
  });

  it("rejects blank generation ids", async () => {
    const db = await createDatabase();

    try {
      await assert.rejects(
        db.exec(insertGeneration(" ")),
        /ozon_pickup_index_generations_id_nonblank_check/u,
      );
    } finally {
      await db.close();
    }
  });

  it("assigns an increasing unique sequence to every generation", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        ${insertGeneration("generation-b")};
        ${insertGeneration("generation-a")};
      `);
      const generations = await db.query<{ id: string; sequence: number }>(`
        SELECT "id", "sequence"
        FROM "ozon_pickup_index_generations"
        ORDER BY "sequence"
      `);

      assert.deepEqual(generations.rows, [
        { id: "generation-b", sequence: 1 },
        { id: "generation-a", sequence: 2 },
      ]);
      const sequenceColumn = await db.query<{
        dataType: string;
        defaultValue: string;
      }>(`
        SELECT data_type AS "dataType", column_default AS "defaultValue"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ozon_pickup_index_generations'
          AND column_name = 'sequence'
      `);
      assert.equal(sequenceColumn.rows[0]?.dataType, "bigint");
      assert.match(sequenceColumn.rows[0]?.defaultValue ?? "", /nextval/u);
      await assert.rejects(
        db.exec(`
          UPDATE "ozon_pickup_index_generations"
          SET "sequence" = 1
          WHERE "id" = 'generation-a'
        `),
        /ozon_pickup_index_generations_sequence_key/u,
      );
    } finally {
      await db.close();
    }
  });

  it("enforces lifecycle timestamps for every generation status", async () => {
    const db = await createDatabase();

    try {
      for (const [id, leaseSlot, status, overrides] of [
        ["building-ready", "global", "building", { readyAt: validReadyAt }],
        [
          "building-published",
          "global",
          "building",
          { publishedAt: validPublishedAt },
        ],
        ["ready-without-ready", null, "ready", { readyAt: null }],
        [
          "ready-with-published",
          null,
          "ready",
          { readyAt: validReadyAt, publishedAt: validPublishedAt },
        ],
        ["published-without-ready", null, "published", { readyAt: null }],
        [
          "published-without-published",
          null,
          "published",
          { publishedAt: null },
        ],
        ["failed-published", null, "failed", { publishedAt: validPublishedAt }],
      ] as const) {
        await assert.rejects(
          db.exec(insertGeneration(id, leaseSlot, status, overrides)),
          /ozon_pickup_index_generations_lifecycle_check/u,
        );
      }

      await db.exec(`
        ${insertGeneration("valid-building", "global", "building")};
        ${insertGeneration("valid-ready", null, "ready")};
        ${insertGeneration("valid-published", null, "published")};
        ${insertGeneration("valid-failed-before-ready", null, "failed")};
        ${insertGeneration("valid-failed-after-ready", null, "failed", {
          readyAt: validReadyAt,
          heartbeatAt: validPublishedAt,
        })};
      `);
    } finally {
      await db.close();
    }
  });

  it("rejects generation timestamps outside lifecycle order", async () => {
    const db = await createDatabase();

    try {
      for (const [id, status, overrides] of [
        ["heartbeat-before-start", "failed", { heartbeatAt: beforeStartAt }],
        ["ready-before-start", "ready", { readyAt: beforeStartAt }],
        [
          "ready-before-heartbeat",
          "ready",
          { heartbeatAt: validPublishedAt, readyAt: validReadyAt },
        ],
        ["published-before-ready", "published", { publishedAt: beforeReadyAt }],
      ] as const) {
        await assert.rejects(
          db.exec(insertGeneration(id, null, status, overrides)),
          /ozon_pickup_index_generations_timestamp_order_check/u,
        );
      }
    } finally {
      await db.close();
    }
  });

  it("rejects a published generation with heartbeat after ready", async () => {
    const db = await createDatabase();

    try {
      await assert.rejects(
        db.exec(
          insertGeneration(
            "published-heartbeat-after-ready",
            null,
            "published",
            {
              heartbeatAt: validPublishedAt,
              readyAt: validReadyAt,
              publishedAt: validPublishedAt,
            },
          ),
        ),
        /ozon_pickup_index_generations_timestamp_order_check/u,
      );
    } finally {
      await db.close();
    }
  });

  it("rejects invalid generation counters", async () => {
    const db = await createDatabase();

    try {
      for (const [id, status, overrides] of [
        ["negative-source", "failed", { sourcePointCount: -1 }],
        ["negative-eligible", "failed", { eligiblePointCount: -1 }],
        ["negative-excluded", "failed", { excludedPointCount: -1 }],
        [
          "building-over-source",
          "building",
          { sourcePointCount: 1, eligiblePointCount: 1, excludedPointCount: 1 },
        ],
        [
          "failed-over-source",
          "failed",
          { sourcePointCount: 1, eligiblePointCount: 1, excludedPointCount: 1 },
        ],
        [
          "ready-partial",
          "ready",
          { sourcePointCount: 2, eligiblePointCount: 1, excludedPointCount: 0 },
        ],
        [
          "published-partial",
          "published",
          { sourcePointCount: 2, eligiblePointCount: 1, excludedPointCount: 0 },
        ],
        [
          "ready-over-source",
          "ready",
          { sourcePointCount: 1, eligiblePointCount: 1, excludedPointCount: 1 },
        ],
        [
          "published-over-source",
          "published",
          { sourcePointCount: 1, eligiblePointCount: 1, excludedPointCount: 1 },
        ],
      ] as const) {
        await assert.rejects(
          db.exec(
            insertGeneration(
              id,
              status === "building" ? "global" : null,
              status,
              overrides,
            ),
          ),
          /ozon_pickup_index_generations_counts_check/u,
        );
      }
    } finally {
      await db.close();
    }
  });

  it("accepts partial in-progress counters and exact completed counters", async () => {
    const db = await createDatabase();

    try {
      await db.exec(
        insertGeneration("building-equality", "global", "building", {
          sourcePointCount: 2,
          eligiblePointCount: 1,
          excludedPointCount: 1,
        }),
      );
      await db.exec(`
        DELETE FROM "ozon_pickup_index_generations"
        WHERE "id" = 'building-equality'
      `);
      await db.exec(
        insertGeneration("building-partial", "global", "building", {
          sourcePointCount: 2,
          eligiblePointCount: 1,
          excludedPointCount: 0,
        }),
      );
      await db.exec(`
        ${insertGeneration("failed-equality", null, "failed", {
          sourcePointCount: 2,
          eligiblePointCount: 1,
          excludedPointCount: 1,
        })};
        ${insertGeneration("failed-partial", null, "failed", {
          sourcePointCount: 2,
          eligiblePointCount: 1,
          excludedPointCount: 0,
        })};
        ${insertGeneration("ready-equality", null, "ready", {
          sourcePointCount: 2,
          eligiblePointCount: 1,
          excludedPointCount: 1,
        })};
        ${insertGeneration("published-equality", null, "published", {
          sourcePointCount: 2,
          eligiblePointCount: 1,
          excludedPointCount: 1,
        })};
      `);
    } finally {
      await db.close();
    }
  });

  it("uniquely identifies a normalized locality within its country and region", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        ${insertLocality("moscow", "Москва", "Московская область")};
        ${insertLocality("other-moscow", "Москва", "Тульская область")};
      `);
      await assert.rejects(
        db.exec(insertLocality("duplicate", "МОСКВА", "Московская область")),
      );
    } finally {
      await db.close();
    }
  });

  it("rejects blank locality fields and malformed country codes", async () => {
    const db = await createDatabase();

    try {
      for (const [id, name, region, countryCode, overrides] of [
        [" ", "Москва", "Московская область", "RU", {}],
        ["blank-name", " ", "Московская область", "RU", {}],
        [
          "blank-region",
          "Москва",
          " ",
          "RU",
          { regionNormalized: "московская область" },
        ],
        [
          "blank-name-normalized",
          "Москва",
          "Московская область",
          "RU",
          { nameNormalized: " " },
        ],
        [
          "blank-region-normalized",
          "Москва",
          "Московская область",
          "RU",
          { regionNormalized: " " },
        ],
      ] as const) {
        await assert.rejects(
          db.exec(insertLocality(id, name, region, countryCode, overrides)),
          /ozon_localities_nonblank_check/u,
        );
      }

      for (const countryCode of ["ru", "R1", " R"]) {
        await assert.rejects(
          db.exec(
            insertLocality(
              `bad-country-${countryCode.replaceAll(" ", "space")}`,
              "Город",
              "Регион",
              countryCode,
            ),
          ),
          /ozon_localities_country_code_check/u,
        );
      }
    } finally {
      await db.close();
    }
  });

  it("scopes map point identity to a generation and cascades generation deletion", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        ${insertGeneration("generation-1", null, "published")};
        ${insertGeneration("generation-2", null, "ready")};
        ${insertLocality("moscow", "Москва", "Московская область")};
        ${insertSnapshot("generation-1", "point-1")};
        ${insertSnapshot("generation-2", "point-1")};
      `);
      await assert.rejects(db.exec(insertSnapshot("generation-1", "point-1")));

      await db.exec(`
        DELETE FROM "ozon_pickup_index_generations"
        WHERE "id" = 'generation-1'
      `);
      const snapshots = await db.query<{ generationId: string }>(`
        SELECT "generation_id" AS "generationId"
        FROM "ozon_pickup_point_snapshots"
      `);
      assert.deepEqual(snapshots.rows, [{ generationId: "generation-2" }]);
    } finally {
      await db.close();
    }
  });

  it("restricts deletion of a locality referenced by any snapshot", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        ${insertGeneration("generation-1", null, "published")};
        ${insertLocality("moscow", "Москва", "Московская область")};
        ${insertSnapshot("generation-1", "point-1")};
      `);
      await assert.rejects(
        db.exec(`DELETE FROM "ozon_localities" WHERE "id" = 'moscow'`),
      );
    } finally {
      await db.close();
    }
  });

  it("enforces bounded strings and coordinate ranges", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        ${insertGeneration("generation-1")};
        ${insertLocality("moscow", "Москва", "Московская область")};
      `);

      await assert.rejects(
        db.exec(insertLocality("country-too-long", "Город", "Регион", "RUS")),
      );
      await assert.rejects(
        db.exec(insertLocality("name-too-long", "x".repeat(161), "Регион")),
      );
      await assert.rejects(
        db.exec(insertSnapshot("generation-1", "x".repeat(161))),
      );
      await assert.rejects(
        db.exec(
          insertSnapshot("generation-1", "title-too-long", {
            title: "x".repeat(181),
          }),
        ),
      );
      await assert.rejects(
        db.exec(
          insertSnapshot("generation-1", "hours-too-long", {
            workHours: "x".repeat(121),
          }),
        ),
      );
      for (const [mapPointId, latitude, longitude] of [
        ["latitude-low", -90.000001, 37.6],
        ["latitude-high", 90.000001, 37.6],
        ["longitude-low", 55.7, -180.000001],
        ["longitude-high", 55.7, 180.000001],
      ] as const) {
        await assert.rejects(
          db.exec(
            insertSnapshot("generation-1", mapPointId, {
              latitude,
              longitude,
            }),
          ),
        );
      }

      await db.exec(
        insertSnapshot("generation-1", "boundary-point", {
          latitude: 90,
          longitude: -180,
        }),
      );
    } finally {
      await db.close();
    }
  });

  it("rejects blank pickup point fields", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        ${insertGeneration("generation-1")};
        ${insertLocality("moscow", "Москва", "Московская область")};
      `);

      for (const [generationId, mapPointId, overrides] of [
        [" ", "point-blank-generation", {}],
        ["generation-1", " ", {}],
        ["generation-1", "point-blank-locality", { localityId: " " }],
        ["generation-1", "point-blank-title", { title: " " }],
        ["generation-1", "point-blank-address", { address: " " }],
        ["generation-1", "point-blank-hours", { workHours: " " }],
      ] as const) {
        await assert.rejects(
          db.exec(insertSnapshot(generationId, mapPointId, overrides)),
          /ozon_pickup_point_snapshots_nonblank_check/u,
        );
      }
    } finally {
      await db.close();
    }
  });

  it("creates search, generation ordering and locality FK indexes", async () => {
    const db = await createDatabase();

    try {
      const indexes = await db.query<{ indexDef: string; indexName: string }>(`
        SELECT indexname AS "indexName", indexdef AS "indexDef"
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname IN (
          'ozon_localities_country_code_name_normalized_prefix_idx',
          'ozon_pickup_index_generations_status_sequence_id_idx',
          'ozon_pickup_point_snapshots_locality_id_idx'
        )
        ORDER BY indexname
      `);
      assert.equal(indexes.rows.length, 3);
      const prefixIndex = indexes.rows.find(({ indexName }) =>
        indexName.includes("localities"),
      );
      const publishedIndex = indexes.rows.find(({ indexName }) =>
        indexName.includes("generations"),
      );
      assert.match(prefixIndex?.indexDef ?? "", /varchar_pattern_ops/u);
      assert.match(
        publishedIndex?.indexDef ?? "",
        /\("?status"?, "?sequence"? DESC, "?id"? DESC\)/u,
      );
    } finally {
      await db.close();
    }
  });
});

async function applyMigration(db: PGlite) {
  await db.exec(await readFile(migrationPath, "utf8"));
}

async function createDatabase() {
  const db = new PGlite();
  await applyMigration(db);
  return db;
}

const startedAt = "2026-09-07 10:00:00";
const beforeStartAt = "2026-09-07 09:59:59";
const validReadyAt = "2026-09-07 10:01:00";
const beforeReadyAt = "2026-09-07 10:00:30";
const validPublishedAt = "2026-09-07 10:02:00";

type GenerationOverrides = Partial<{
  eligiblePointCount: number;
  excludedPointCount: number;
  heartbeatAt: string;
  publishedAt: string | null;
  readyAt: string | null;
  sourcePointCount: number;
}>;

function insertGeneration(
  id: string,
  leaseSlot: string | null = null,
  status = "ready",
  overrides: GenerationOverrides = {},
) {
  const isComplete = status === "ready" || status === "published";
  const readyAt =
    "readyAt" in overrides
      ? (overrides.readyAt ?? null)
      : isComplete
        ? validReadyAt
        : null;
  const publishedAt =
    "publishedAt" in overrides
      ? (overrides.publishedAt ?? null)
      : status === "published"
        ? validPublishedAt
        : null;
  const sourcePointCount = overrides.sourcePointCount ?? 2;
  const eligiblePointCount = overrides.eligiblePointCount ?? 1;
  const excludedPointCount =
    overrides.excludedPointCount ?? (isComplete ? 1 : 0);

  return `
    INSERT INTO "ozon_pickup_index_generations" (
      "id", "status", "lease_slot", "started_at", "heartbeat_at",
      "ready_at", "published_at", "source_point_count",
      "eligible_point_count", "excluded_point_count"
    ) VALUES (
      '${id}', '${status}', ${sqlString(leaseSlot)}, '${startedAt}',
      '${overrides.heartbeatAt ?? startedAt}', ${sqlString(readyAt)},
      ${sqlString(publishedAt)}, ${sourcePointCount}, ${eligiblePointCount},
      ${excludedPointCount}
    )
  `;
}

function insertLocality(
  id: string,
  name: string,
  region: string,
  countryCode = "RU",
  overrides: Partial<{
    nameNormalized: string;
    regionNormalized: string;
  }> = {},
) {
  return `
    INSERT INTO "ozon_localities" (
      "id", "country_code", "name", "region", "name_normalized", "region_normalized"
    ) VALUES (
      '${id}', '${countryCode}', '${name}', '${region}',
      '${overrides.nameNormalized ?? "москва"}',
      '${overrides.regionNormalized ?? region.toLowerCase()}'
    )
  `;
}

function insertSnapshot(
  generationId: string,
  mapPointId: string,
  overrides: Partial<{
    latitude: number;
    localityId: string;
    longitude: number;
    address: string;
    title: string;
    workHours: string;
  }> = {},
) {
  return `
    INSERT INTO "ozon_pickup_point_snapshots" (
      "generation_id", "map_point_id", "locality_id", "title", "address",
      "work_hours", "latitude", "longitude"
    ) VALUES (
      '${generationId}', '${mapPointId}', '${overrides.localityId ?? "moscow"}',
      '${overrides.title ?? "Пункт Ozon"}',
      '${overrides.address ?? "Москва, Тверская улица, 1"}',
      '${overrides.workHours ?? "Ежедневно 09:00-21:00"}',
      ${overrides.latitude ?? 55.75}, ${overrides.longitude ?? 37.61}
    )
  `;
}

function sqlString(value: string | null) {
  return value === null ? "NULL" : `'${value}'`;
}
