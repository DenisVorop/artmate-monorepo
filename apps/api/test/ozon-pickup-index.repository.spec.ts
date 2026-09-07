import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client";
import {
  LostOzonPickupIndexLeaseError,
  OzonPickupIndexIntegrityError,
  OzonPickupIndexRepository,
  ozonPickupIndexErrorMaxLength,
} from "../src/ozon/ozon-pickup-index.repository";

const now = new Date("2026-09-07T12:00:00.000Z");
describe("OzonPickupIndexRepository", () => {
  it("prunes at most one expired generation while protecting the current snapshot and active builders", async () => {
    const queries: unknown[] = [];
    const deletes: unknown[] = [];
    const operations: string[] = [];
    const tx = {
      $executeRaw: async () => {
        operations.push("lock");
        return 1;
      },
      $queryRaw: async () => [{ now }],
      ozonPickupIndexGeneration: {
        findFirst: async (args: unknown) => {
          queries.push(args);
          return queries.length === 1 ? { id: "current" } : { id: "expired" };
        },
        deleteMany: async (args: unknown) => {
          deletes.push(args);
          return { count: 1 };
        },
      },
    };
    const repository = new OzonPickupIndexRepository({
      $transaction: async (callback: (tx: unknown) => unknown) => callback(tx),
    } as never);
    assert.equal(await repository.pruneExpiredGeneration(), 1);
    assert.deepEqual(operations, ["lock"]);
    const cutoff = new Date("2026-08-08T12:00:00.000Z");
    const expired = {
      id: { not: "current" },
      status: { in: ["FAILED", "READY", "PUBLISHED"] },
      heartbeatAt: { lt: cutoff },
      OR: [{ publishedAt: null }, { publishedAt: { lt: cutoff } }],
    };
    assert.deepEqual(queries[1], {
      where: expired,
      orderBy: { sequence: "asc" },
      select: { id: true },
    });
    assert.deepEqual(deletes, [
      { where: { AND: [expired, { id: "expired" }] } },
    ]);
  });

  it("does not delete anything when no expired generation remains", async () => {
    const repository = new OzonPickupIndexRepository({
      $transaction: async (callback: (tx: unknown) => unknown) =>
        callback({
          $executeRaw: async () => 1,
          $queryRaw: async () => [{ now }],
          ozonPickupIndexGeneration: {
            findFirst: async () => null,
            deleteMany: async () => {
              throw new Error("Must not delete");
            },
          },
        }),
    } as never);
    assert.equal(await repository.pruneExpiredGeneration(), 0);
  });

  it("escapes literal city prefixes and bounds suggestions without limiting locality points", async () => {
    let args: unknown;
    const repository = new OzonPickupIndexRepository({
      ozonLocality: {
        findMany: async (value: unknown) => {
          args = value;
          return [];
        },
      },
    } as never);
    await repository.findPublishedLocalities("published", "а%_\\");
    assert.deepEqual(args, {
      where: {
        countryCode: "RU",
        nameNormalized: { startsWith: "а\\%\\_\\\\" },
        pickupPoints: { some: { generationId: "published" } },
      },
      take: 30,
      orderBy: [{ name: "asc" }, { region: "asc" }, { id: "asc" }],
      select: { id: true, name: true, region: true, countryCode: true },
    });
  });

  it("selects and returns only the latest published generation", async () => {
    let args: unknown;
    const published = {
      id: "published-2",
      publishedAt: new Date("2026-09-07T10:00:00.000Z"),
      sourcePointCount: 120,
    };
    const repository = createRepository({
      generation: {
        findFirst: (value: unknown) => {
          args = value;
          return published;
        },
      },
    });

    assert.deepEqual(await repository.getLatestPublished(), published);
    assert.deepEqual(args, {
      orderBy: [{ sequence: "desc" }, { id: "desc" }],
      select: { id: true, publishedAt: true, sourcePointCount: true },
      where: { status: "PUBLISHED" },
    });
  });

  it("recovers a stale global builder using the validated database clock", async () => {
    let args: unknown;
    const repository = createRepository({
      transaction: createTransaction({
        clock: () => [{ now }],
        generationUpdateMany: (value) => {
          args = value;
          return { count: 1 };
        },
      }),
    });

    assert.equal(await repository.recoverStaleBuilder(), true);
    assert.deepEqual(args, {
      data: {
        heartbeatAt: now,
        lastError: "Recovered stale Ozon pickup-index builder lease",
        leaseSlot: null,
        status: "FAILED",
      },
      where: {
        heartbeatAt: { lte: new Date("2026-09-07T11:45:00.000Z") },
        leaseSlot: "global",
        status: "BUILDING",
      },
    });
  });

  it("returns null only for P2002 builder contention and rethrows other errors", async () => {
    const contention = new Prisma.PrismaClientKnownRequestError("conflict", {
      clientVersion: "7.8.0",
      code: "P2002",
    });
    const fatal = new Error("database unavailable");
    const contended = createRepository({
      generation: { create: () => Promise.reject(contention) },
    });
    const broken = createRepository({
      generation: { create: () => Promise.reject(fatal) },
    });

    assert.equal(await contended.tryCreateBuilding(), null);
    await assert.rejects(
      broken.tryCreateBuilding(),
      (error) => error === fatal,
    );
  });

  it("creates a global BUILDING generation using database defaults", async () => {
    let args: unknown;
    const repository = createRepository({
      generation: {
        create: (value: unknown) => {
          args = value;
          return { id: "building-1", startedAt: now };
        },
      },
    });

    assert.deepEqual(await repository.tryCreateBuilding(), {
      id: "building-1",
      startedAt: now,
    });
    assert.deepEqual(args, {
      data: { leaseSlot: "global" },
      select: { id: true, startedAt: true },
    });
  });

  it("heartbeats only the fenced global BUILDING generation", async () => {
    const calls: unknown[] = [];
    const repository = createRepository({
      transaction: createTransaction({
        clock: () => [{ now }],
        generationUpdateMany: (args: unknown) => {
          calls.push(args);
          return { count: calls.length === 1 ? 1 : 0 };
        },
      }),
    });

    assert.equal(await repository.heartbeat("building-1"), true);
    assert.equal(await repository.heartbeat("lost"), false);
    assert.deepEqual(calls[0], {
      data: { heartbeatAt: now },
      where: { id: "building-1", leaseSlot: "global", status: "BUILDING" },
    });
  });

  it("locks the exact generation before locality and snapshot writes", async () => {
    const operations: string[] = [];
    const localityUpserts: unknown[] = [];
    let snapshots: unknown;
    const repository = createRepository({
      transaction: createTransaction({
        lock: (query) => {
          operations.push("lock");
          assert.deepEqual((query as { values: unknown[] }).values, [
            "building-1",
          ]);
          return [
            { id: "building-1", leaseSlot: "global", status: "building" },
          ];
        },
        localityUpsert: (args) => {
          operations.push("locality");
          localityUpserts.push(args);
          return { id: `locality-${localityUpserts.length}` };
        },
        snapshotCreateMany: (args) => {
          operations.push("snapshots");
          snapshots = args;
          return { count: 2 };
        },
      }),
    });

    await repository.appendSnapshots("building-1", [
      createPoint({ mapPointId: "point-1" }),
      createPoint({
        city: "  ЁЛКИ\t Сити ",
        latitude: -90,
        longitude: 180,
        mapPointId: "point-2",
        region: "  КРАЙ  ",
      }),
    ]);

    assert.deepEqual(operations, ["lock", "locality", "locality", "snapshots"]);
    assert.deepEqual(localityUpserts[1], {
      create: {
        countryCode: "RU",
        name: "ЁЛКИ Сити",
        nameNormalized: "елки сити",
        region: "КРАЙ",
        regionNormalized: "край",
      },
      select: { id: true },
      update: {},
      where: {
        countryCode_regionNormalized_nameNormalized: {
          countryCode: "RU",
          nameNormalized: "елки сити",
          regionNormalized: "край",
        },
      },
    });
    assert.deepEqual(snapshots, {
      data: [
        {
          address: "Москва, Тверская, 1",
          generationId: "building-1",
          latitude: 55.75,
          localityId: "locality-1",
          longitude: 37.61,
          mapPointId: "point-1",
          title: "Ozon ПВЗ",
          workHours: "09:00-21:00",
        },
        {
          address: "Москва, Тверская, 1",
          generationId: "building-1",
          latitude: -90,
          localityId: "locality-2",
          longitude: 180,
          mapPointId: "point-2",
          title: "Ozon ПВЗ",
          workHours: "09:00-21:00",
        },
      ],
    });
  });

  it("fences an empty batch and prevents every write after lease loss", async () => {
    for (const lockResult of [
      [],
      [{ id: "building-1", leaseSlot: null, status: "failed" }],
    ]) {
      let writes = 0;
      const repository = createRepository({
        transaction: createTransaction({
          lock: () => lockResult,
          localityUpsert: () => {
            writes += 1;
            return { id: "unexpected" };
          },
          snapshotCreateMany: () => {
            writes += 1;
            return { count: 0 };
          },
        }),
      });

      await assert.rejects(
        repository.appendSnapshots("building-1", []),
        LostOzonPickupIndexLeaseError,
      );
      assert.equal(writes, 0);
    }
  });

  it("treats an owned empty batch as a no-op only after fencing", async () => {
    const operations: string[] = [];
    const repository = createRepository({
      transaction: createTransaction({
        clock: () => [{ now }],
        lock: () => {
          operations.push("lock");
          return [
            { id: "building-1", leaseSlot: "global", status: "building" },
          ];
        },
        localityUpsert: () => {
          operations.push("locality");
          return { id: "unexpected" };
        },
        snapshotCreateMany: () => {
          operations.push("snapshots");
          return { count: 0 };
        },
      }),
    });

    await repository.appendSnapshots("building-1", []);

    assert.deepEqual(operations, ["lock"]);
  });

  it("runtime-validates bounded fields and finite coordinate ranges after fencing", async () => {
    let writes = 0;
    const repository = createRepository({
      transaction: createTransaction({
        lock: () => [
          { id: "building-1", leaseSlot: "global", status: "building" },
        ],
        localityUpsert: () => {
          writes += 1;
          return { id: "unexpected" };
        },
      }),
    });

    await assert.rejects(
      repository.appendSnapshots("building-1", [
        createPoint({ latitude: Number.NaN }),
      ]),
      OzonPickupIndexIntegrityError,
    );
    await assert.rejects(
      repository.appendSnapshots("building-1", [
        createPoint({ mapPointId: "x".repeat(161) }),
      ]),
      OzonPickupIndexIntegrityError,
    );
    assert.equal(writes, 0);
  });

  it("atomically verifies counters and actual snapshots before marking READY", async () => {
    const operations: string[] = [];
    let updateArgs: unknown;
    const repository = createRepository({
      transaction: createTransaction({
        clock: () => [{ now }],
        lock: () => {
          operations.push("lock");
          return [
            { id: "building-1", leaseSlot: "global", status: "building" },
          ];
        },
        snapshotCount: (args) => {
          operations.push("count");
          assert.deepEqual(args, { where: { generationId: "building-1" } });
          return 8;
        },
        generationUpdateMany: (args) => {
          operations.push("ready");
          updateArgs = args;
          return { count: 1 };
        },
      }),
    });

    await repository.markReady("building-1", {
      eligible: 8,
      excluded: 2,
      source: 10,
    });

    assert.deepEqual(operations, ["lock", "count", "ready"]);
    assert.deepEqual(updateArgs, {
      data: {
        eligiblePointCount: 8,
        excludedPointCount: 2,
        heartbeatAt: now,
        lastError: null,
        leaseSlot: null,
        readyAt: now,
        sourcePointCount: 10,
        status: "READY",
      },
      where: { id: "building-1", leaseSlot: "global", status: "BUILDING" },
    });
  });

  it("leaves the generation BUILDING when counters or actual snapshot count mismatch", async () => {
    for (const counters of [
      { eligible: 8, excluded: 1, source: 10 },
      { eligible: 8, excluded: 2, source: 10 },
    ]) {
      let readyWrites = 0;
      const repository = createRepository({
        transaction: createTransaction({
          clock: () => [{ now }],
          lock: () => [
            { id: "building-1", leaseSlot: "global", status: "building" },
          ],
          snapshotCount: () => (counters.excluded === 1 ? 8 : 7),
          generationUpdateMany: () => {
            readyWrites += 1;
            return { count: 1 };
          },
        }),
      });

      await assert.rejects(
        repository.markReady("building-1", counters),
        OzonPickupIndexIntegrityError,
      );
      assert.equal(readyWrites, 0);
    }
  });

  it("publishes a READY target when only older generations exist", async () => {
    const operations: string[] = [];
    const updates: unknown[] = [];
    const repository = createRepository({
      transaction: createTransaction({
        advisoryLock: () => operations.push("advisory-lock"),
        targetLock: () => {
          operations.push("target-lock");
          return [{ id: "generation-b", now, sequence: 2n }];
        },
        newerGeneration: () => {
          operations.push("newer-guard");
          return null;
        },
        generationUpdateMany: (args) => {
          operations.push("publish");
          updates.push(args);
          return { count: 1 };
        },
      }),
    });

    assert.equal(await repository.publishReady("generation-b"), true);
    assert.deepEqual(operations, [
      "advisory-lock",
      "target-lock",
      "newer-guard",
      "publish",
    ]);
    assert.deepEqual(updates[0], {
      data: { publishedAt: now, status: "PUBLISHED" },
      where: { id: "generation-b", status: "READY" },
    });
  });

  it("supersedes an older READY target when a newer READY or PUBLISHED generation exists", async () => {
    for (const newerStatus of ["READY", "PUBLISHED"] as const) {
      let updateArgs: unknown;
      const repository = createRepository({
        transaction: createTransaction({
          advisoryLock: () => undefined,
          targetLock: () => [{ id: "generation-a", now, sequence: 1n }],
          newerGeneration: (args) => {
            assert.deepEqual(args, {
              select: { id: true },
              where: {
                sequence: { gt: 1n },
                status: { in: ["READY", "PUBLISHED"] },
              },
            });
            return { id: `newer-${newerStatus}` };
          },
          generationUpdateMany: (args) => {
            updateArgs = args;
            return { count: 1 };
          },
        }),
      });

      assert.equal(await repository.publishReady("generation-a"), false);
      assert.deepEqual(updateArgs, {
        data: {
          lastError: "Superseded by a newer Ozon pickup-index generation",
          status: "FAILED",
        },
        where: { id: "generation-a", status: "READY" },
      });
    }
  });

  it("does not publish or supersede a target that is no longer READY", async () => {
    let guarded = false;
    let updated = false;
    const repository = createRepository({
      transaction: createTransaction({
        advisoryLock: () => undefined,
        targetLock: () => [],
        newerGeneration: () => {
          guarded = true;
          return null;
        },
        generationUpdateMany: () => {
          updated = true;
          return { count: 1 };
        },
      }),
    });

    assert.equal(await repository.publishReady("generation-a"), false);
    assert.equal(guarded, false);
    assert.equal(updated, false);
  });

  it("does not overwrite a late failure after ownership loss", async () => {
    let updateArgs: unknown;
    const repository = createRepository({
      transaction: createTransaction({
        clock: () => [{ now }],
        generationUpdateMany: (args) => {
          updateArgs = args;
          return { count: 0 };
        },
      }),
    });

    assert.equal(
      await repository.markFailedIfOwned("building-1", "late failure"),
      false,
    );
    assert.deepEqual(updateArgs, {
      data: {
        heartbeatAt: now,
        lastError: "late failure",
        leaseSlot: null,
        status: "FAILED",
      },
      where: { id: "building-1", leaseSlot: "global", status: "BUILDING" },
    });
  });

  it("redacts secrets, removes controls, collapses whitespace and bounds stored diagnostics", async () => {
    let args: { data: { lastError: string } } | undefined;
    const repository = createRepository({
      transaction: createTransaction({
        clock: () => [{ now }],
        generationUpdateMany: (value: unknown) => {
          args = value as typeof args;
          return { count: 1 };
        },
      }),
    });

    const secrets = [
      "bearer-secret",
      "access-secret",
      "refresh-secret",
      "client-secret",
      "quoted-password-secret",
      "token-secret",
      "api-key-secret",
      "json-secret",
    ];

    assert.equal(
      await repository.markFailedIfOwned(
        "building-1",
        new Error(
          `Authorization: Bearer ${secrets[0]}\n` +
            `access_token=${secrets[1]} refresh-token: ${secrets[2]} ` +
            `clientSecret=${secrets[3]} password: "first ${secrets[4]}" ` +
            `token=${secrets[5]} api_key: ${secrets[6]},\u0000\u0080\n\t` +
            `{"accessToken":"${secrets[7]}"} ` +
            "x".repeat(2_000),
        ),
      ),
      true,
    );

    assert.ok(args);
    assert.equal(args.data.lastError.length, ozonPickupIndexErrorMaxLength);
    assert.doesNotMatch(args.data.lastError, /\p{Cc}/u);
    for (const secret of secrets) {
      assert.equal(args.data.lastError.includes(secret), false);
    }
    assert.match(args.data.lastError, /Bearer \[REDACTED\]/u);
    assert.match(args.data.lastError, /access_token=\[REDACTED\]/u);
    assert.equal(args.data.lastError.includes("Error:"), false);
  });

  it("rejects malformed database clock results before lifecycle writes", async () => {
    for (const clockResult of [
      [],
      [{ now }, { now }],
      [{ now: "2026-09-07T12:00:00.000Z" }],
      [{ now: new Date(Number.NaN) }],
    ]) {
      let writes = 0;
      const repository = createRepository({
        transaction: createTransaction({
          clock: () => clockResult,
          generationUpdateMany: () => {
            writes += 1;
            return { count: 1 };
          },
        }),
      });

      await assert.rejects(
        repository.heartbeat("building-1"),
        OzonPickupIndexIntegrityError,
      );
      assert.equal(writes, 0);
    }
  });
});

