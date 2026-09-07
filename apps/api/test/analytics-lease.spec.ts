import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { AnalyticsOutboxStatus } from "../src/generated/prisma/client";
import { AnalyticsOutboxService } from "../src/analytics/analytics-outbox.service";
import { YandexOfflineConversionsHttpError } from "../src/analytics/yandex-offline-conversions.service";

describe("analytics outbox lease ownership", () => {
  it("maps the nullable 36-character lease token in schema and migration", async () => {
    const [schema, migration] = await Promise.all([
      readFile("prisma/schema/analytics.prisma", "utf8"),
      readFile(
        "prisma/migrations/20260907143000_add_analytics_provider_upload_id/migration.sql",
        "utf8",
      ),
    ]);

    assert.match(
      schema,
      /leaseToken\s+String\?\s+@map\("lease_token"\)\s+@db\.VarChar\(36\)/,
    );
    assert.match(migration, /"lease_token" VARCHAR\(36\)/);
  });

  it("claims one event immediately before processing instead of leasing a batch", async () => {
    const states = [event("event-1"), event("event-2")];
    const fixture = createPrisma(states);
    const processingCounts: number[] = [];
    const yandex = {
      findUploadingByComment: async () => {
        processingCounts.push(
          states.filter(
            (state) =>
              (state.status as AnalyticsOutboxStatus) ===
              AnalyticsOutboxStatus.PROCESSING,
          )
            .length,
        );
        return null;
      },
      findUploadingById: async () => null,
      upload: async (_payload: unknown, comment: string) => ({
        comment,
        id: String(processingCounts.length),
        providerResponse: "accepted",
      }),
    };

    await new AnalyticsOutboxService(fixture.prisma as never, yandex as never)
      .processDueEvents();

    assert.deepEqual(processingCounts, [1, 1]);
    assert.ok(fixture.findCalls.length >= 2);
    assert.ok(fixture.findCalls.every((call) => call.take === 1));
  });

  it("claims at most ten events per processing run", async () => {
    const states = Array.from({ length: 11 }, (_, index) => event(`event-${index + 1}`));
    const fixture = createPrisma(states);
    const processingCounts: number[] = [];
    const yandex = {
      findUploadingByComment: async () => {
        processingCounts.push(
          states.filter(
            (state) =>
              (state.status as AnalyticsOutboxStatus) ===
              AnalyticsOutboxStatus.PROCESSING,
          ).length,
        );
        return null;
      },
      findUploadingById: async () => null,
      upload: async (_payload: unknown, comment: string) => ({
        comment,
        id: String(processingCounts.length),
        providerResponse: "accepted",
      }),
    };

    await new AnalyticsOutboxService(fixture.prisma as never, yandex as never)
      .processDueEvents();

    assert.equal(
      states.filter(
        (state) =>
          (state.status as AnalyticsOutboxStatus) === AnalyticsOutboxStatus.SENT,
      ).length,
      10,
    );
    assert.equal(states[10]?.status, AnalyticsOutboxStatus.PENDING);
    assert.deepEqual(processingCounts, Array.from({ length: 10 }, () => 1));
    assert.equal(fixture.findCalls.length, 10);
    assert.ok(fixture.findCalls.every((call) => call.take === 1));
  });

  it("renews ownership on every reconciliation page and immediately before POST", async () => {
    const originalNow = Date.now;
    let now = Date.parse("2026-09-07T12:00:00.000Z");
    Date.now = () => now;
    const state = event("event-pages");
    const fixture = createPrisma([state]);
    const renewedAt: number[] = [];
    const renew = async (beforeRequest?: () => Promise<void>) => {
      assert.ok(beforeRequest, "worker must supply a lease heartbeat");
      now += 1_000;
      await beforeRequest();
      renewedAt.push(state.lockedAt?.getTime() ?? 0);
    };
    const yandex = {
      findUploadingByComment: async (
        _comment: string,
        beforeRequest?: () => Promise<void>,
      ) => {
        await renew(beforeRequest);
        await renew(beforeRequest);
        return null;
      },
      findUploadingById: async () => null,
      upload: async (
        _payload: unknown,
        comment: string,
        beforeRequest?: () => Promise<void>,
      ) => {
        await renew(beforeRequest);
        return { comment, id: "7", providerResponse: "accepted" };
      },
    };

    try {
      await new AnalyticsOutboxService(fixture.prisma as never, yandex as never)
        .processDueEvents();
    } finally {
      Date.now = originalNow;
    }

    assert.deepEqual(renewedAt, [now - 2_000, now - 1_000, now]);
    assert.equal(state.status, AnalyticsOutboxStatus.SENT);
  });

  it("does not POST when another worker owns the token before upload", async () => {
    const state = event("event-lost-before-post");
    const fixture = createPrisma([state]);
    let posts = 0;
    const yandex = {
      findUploadingByComment: async (
        _comment: string,
        beforeRequest?: () => Promise<void>,
      ) => {
        await beforeRequest?.();
        state.leaseToken = "worker-b";
        return null;
      },
      findUploadingById: async () => null,
      upload: async (
        _payload: unknown,
        comment: string,
        beforeRequest?: () => Promise<void>,
      ) => {
        await beforeRequest?.();
        posts += 1;
        return { comment, id: "8", providerResponse: "accepted" };
      },
    };

    await new AnalyticsOutboxService(fixture.prisma as never, yandex as never)
      .processDueEvents();

    assert.equal(posts, 0);
    assert.equal(state.leaseToken, "worker-b");
    assert.equal(state.status, AnalyticsOutboxStatus.PROCESSING);
    assert.equal(state.attempts, 0);
  });

  it("does not let a late completion overwrite the new owner", async () => {
    const state = event("event-late-complete");
    const fixture = createPrisma([state]);
    const yandex = {
      findUploadingByComment: async (
        _comment: string,
        beforeRequest?: () => Promise<void>,
      ) => {
        await beforeRequest?.();
        return null;
      },
      findUploadingById: async () => null,
      upload: async (
        _payload: unknown,
        comment: string,
        beforeRequest?: () => Promise<void>,
      ) => {
        await beforeRequest?.();
        state.leaseToken = "worker-b";
        return { comment, id: "9", providerResponse: "accepted" };
      },
    };

    await new AnalyticsOutboxService(fixture.prisma as never, yandex as never)
      .processDueEvents();

    assert.equal(state.leaseToken, "worker-b");
    assert.equal(state.providerUploadId, null);
    assert.equal(state.status, AnalyticsOutboxStatus.PROCESSING);
  });

  it("does not let a late retry overwrite the new owner", async () => {
    const state = event("event-late-retry");
    const nextState = event("event-after-lost-retry");
    const fixture = createPrisma([state, nextState]);
    let reconciliationCalls = 0;
    const yandex = {
      findUploadingByComment: async (
        _comment: string,
        beforeRequest?: () => Promise<void>,
      ) => {
        await beforeRequest?.();
        reconciliationCalls += 1;
        if (reconciliationCalls === 1) {
          state.leaseToken = "worker-b";
          throw new YandexOfflineConversionsHttpError(500, "retry");
        }
        return null;
      },
      findUploadingById: async () => null,
      upload: async (_payload: unknown, comment: string) => ({
        comment,
        id: "10",
        providerResponse: "accepted",
      }),
    };

    await new AnalyticsOutboxService(fixture.prisma as never, yandex as never)
      .processDueEvents();

    assert.equal(state.leaseToken, "worker-b");
    assert.equal(state.status, AnalyticsOutboxStatus.PROCESSING);
    assert.equal(state.attempts, 0);
    assert.equal(nextState.status, AnalyticsOutboxStatus.SENT);
  });

  it("does not let a late failure overwrite the new owner", async () => {
    const state = event("event-late-fail");
    const nextState = event("event-after-lost-fail");
    const fixture = createPrisma([state, nextState]);
    let reconciliationCalls = 0;
    const yandex = {
      findUploadingByComment: async (
        _comment: string,
        beforeRequest?: () => Promise<void>,
      ) => {
        await beforeRequest?.();
        reconciliationCalls += 1;
        if (reconciliationCalls === 1) {
          state.leaseToken = "worker-b";
          throw new YandexOfflineConversionsHttpError(400, "failed");
        }
        return null;
      },
      findUploadingById: async () => null,
      upload: async (_payload: unknown, comment: string) => ({
        comment,
        id: "11",
        providerResponse: "accepted",
      }),
    };

    await new AnalyticsOutboxService(fixture.prisma as never, yandex as never)
      .processDueEvents();

    assert.equal(state.leaseToken, "worker-b");
    assert.equal(state.status, AnalyticsOutboxStatus.PROCESSING);
    assert.equal(state.attempts, 0);
    assert.equal(nextState.status, AnalyticsOutboxStatus.SENT);
  });
});

