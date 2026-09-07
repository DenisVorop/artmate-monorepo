import { Injectable } from "@nestjs/common";

import {
  OzonPickupIndexGenerationStatus,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  deliveryPickupPointIdMaxLength,
  deliveryPickupPointTitleMaxLength,
  deliveryPickupPointWorkHoursMaxLength,
} from "../delivery/delivery.constants";
import {
  getOzonPickupBuilderLeaseCutoff,
  normalizeOzonLocalityValue,
  ozonPickupLocalityStaleTtlMs,
} from "./ozon-pickup-index.policy";

const builderLeaseSlot = "global";
const recoveredBuilderDiagnostic =
  "Recovered stale Ozon pickup-index builder lease";
const supersededGenerationDiagnostic =
  "Superseded by a newer Ozon pickup-index generation";
const publishAdvisoryLockId = 760_853_094_361_219_045n;

export const ozonPickupIndexErrorMaxLength = 1_000;

export type OzonPickupPublishedGeneration = {
  id: string;
  publishedAt: Date | null;
  sourcePointCount: number;
};

export type OzonPickupBuildingGeneration = {
  id: string;
  startedAt: Date;
};

export type OzonPickupEligibleSnapshot = {
  mapPointId: string;
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  title: string;
  address: string;
  workHours: string;
};

export type OzonPickupIndexCounters = {
  source: number;
  eligible: number;
  excluded: number;
};

export type OzonPickupIndexLocality = {
  id: string;
  name: string;
  region: string;
  countryCode: string;
};

export type OzonPickupIndexPoint = {
  id: string;
  title: string;
  address: string;
  workHours: string;
  latitude: number;
  longitude: number;
};

export interface OzonPickupIndexRepositoryPort {
  pruneExpiredGeneration(): Promise<number>;
  getDatabaseNow(): Promise<Date>;
  getLatestPublished(): Promise<OzonPickupPublishedGeneration | null>;
  recoverStaleBuilder(): Promise<boolean>;
  tryCreateBuilding(): Promise<OzonPickupBuildingGeneration | null>;
  heartbeat(id: string): Promise<boolean>;
  appendSnapshots(
    id: string,
    points: readonly OzonPickupEligibleSnapshot[],
  ): Promise<void>;
  markReady(id: string, counters: OzonPickupIndexCounters): Promise<void>;
  publishReady(id: string): Promise<boolean>;
  markFailedIfOwned(id: string, error: unknown): Promise<boolean>;
}

export class LostOzonPickupIndexLeaseError extends Error {
  constructor() {
    super("Ozon pickup-index builder lease was lost");
    this.name = "LostOzonPickupIndexLeaseError";
  }
}

export class OzonPickupIndexIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OzonPickupIndexIntegrityError";
  }
}

