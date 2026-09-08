import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type DeliveryCacheRecord = {
  byteSize: number;
  expiresAt: Date | null;
  freshUntil: Date | null;
  key: string;
  leaseUntil: Date | null;
  payload: unknown;
  refreshedAt: Date | null;
};

const defaultPayloadMaxBytes = 5 * 1024 * 1024;
const pointListPayloadMaxBytes = 32 * 1024 * 1024;
const maxCacheEntries = 250;
const maxCacheBytes = 96 * 1024 * 1024;
const nominatimAdvisoryLockId = 641_783_205;

@Injectable()
export class DeliveryCacheRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(key: string): Promise<DeliveryCacheRecord | null> {
    return this.prisma.deliveryCacheEntry.findUnique({
      where: { key },
      select: {
        byteSize: true,
        expiresAt: true,
        freshUntil: true,
        key: true,
        leaseUntil: true,
        payload: true,
        refreshedAt: true,
      },
    });
  }

  async tryAcquireLease(key: string, token: string, leaseMs: number) {
    const rows = await this.prisma.$queryRaw<Array<{ key: string }>>(Prisma.sql`
      INSERT INTO "delivery_cache_entries" ("key", "lease_token", "lease_until")
      VALUES (${key}, ${token}::uuid, CURRENT_TIMESTAMP + (${leaseMs} * INTERVAL '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "lease_token" = EXCLUDED."lease_token",
        "lease_until" = EXCLUDED."lease_until",
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "delivery_cache_entries"."lease_until" IS NULL
         OR "delivery_cache_entries"."lease_until" <= CURRENT_TIMESTAMP
         OR "delivery_cache_entries"."lease_token" = ${token}::uuid
      RETURNING "key"
    `);
    return rows.length === 1 && rows[0]?.key === key;
  }

  async publish(
    key: string,
    token: string,
    payload: unknown,
    freshTtlMs: number,
    maxTtlMs: number,
  ) {
    const serialized = JSON.stringify(payload);
    const byteSize = Buffer.byteLength(serialized);
    const maxBytes =
      key === "ozon:point-list"
        ? pointListPayloadMaxBytes
        : defaultPayloadMaxBytes;
    if (byteSize > maxBytes)
      throw new Error("Delivery cache payload is too large");

    const result = await this.prisma.deliveryCacheEntry.updateMany({
      where: { key, leaseToken: token },
      data: {
        byteSize,
        expiresAt: new Date(Date.now() + maxTtlMs),
        freshUntil: new Date(Date.now() + freshTtlMs),
        leaseToken: null,
        leaseUntil: null,
        payload: JSON.parse(serialized) as Prisma.InputJsonValue,
        refreshedAt: new Date(),
      },
    });
    return result.count === 1;
  }

  async releaseLease(key: string, token: string) {
    await this.prisma.deliveryCacheEntry.updateMany({
      where: { key, leaseToken: token },
      data: { leaseToken: null, leaseUntil: null },
    });
  }

  async cleanup() {
    await this.prisma.$executeRaw(Prisma.sql`
      WITH expired_leases AS (
        SELECT "key" FROM "delivery_cache_entries"
        WHERE "lease_until" <= CURRENT_TIMESTAMP
        ORDER BY "lease_until" ASC LIMIT 20
      )
      UPDATE "delivery_cache_entries" SET
        "lease_token" = NULL,
        "lease_until" = NULL,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "key" IN (SELECT "key" FROM expired_leases)
        AND "lease_until" <= CURRENT_TIMESTAMP
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      WITH removable AS (
        SELECT "key" FROM "delivery_cache_entries"
        WHERE "lease_token" IS NULL AND (
          "expires_at" < CURRENT_TIMESTAMP
          OR ("payload" IS NULL AND "updated_at" < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
        )
        ORDER BY "expires_at" ASC NULLS FIRST LIMIT 20
      )
      DELETE FROM "delivery_cache_entries"
      WHERE "key" IN (SELECT "key" FROM removable)
        AND "lease_token" IS NULL
        AND (
          "expires_at" < CURRENT_TIMESTAMP
          OR ("payload" IS NULL AND "updated_at" < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
        )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      WITH ranked AS (
        SELECT "key",
          row_number() OVER (ORDER BY "refreshed_at" DESC NULLS LAST) AS position,
          sum("byte_size") OVER (ORDER BY "refreshed_at" DESC NULLS LAST) AS cumulative_bytes
        FROM "delivery_cache_entries"
        WHERE "lease_token" IS NULL
      )
      DELETE FROM "delivery_cache_entries"
      WHERE "key" IN (
        SELECT "key" FROM ranked
        WHERE position > ${maxCacheEntries} OR cumulative_bytes > ${maxCacheBytes}
        LIMIT 20
      )
        AND "lease_token" IS NULL
    `);
  }

  async withNominatimGate<T>(
    request: () => Promise<T>,
    maxWaitMs: number,
  ): Promise<T> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const lockRows = await tx.$queryRaw<
            Array<{ acquired: boolean }>
          >(Prisma.sql`
          SELECT pg_try_advisory_xact_lock(${nominatimAdvisoryLockId}) AS "acquired"
        `);
          if (lockRows[0]?.acquired !== true)
            return { acquired: false as const };

          await tx.$executeRaw(Prisma.sql`
          INSERT INTO "nominatim_rate_limits" ("key", "next_allowed_at")
          VALUES ('search', clock_timestamp())
          ON CONFLICT ("key") DO NOTHING
        `);
          const rows = await tx.$queryRaw<
            Array<{ nextAllowedAt: Date; now: Date }>
          >(Prisma.sql`
          SELECT "next_allowed_at" AS "nextAllowedAt", clock_timestamp() AS "now"
          FROM "nominatim_rate_limits" WHERE "key" = 'search' FOR UPDATE
        `);
          const row = rows[0];
          if (
            !row ||
            !(row.nextAllowedAt instanceof Date) ||
            !(row.now instanceof Date)
          ) {
            return {
              acquired: true as const,
              error: new Error("Nominatim database gate is unavailable"),
            };
          }
          const cooldownMs = Math.max(
            0,
            row.nextAllowedAt.getTime() - row.now.getTime(),
          );
          if (Date.now() + cooldownMs > deadline) {
            return { acquired: true as const, busy: true as const };
          }
          if (cooldownMs > 0) await delay(cooldownMs);

          let value: T | undefined;
          let error: unknown;
          try {
            value = await request();
          } catch (caught) {
            error = caught;
          }
          await tx.$executeRaw(Prisma.sql`
          UPDATE "nominatim_rate_limits"
          SET "next_allowed_at" = clock_timestamp() + INTERVAL '1 second',
              "updated_at" = clock_timestamp()
          WHERE "key" = 'search'
        `);
          return { acquired: true as const, error, value };
        },
        { maxWait: maxWaitMs, timeout: maxWaitMs + 12_000 },
      );

      if (!result.acquired) {
        await delay(50);
        continue;
      }
      if ("busy" in result) throw new NominatimGateBusyError();
      if (result.error !== undefined) throw result.error;
      return result.value as T;
    }
    throw new NominatimGateBusyError();
  }
}

export class NominatimGateBusyError extends Error {}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