type GenerationOverrides = {
  create?: (args: unknown) => unknown;
  findFirst?: (args: unknown) => unknown;
  updateMany?: (args: unknown) => unknown;
};

function createRepository(options: {
  generation?: GenerationOverrides;
  transaction?: ReturnType<typeof createTransaction>;
}) {
  const generation = {
    create: options.generation?.create ?? (() => undefined),
    findFirst: options.generation?.findFirst ?? (() => null),
    updateMany: options.generation?.updateMany ?? (() => ({ count: 0 })),
  };
  const transaction = options.transaction ?? createTransaction({});
  const prisma = {
    ozonPickupIndexGeneration: generation,
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback(transaction),
  };

  return new OzonPickupIndexRepository(prisma as never);
}

function createTransaction(overrides: {
  advisoryLock?: (query: unknown) => unknown;
  clock?: (query: unknown) => unknown;
  generationUpdateMany?: (args: unknown) => unknown;
  localityUpsert?: (args: unknown) => unknown;
  lock?: (query: unknown) => unknown;
  newerGeneration?: (args: unknown) => unknown;
  snapshotCount?: (args: unknown) => unknown;
  snapshotCreateMany?: (args: unknown) => unknown;
  targetLock?: (query: unknown) => unknown;
}) {
  return {
    $executeRaw: (query: unknown) => {
      const sql = (query as { strings?: readonly string[] }).strings?.join("");
      assert.ok(sql?.includes("pg_advisory_xact_lock"));
      return overrides.advisoryLock?.(query) ?? 1;
    },
    $queryRaw: (query: unknown) => {
      const sql = (query as { strings?: readonly string[] }).strings?.join("");
      if (sql?.includes("pg_advisory_xact_lock")) {
        throw new Error(
          "PrismaPg cannot deserialize PostgreSQL void via queryRaw",
        );
      }
      if (sql?.includes('"sequence"')) {
        return overrides.targetLock?.(query) ?? [];
      }
      if (sql?.includes("CURRENT_TIMESTAMP")) {
        return overrides.clock?.(query) ?? [];
      }
      return overrides.lock?.(query) ?? [];
    },
    ozonLocality: {
      upsert: (args: unknown) => overrides.localityUpsert?.(args),
    },
    ozonPickupIndexGeneration: {
      findFirst: (args: unknown) => overrides.newerGeneration?.(args) ?? null,
      updateMany: (args: unknown) =>
        overrides.generationUpdateMany?.(args) ?? { count: 0 },
    },
    ozonPickupPointSnapshot: {
      count: (args: unknown) => overrides.snapshotCount?.(args) ?? 0,
      createMany: (args: unknown) =>
        overrides.snapshotCreateMany?.(args) ?? { count: 0 },
    },
  };
}

function createPoint(
  overrides: Partial<{
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    mapPointId: string;
    region: string;
    title: string;
    workHours: string;
  }> = {},
) {
  return {
    address: "Москва, Тверская, 1",
    city: "Москва",
    latitude: 55.75,
    longitude: 37.61,
    mapPointId: "point-1",
    region: "Москва",
    title: "Ozon ПВЗ",
    workHours: "09:00-21:00",
    ...overrides,
  };
}