@Injectable()
export class OzonPickupIndexRepository implements OzonPickupIndexRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  getDatabaseNow() {
    return this.prisma.$transaction((tx) => getDatabaseNow(tx));
  }

  getLatestPublished() {
    return this.prisma.ozonPickupIndexGeneration.findFirst({
      where: { status: OzonPickupIndexGenerationStatus.PUBLISHED },
      orderBy: [{ sequence: "desc" }, { id: "desc" }],
      select: { id: true, publishedAt: true, sourcePointCount: true },
    });
  }

  findPublishedLocalities(generationId: string, normalizedPrefix: string) {
    return this.prisma.ozonLocality.findMany({
      where: {
        countryCode: "RU",
        nameNormalized: {
          startsWith: normalizedPrefix.replace(/[\\%_]/g, "\\$&"),
        },
        pickupPoints: { some: { generationId } },
      },
      take: 30,
      orderBy: [{ name: "asc" }, { region: "asc" }, { id: "asc" }],
      select: { id: true, name: true, region: true, countryCode: true },
    });
  }

  async pruneExpiredGeneration() {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(${publishAdvisoryLockId})`,
        );
        const now = await getDatabaseNow(tx);
        const cutoff = new Date(now.getTime() - ozonPickupLocalityStaleTtlMs);
        const latest = await tx.ozonPickupIndexGeneration.findFirst({
          where: { status: OzonPickupIndexGenerationStatus.PUBLISHED },
          orderBy: { sequence: "desc" },
          select: { id: true },
        });
        const expired: Prisma.OzonPickupIndexGenerationWhereInput = {
          status: {
            in: [
              OzonPickupIndexGenerationStatus.FAILED,
              OzonPickupIndexGenerationStatus.READY,
              OzonPickupIndexGenerationStatus.PUBLISHED,
            ],
          },
          ...(latest ? { id: { not: latest.id } } : {}),
          heartbeatAt: { lt: cutoff },
          OR: [{ publishedAt: null }, { publishedAt: { lt: cutoff } }],
        };
        const candidate = await tx.ozonPickupIndexGeneration.findFirst({
          where: expired,
          orderBy: { sequence: "asc" },
          select: { id: true },
        });
        if (!candidate) return 0;
        const deleted = await tx.ozonPickupIndexGeneration.deleteMany({
          where: { AND: [expired, { id: candidate.id }] },
        });
        return deleted.count;
      },
      { timeout: 60_000 },
    );
  }

  async findPublishedPickupPoints(
    generationId: string,
    localityId: string,
  ): Promise<OzonPickupIndexPoint[]> {
    const points = await this.prisma.ozonPickupPointSnapshot.findMany({
      where: { generationId, localityId },
      orderBy: [{ address: "asc" }, { mapPointId: "asc" }],
      select: {
        mapPointId: true,
        title: true,
        address: true,
        workHours: true,
        latitude: true,
        longitude: true,
      },
    });

    return points.map(({ mapPointId, ...point }) => ({
      id: mapPointId,
      ...point,
    }));
  }

  async recoverStaleBuilder() {
    return this.prisma.$transaction(async (tx) => {
      const now = await getDatabaseNow(tx);
      const result = await tx.ozonPickupIndexGeneration.updateMany({
        where: {
          status: OzonPickupIndexGenerationStatus.BUILDING,
          leaseSlot: builderLeaseSlot,
          heartbeatAt: { lte: getOzonPickupBuilderLeaseCutoff(now) },
        },
        data: {
          status: OzonPickupIndexGenerationStatus.FAILED,
          leaseSlot: null,
          heartbeatAt: now,
          lastError: recoveredBuilderDiagnostic,
        },
      });

      return result.count === 1;
    });
  }

  async tryCreateBuilding() {
    try {
      return await this.prisma.ozonPickupIndexGeneration.create({
        data: { leaseSlot: builderLeaseSlot },
        select: { id: true, startedAt: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }

      throw error;
    }
  }

  async heartbeat(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const now = await getDatabaseNow(tx);
      const result = await tx.ozonPickupIndexGeneration.updateMany({
        where: {
          id,
          status: OzonPickupIndexGenerationStatus.BUILDING,
          leaseSlot: builderLeaseSlot,
        },
        data: { heartbeatAt: now },
      });

      return result.count === 1;
    });
  }

  async appendSnapshots(
    id: string,
    points: readonly OzonPickupEligibleSnapshot[],
  ) {
    await this.prisma.$transaction(async (tx) => {
      await requireOwnedGeneration(tx, id);

      const preparedPoints = points.map(prepareSnapshot);
      const localities = new Map<
        string,
        {
          name: string;
          nameNormalized: string;
          region: string;
          regionNormalized: string;
        }
      >();

      for (const point of preparedPoints) {
        localities.set(point.localityKey, point.locality);
      }

      const localityIds = new Map<string, string>();

      for (const [key, locality] of localities) {
        const persisted = await tx.ozonLocality.upsert({
          where: {
            countryCode_regionNormalized_nameNormalized: {
              countryCode: "RU",
              regionNormalized: locality.regionNormalized,
              nameNormalized: locality.nameNormalized,
            },
          },
          create: { countryCode: "RU", ...locality },
          update: {},
          select: { id: true },
        });
        localityIds.set(key, persisted.id);
      }

      if (preparedPoints.length === 0) return;

      await tx.ozonPickupPointSnapshot.createMany({
        data: preparedPoints.map((point) => ({
          mapPointId: point.mapPointId,
          title: point.title,
          address: point.address,
          workHours: point.workHours,
          latitude: point.latitude,
          longitude: point.longitude,
          generationId: id,
          localityId: localityIds.get(point.localityKey)!,
        })),
      });
    });
  }

  async markReady(id: string, counters: OzonPickupIndexCounters) {
    await this.prisma.$transaction(async (tx) => {
      const now = await getDatabaseNow(tx);
      await requireOwnedGeneration(tx, id);
      assertCounters(counters);

      const actualSnapshotCount = await tx.ozonPickupPointSnapshot.count({
        where: { generationId: id },
      });

      if (actualSnapshotCount !== counters.eligible) {
        throw new OzonPickupIndexIntegrityError(
          "Ozon pickup-index snapshot count does not match eligible count",
        );
      }

      const result = await tx.ozonPickupIndexGeneration.updateMany({
        where: {
          id,
          status: OzonPickupIndexGenerationStatus.BUILDING,
          leaseSlot: builderLeaseSlot,
        },
        data: {
          status: OzonPickupIndexGenerationStatus.READY,
          leaseSlot: null,
          sourcePointCount: counters.source,
          eligiblePointCount: counters.eligible,
          excludedPointCount: counters.excluded,
          readyAt: now,
          heartbeatAt: now,
          lastError: null,
        },
      });

      if (result.count !== 1) throw new LostOzonPickupIndexLeaseError();
    });
  }

  async publishReady(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(${publishAdvisoryLockId})`,
      );
      const targetRows = await tx.$queryRaw<PublishTargetRow[]>(
        Prisma.sql`SELECT "id", "sequence", CURRENT_TIMESTAMP AS "now"
          FROM "ozon_pickup_index_generations"
          WHERE "id" = ${id} AND "status" = 'ready'
          FOR UPDATE`,
      );
      const target = parsePublishTarget(targetRows, id);

      if (!target) return false;

      const newerGeneration = await tx.ozonPickupIndexGeneration.findFirst({
        where: {
          sequence: { gt: target.sequence },
          status: {
            in: [
              OzonPickupIndexGenerationStatus.READY,
              OzonPickupIndexGenerationStatus.PUBLISHED,
            ],
          },
        },
        select: { id: true },
      });

      if (newerGeneration) {
        await tx.ozonPickupIndexGeneration.updateMany({
          where: { id, status: OzonPickupIndexGenerationStatus.READY },
          data: {
            status: OzonPickupIndexGenerationStatus.FAILED,
            lastError: supersededGenerationDiagnostic,
          },
        });
        return false;
      }

      const result = await tx.ozonPickupIndexGeneration.updateMany({
        where: { id, status: OzonPickupIndexGenerationStatus.READY },
        data: {
          status: OzonPickupIndexGenerationStatus.PUBLISHED,
          publishedAt: target.now,
        },
      });

      return result.count === 1;
    });
  }

  async markFailedIfOwned(id: string, error: unknown) {
    return this.prisma.$transaction(async (tx) => {
      const now = await getDatabaseNow(tx);
      const result = await tx.ozonPickupIndexGeneration.updateMany({
        where: {
          id,
          status: OzonPickupIndexGenerationStatus.BUILDING,
          leaseSlot: builderLeaseSlot,
        },
        data: {
          status: OzonPickupIndexGenerationStatus.FAILED,
          leaseSlot: null,
          heartbeatAt: now,
          lastError: sanitizeError(error),
        },
      });

      return result.count === 1;
    });
  }
}