type State = ReturnType<typeof event>;

function event(id: string) {
  return {
    aggregateId: `order-${id}`,
    attempts: 0,
    createdAt: new Date("2026-09-07T10:00:00.000Z"),
    eventType: "order_paid",
    failedAt: null as Date | null,
    id,
    lastError: null as string | null,
    leaseToken: null as string | null,
    lockedAt: null as Date | null,
    nextAttemptAt: new Date(0),
    payload: {
      currency: "RUB",
      dateTime: 1788775200,
      price: "100.00",
      purchaseId: `order-${id}`,
      target: "order_paid",
    },
    providerResponse: null as string | null,
    providerUploadId: null as string | null,
    sentAt: null as Date | null,
    status: AnalyticsOutboxStatus.PENDING,
    updatedAt: new Date("2026-09-07T10:00:00.000Z"),
  };
}

function createPrisma(states: State[]) {
  const findCalls: Array<Record<string, unknown>> = [];
  return {
    findCalls,
    prisma: {
      analyticsOutboxEvent: {
        findMany: async (input: Record<string, unknown>) => {
          findCalls.push(input);
          const take = typeof input.take === "number" ? input.take : states.length;
          return states
            .filter(
              (state) =>
                state.status === AnalyticsOutboxStatus.PENDING &&
                state.nextAttemptAt.getTime() <= Date.now(),
            )
            .slice(0, take)
            .map((state) => ({ ...state }));
        },
        updateMany: async ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: Record<string, unknown>;
        }) => {
          if (!where.id) {
            let count = 0;
            const lockedAt = where.lockedAt as { lte: Date } | undefined;
            for (const state of states) {
              if (
                state.status === where.status &&
                lockedAt &&
                state.lockedAt &&
                state.lockedAt <= lockedAt.lte
              ) {
                Object.assign(state, data);
                count += 1;
              }
            }
            return { count };
          }

          const state = states.find((candidate) => candidate.id === where.id);
          if (!state || state.status !== where.status) return { count: 0 };
          if ("leaseToken" in where && state.leaseToken !== where.leaseToken) {
            return { count: 0 };
          }
          const due = where.nextAttemptAt as { lte: Date } | undefined;
          if (due && state.nextAttemptAt > due.lte) return { count: 0 };
          if (where.lockedAt instanceof Date && state.lockedAt?.getTime() !== where.lockedAt.getTime()) {
            return { count: 0 };
          }
          Object.assign(state, data);
          return { count: 1 };
        },
      },
    },
  };
}