type DatabaseClockRow = { now: unknown };

type PublishTargetRow = DatabaseClockRow & {
  id: unknown;
  sequence: unknown;
};

type LockedGeneration = {
  id: string;
  status: string;
  leaseSlot: string | null;
};

async function requireOwnedGeneration(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const rows = await tx.$queryRaw<LockedGeneration[]>(
    Prisma.sql`SELECT "id", "status"::text AS "status", "lease_slot" AS "leaseSlot"
      FROM "ozon_pickup_index_generations"
      WHERE "id" = ${id}
      FOR UPDATE`,
  );
  const generation = rows[0];

  if (
    !generation ||
    generation.id !== id ||
    generation.status !== "building" ||
    generation.leaseSlot !== builderLeaseSlot
  ) {
    throw new LostOzonPickupIndexLeaseError();
  }
}

async function getDatabaseNow(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<DatabaseClockRow[]>(
    Prisma.sql`SELECT CURRENT_TIMESTAMP AS "now"`,
  );

  return parseDatabaseNow(rows);
}

function parseDatabaseNow(rows: DatabaseClockRow[]) {
  if (
    rows.length !== 1 ||
    !(rows[0]?.now instanceof Date) ||
    !Number.isFinite(rows[0].now.getTime())
  ) {
    throw new OzonPickupIndexIntegrityError(
      "Ozon pickup-index database clock is invalid",
    );
  }

  return rows[0].now;
}

function parsePublishTarget(rows: PublishTargetRow[], id: string) {
  if (rows.length === 0) return null;

  const row = rows[0];
  if (rows.length !== 1 || row?.id !== id || typeof row.sequence !== "bigint") {
    throw new OzonPickupIndexIntegrityError(
      "Ozon pickup-index publish target is invalid",
    );
  }

  return { id, sequence: row.sequence, now: parseDatabaseNow(rows) };
}

function prepareSnapshot(point: OzonPickupEligibleSnapshot) {
  assertBoundedString(
    point.mapPointId,
    deliveryPickupPointIdMaxLength,
    "mapPointId",
  );
  assertBoundedString(point.title, deliveryPickupPointTitleMaxLength, "title");
  assertBoundedString(
    point.workHours,
    deliveryPickupPointWorkHoursMaxLength,
    "workHours",
  );
  assertBoundedString(point.address, undefined, "address");
  assertCoordinate(point.latitude, -90, 90, "latitude");
  assertCoordinate(point.longitude, -180, 180, "longitude");

  let name: ReturnType<typeof normalizeOzonLocalityValue>;
  let region: ReturnType<typeof normalizeOzonLocalityValue>;

  try {
    name = normalizeOzonLocalityValue(point.city);
    region = normalizeOzonLocalityValue(point.region);
  } catch {
    throw new OzonPickupIndexIntegrityError(
      "Ozon pickup-index locality is invalid",
    );
  }

  const locality = {
    name: name.display,
    nameNormalized: name.normalized,
    region: region.display,
    regionNormalized: region.normalized,
  };

  return {
    mapPointId: point.mapPointId,
    title: point.title,
    address: point.address,
    workHours: point.workHours,
    latitude: point.latitude,
    longitude: point.longitude,
    locality,
    localityKey: `${region.normalized}\u0000${name.normalized}`,
  };
}

function assertBoundedString(
  value: string,
  maxLength: number | undefined,
  field: string,
) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    (maxLength !== undefined && value.length > maxLength)
  ) {
    throw new OzonPickupIndexIntegrityError(
      `Ozon pickup-index ${field} is invalid`,
    );
  }
}

function assertCoordinate(
  value: number,
  min: number,
  max: number,
  field: string,
) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new OzonPickupIndexIntegrityError(
      `Ozon pickup-index ${field} is invalid`,
    );
  }
}

function assertCounters(counters: OzonPickupIndexCounters) {
  if (
    !Number.isSafeInteger(counters.source) ||
    counters.source < 0 ||
    !Number.isSafeInteger(counters.eligible) ||
    counters.eligible < 0 ||
    !Number.isSafeInteger(counters.excluded) ||
    counters.excluded < 0 ||
    counters.source !== counters.eligible + counters.excluded
  ) {
    throw new OzonPickupIndexIntegrityError(
      "Ozon pickup-index counters are invalid",
    );
  }
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message
    .replace(/\bBearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(
      /(["']?)\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|password|token|api[_-]?key)\1(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/giu,
      "$1$2$1$3[REDACTED]",
    );
  const sanitized = Array.from(redacted, (character) => {
    return /\p{Cc}/u.test(character) ? " " : character;
  })
    .join("")
    .replace(/\s+/gu, " ")
    .trim();

  return (sanitized || "Unknown Ozon pickup-index sync error").slice(
    0,
    ozonPickupIndexErrorMaxLength,
  );
}
