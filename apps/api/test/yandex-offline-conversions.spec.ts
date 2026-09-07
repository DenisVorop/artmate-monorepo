import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, describe, it } from "node:test";

import {
  AnalyticsOutboxStatus,
  type AnalyticsOutboxEvent,
} from "../src/generated/prisma/client";
import { AnalyticsOutboxService } from "../src/analytics/analytics-outbox.service";
import {
  YandexOfflineConversionsHttpError,
  YandexOfflineConversionsService,
  type YandexUploading,
} from "../src/analytics/yandex-offline-conversions.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const originalFetch = globalThis.fetch;
const originalCounterId = process.env.YANDEX_METRIKA_ID;
const originalToken = process.env.YANDEX_METRIKA_OAUTH_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("YANDEX_METRIKA_ID", originalCounterId);
  restoreEnv("YANDEX_METRIKA_OAUTH_TOKEN", originalToken);
});

describe("Yandex offline conversions", () => {
  it("posts the exact official URL with OAuth and multipart CSV", async () => {
    process.env.YANDEX_METRIKA_ID = "109148727";
    process.env.YANDEX_METRIKA_OAUTH_TOKEN = "secret-token";
    let request: { input: string | URL | Request; init?: RequestInit } | undefined;
    globalThis.fetch = async (input, init) => {
      request = { input, init };
      return new Response('{"uploading":{"id":1,"comment":"artmateevent1"}}', {
        status: 200,
      });
    };

    const response = await new YandexOfflineConversionsService().upload({
      clientId: "123456",
      currency: "RUB",
      dateTime: 1788611696,
      price: "2897.00",
      purchaseId: "AM-PAID-1",
      target: "order_paid",
      yclid: "987654",
    }, "artmateevent1");

    assert.equal(
      String(request?.input),
      "https://api-metrika.yandex.net/management/v1/counter/109148727/offline_conversions/upload?comment=artmateevent1&type=BASIC",
    );
    assert.equal(request?.init?.method, "POST");
    assert.deepEqual(request?.init?.headers, {
      Authorization: "OAuth secret-token",
    });
    assert.ok(request?.init?.body instanceof FormData);
    const file = request.init.body.get("file");
    assert.ok(file instanceof File);
    assert.equal(file.name, "offline-conversions.csv");
    assert.equal(file.type, "text/csv");
    assert.equal(
      await file.text(),
      "ClientId,Yclid,PurchaseId,Target,DateTime,Price,Currency\r\n123456,987654,AM-PAID-1,order_paid,1788611696,2897.00,RUB\r\n",
    );
    assert.deepEqual(response, {
      comment: "artmateevent1",
      id: "1",
      providerResponse: '{"uploading":{"id":1,"comment":"artmateevent1"}}',
    });
  });

  it("rejects malformed 2xx upload responses", async () => {
    process.env.YANDEX_METRIKA_ID = "109148727";
    process.env.YANDEX_METRIKA_OAUTH_TOKEN = "secret-token";
    globalThis.fetch = async () => new Response('{"uploading":{"comment":"comment1"}}');

    await assert.rejects(
      () => new YandexOfflineConversionsService().upload(
        event().payload as never,
        "comment1",
      ),
      /upload response is invalid/i,
    );
  });

  it("paginates uploadings and requires an exact comment match", async () => {
    process.env.YANDEX_METRIKA_ID = "109148727";
    process.env.YANDEX_METRIKA_OAUTH_TOKEN = "secret-token";
    const urls: string[] = [];
    const beforeRequestCalls: number[] = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      const uploadings = urls.length === 1
        ? Array.from({ length: 1_000 }, (_, index) => ({
            comment: index === 0 ? "comment1suffix" : `other${index}`,
            id: index + 1,
          }))
        : [{ comment: "comment1", id: 1001 }];
      return Response.json({ uploadings });
    };

    const service = new YandexOfflineConversionsService();
    const findUploadingByComment = service.findUploadingByComment.bind(service) as (
      comment: string,
      beforeRequest?: () => Promise<void>,
    ) => Promise<YandexUploading | null>;
    const uploading = await findUploadingByComment("comment1", async () => {
        beforeRequestCalls.push(urls.length);
      });

    assert.equal(urls.length, 2);
    assert.deepEqual(beforeRequestCalls, [0, 1]);
    assert.match(urls[0] ?? "", /limit=1000&offset=0&type=BASIC$/);
    assert.match(urls[1] ?? "", /limit=1000&offset=1000&type=BASIC$/);
    assert.equal(uploading?.id, "1001");
    assert.equal(uploading?.comment, "comment1");
  });

  it("rejects an uploading detail whose id does not match the request", async () => {
    process.env.YANDEX_METRIKA_ID = "109148727";
    process.env.YANDEX_METRIKA_OAUTH_TOKEN = "secret-token";
    globalThis.fetch = async () =>
      Response.json({ uploading: { comment: "comment1", id: 43 } });

    await assert.rejects(
      () => new YandexOfflineConversionsService().findUploadingById("42"),
      /upload response id does not match request/i,
    );
  });

  it("preserves HTTP 404 when a known uploading is not found", async () => {
    process.env.YANDEX_METRIKA_ID = "109148727";
    process.env.YANDEX_METRIKA_OAUTH_TOKEN = "secret-token";
    globalThis.fetch = async () =>
      new Response("uploading not found", { status: 404 });

    await assert.rejects(
      () => new YandexOfflineConversionsService().findUploadingById("42"),
      (error: unknown) =>
        error instanceof YandexOfflineConversionsHttpError && error.status === 404,
    );
  });

  it("releases stale leases and claims each due event with CAS", async () => {
    const fixture = createWorkerFixture([event()]);
    await fixture.service.processDueEvents();

    assert.equal(fixture.staleReleaseCalls.length, 1);
    assert.equal(fixture.claimCalls.length, 1);
    assert.equal(fixture.claimCalls[0]?.where.id, "event-1");
    assert.equal(
      fixture.claimCalls[0]?.where.status,
      AnalyticsOutboxStatus.PENDING,
    );
    const duePredicate = fixture.claimCalls[0]?.where.nextAttemptAt as
      | { lte?: unknown }
      | undefined;
    assert.ok(duePredicate?.lte instanceof Date);
    assert.equal(fixture.uploads(), 1);
  });

  it("does not claim a stale snapshot after another worker schedules retry", async () => {
    const state = event({
      nextAttemptAt: new Date(Date.now() - 60_000),
    });
    const firstClaimStarted = deferred<void>();
    const releaseFirstClaim = deferred<void>();
    let claimAttempts = 0;
    let firstUploads = 0;
    let secondUploads = 0;
    const prisma = {
      analyticsOutboxEvent: {
        findMany: async () =>
          state.status === AnalyticsOutboxStatus.PENDING &&
          state.nextAttemptAt <= new Date()
            ? [{ ...state }]
            : [],
        updateMany: async (input: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          if (
            input.where.id === state.id &&
            input.where.status === AnalyticsOutboxStatus.PENDING
          ) {
            claimAttempts += 1;
            if (claimAttempts === 1) {
              firstClaimStarted.resolve();
              await releaseFirstClaim.promise;
            }
            const due = input.where.nextAttemptAt as
              | { lte?: Date }
              | undefined;
            if (
              state.status !== AnalyticsOutboxStatus.PENDING ||
              (due?.lte && state.nextAttemptAt > due.lte)
            ) {
              return { count: 0 };
            }
            Object.assign(state, input.data);
            return { count: 1 };
          }
          if (
            input.where.id === state.id &&
            input.where.status === AnalyticsOutboxStatus.PROCESSING
          ) {
            if (
              state.status !== AnalyticsOutboxStatus.PROCESSING ||
              state.leaseToken !== input.where.leaseToken
            ) {
              return { count: 0 };
            }
            Object.assign(state, input.data);
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
    } as unknown as PrismaService;
    const first = new AnalyticsOutboxService(prisma, {
      findUploadingByComment: async () => null,
      findUploadingById: async () => null,
      upload: async (_payload: unknown, comment: string) => {
        firstUploads += 1;
        return { comment, id: "1", providerResponse: "accepted" };
      },
    } as unknown as YandexOfflineConversionsService);
    const second = new AnalyticsOutboxService(prisma, {
      findUploadingByComment: async () => null,
      findUploadingById: async () => null,
      upload: async () => {
        secondUploads += 1;
        throw new YandexOfflineConversionsHttpError(500, "retry");
      },
    } as unknown as YandexOfflineConversionsService);

    const staleWorker = first.processDueEvents();
    await firstClaimStarted.promise;
    await second.processDueEvents();
    const retryAt = state.nextAttemptAt;
    releaseFirstClaim.resolve();
    await staleWorker;

    assert.equal(secondUploads, 1);
    assert.equal(firstUploads, 0);
    assert.equal(state.status, AnalyticsOutboxStatus.PENDING);
    assert.equal(state.nextAttemptAt, retryAt);
    assert.ok(retryAt > new Date());
  });

  it("accepts PurchaseId-only conversions", async () => {
    const fixture = createWorkerFixture([
      event({
        payload: {
          currency: "RUB",
          dateTime: 1788611696,
          price: "2897.00",
          purchaseId: "AM-PAID-1",
          target: "order_paid",
        },
      }),
    ]);
    await fixture.service.processDueEvents();

    assert.equal(
      fixture.updates[fixture.updates.length - 1]?.data.status,
      AnalyticsOutboxStatus.SENT,
    );
  });

  it("does not mark an arbitrary 2xx response sent", async () => {
    const fixture = createWorkerFixture(
      [event()],
      new Response("x".repeat(10_000), { status: 200 }),
    );
    await fixture.service.processDueEvents();

    const update = fixture.updates[fixture.updates.length - 1]?.data;
    assert.equal(update?.status, AnalyticsOutboxStatus.PENDING);
    assert.equal(update?.sentAt, undefined);
  });

  it("recovers a crash after upload by exact deterministic comment without a second POST", async () => {
    const state = event();
    let uploadCount = 0;
    let remoteUpload: YandexUploading | undefined;
    let failLocalWrite = true;
    const prisma = createStatefulPrisma(state, (data: Record<string, unknown>) => {
      if (data.providerUploadId && failLocalWrite) {
        failLocalWrite = false;
        throw new Error("database unavailable after remote upload");
      }
    });
    const yandex = {
      findUploadingByComment: async (comment: string) =>
        remoteUpload?.comment === comment ? remoteUpload : null,
      findUploadingById: async () => null,
      upload: async (_payload: unknown, comment: string) => {
        uploadCount += 1;
        remoteUpload = { comment, id: "42", providerResponse: "accepted" };
        return remoteUpload;
      },
    };

    await new AnalyticsOutboxService(prisma as never, yandex as never).processDueEvents();
    state.status = AnalyticsOutboxStatus.PENDING;
    state.lockedAt = null;
    state.nextAttemptAt = new Date(0);
    await new AnalyticsOutboxService(prisma as never, yandex as never).processDueEvents();

    assert.equal(uploadCount, 1);
    assert.equal(state.providerUploadId, "42");
    assert.equal(state.status, AnalyticsOutboxStatus.SENT);
  });

  it("reconciles a known provider upload id by GET without POST", async () => {
    const state = event({ providerUploadId: "42" });
    let uploadCount = 0;
    let detailCount = 0;
    const comment = deterministicComment(state.id);
    const yandex = {
      findUploadingByComment: async () => assert.fail("comment search is not needed"),
      findUploadingById: async (id: string) => {
        detailCount += 1;
        assert.equal(id, "42");
        return { comment, id, providerResponse: "reconciled" };
      },
      upload: async () => {
        uploadCount += 1;
        throw new Error("POST is not allowed");
      },
    };

    await new AnalyticsOutboxService(
      createStatefulPrisma(state) as never,
      yandex as never,
    ).processDueEvents();

    assert.equal(detailCount, 1);
    assert.equal(uploadCount, 0);
    assert.equal(state.status, AnalyticsOutboxStatus.SENT);
  });

  for (const status of [408, 429, 500, 503, 599]) {
    it(`retries HTTP ${status} with backoff and bounded diagnostics`, async () => {
      const state = event();
      const fixture = createWorkerFixture(
        [state],
        new Response("x".repeat(10_000), { status }),
      );
      await fixture.service.processDueEvents();

      const update = fixture.updates[fixture.updates.length - 1]?.data;
      assert.equal(update?.status, AnalyticsOutboxStatus.PENDING);
      assert.equal(update?.attempts, 1);
      assert.equal((update?.lastError as string).length, 2000);
      assert.ok(update?.nextAttemptAt instanceof Date);
      assert.equal(state.failedAt, null);
      assert.equal(state.leaseToken, null);
      assert.equal(state.lockedAt, null);
    });
  }

  it("retries network errors", async () => {
    const state = event();
    const fixture = createWorkerFixture([state], new TypeError("fetch failed"));
    await fixture.service.processDueEvents();

    assert.equal(state.status, AnalyticsOutboxStatus.PENDING);
    assert.equal(state.attempts, 1);
    assert.equal(state.failedAt, null);
    assert.equal(state.leaseToken, null);
    assert.equal(state.lockedAt, null);
    assert.ok(state.nextAttemptAt > new Date());
  });

  it("retries fetch timeouts", async () => {
    const state = event();
    const fixture = createWorkerFixture(
      [state],
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    );
    await fixture.service.processDueEvents();

    assert.equal(state.status, AnalyticsOutboxStatus.PENDING);
    assert.equal(state.attempts, 1);
    assert.equal(state.failedAt, null);
    assert.equal(state.leaseToken, null);
    assert.equal(state.lockedAt, null);
    assert.ok(state.nextAttemptAt > new Date());
  });

  it("permanently fails invalid payloads", async () => {
    const invalid = createWorkerFixture([
      event({ payload: { customerEmail: "private@example.com" } }),
    ]);
    await invalid.service.processDueEvents();
    assert.equal(
      invalid.updates[invalid.updates.length - 1]?.data.status,
      AnalyticsOutboxStatus.FAILED,
    );

    const malformedIdentifier = createWorkerFixture([
      event({
        payload: {
          ...(event().payload as object),
          clientId: "x".repeat(129),
        },
      }),
    ]);
    await malformedIdentifier.service.processDueEvents();
    assert.equal(
      malformedIdentifier.updates[malformedIdentifier.updates.length - 1]?.data
        .status,
      AnalyticsOutboxStatus.FAILED,
    );
  });

  for (const status of [400, 401, 403, 404, 418, 422]) {
    it(
      `permanently fails HTTP ${status}, clears its lease, and is not retried`,
      async () => {
        const state = event();
        const fixture = createWorkerFixture(
          [state],
          new Response("invalid conversion", { status }),
        );

        await fixture.service.processDueEvents();
        await fixture.service.processDueEvents();

        assert.equal(state.status, AnalyticsOutboxStatus.FAILED);
        assert.equal(state.attempts, 1);
        assert.ok(state.failedAt instanceof Date);
        assert.equal(state.leaseToken, null);
        assert.equal(state.lockedAt, null);
        assert.equal(fixture.uploads(), 1);
      },
    );
  }

  it("terminally rejects mismatched outbox identity without contacting Yandex", async () => {
    const fixture = createWorkerFixture([
      event({ id: "invalid-event-type", eventType: "order_created" }),
      event({
        aggregateId: "AM-PAID-2",
        id: "invalid-purchase-id",
        payload: {
          ...(event().payload as object),
          purchaseId: "AM-OTHER",
        },
      }),
    ]);

    await fixture.service.processDueEvents();

    assert.equal(fixture.uploads(), 0);
    assert.deepEqual(
      fixture.updates
        .filter((update) => update.data.status === AnalyticsOutboxStatus.FAILED)
        .map((update) => update.data.lastError),
      ["Analytics event type is invalid", "Analytics purchase id does not match aggregate"],
    );
  });
});

function createWorkerFixture(
  events: AnalyticsOutboxEvent[],
  result: Response | Error | YandexUploading = {
    comment: deterministicComment("event-1"),
    id: "1",
    providerResponse: "accepted",
  },
) {
  const staleReleaseCalls: Array<{
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }> = [];
  const claimCalls: Array<{
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }> = [];
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  let uploadCount = 0;
  const prisma = {
    analyticsOutboxEvent: {
      findMany: async (input: { take?: number }) =>
        events
          .filter(
            (event) =>
              event.status === AnalyticsOutboxStatus.PENDING &&
              event.nextAttemptAt <= new Date(),
          )
          .slice(0, input.take ?? events.length),
      updateMany: async (input: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (
          input.where.status === AnalyticsOutboxStatus.PROCESSING &&
          "id" in input.where
        ) {
          updates.push(input);
        } else if (
          input.where.status === AnalyticsOutboxStatus.PROCESSING &&
          "lockedAt" in input.where
        ) {
          staleReleaseCalls.push(input);
        } else {
          claimCalls.push(input);
        }
        if (!input.where.id) {
          return { count: 0 };
        }
        const current = events.find((event) => event.id === input.where.id);
        if (!current || current.status !== input.where.status) {
          return { count: 0 };
        }
        if (
          "leaseToken" in input.where &&
          current.leaseToken !== input.where.leaseToken
        ) {
          return { count: 0 };
        }
        const due = input.where.nextAttemptAt as { lte?: Date } | undefined;
        if (due?.lte && current.nextAttemptAt > due.lte) {
          return { count: 0 };
        }
        Object.assign(current, input.data);
        return { count: 1 };
      },
    },
  } as unknown as PrismaService;
  const yandex = {
    findUploadingByComment: async () => null,
    findUploadingById: async () => null,
    upload: async () => {
      uploadCount += 1;
      if (result instanceof Error) throw result;
      if (result instanceof Response) {
        const body = await result.text();
        if (!result.ok) {
          throw new YandexOfflineConversionsHttpError(result.status, body);
        }
        throw new Error("Yandex upload response is invalid");
      }
      return result;
    },
  } as unknown as YandexOfflineConversionsService;

  return {
    claimCalls,
    service: new AnalyticsOutboxService(prisma, yandex),
    staleReleaseCalls,
    updates,
    uploads: () => uploadCount,
  };
}

function event(overrides: Partial<AnalyticsOutboxEvent> = {}) {
  return {
    aggregateId: "AM-PAID-1",
    attempts: 0,
    createdAt: new Date("2026-09-05T12:35:00.000Z"),
    eventType: "order_paid",
    failedAt: null,
    id: "event-1",
    lastError: null,
    lockedAt: null,
    nextAttemptAt: new Date("2026-09-05T12:35:00.000Z"),
    payload: {
      clientId: "123456",
      currency: "RUB",
      dateTime: 1788611696,
      price: "2897.00",
      purchaseId: "AM-PAID-1",
      target: "order_paid",
      yclid: "987654",
    },
    providerResponse: null,
    providerUploadId: null,
    sentAt: null,
    status: AnalyticsOutboxStatus.PENDING,
    updatedAt: new Date("2026-09-05T12:35:00.000Z"),
    ...overrides,
    leaseToken: overrides.leaseToken ?? null,
  } satisfies AnalyticsOutboxEvent;
}

function createStatefulPrisma(
  state: AnalyticsOutboxEvent,
  beforeUpdate?: (data: Record<string, unknown>) => void,
) {
  return {
    analyticsOutboxEvent: {
      findMany: async () =>
        state.status === AnalyticsOutboxStatus.PENDING ? [{ ...state }] : [],
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (!where.id) return { count: 0 };
        if (where.status !== state.status) return { count: 0 };
        if ("leaseToken" in where && where.leaseToken !== state.leaseToken) {
          return { count: 0 };
        }
        const due = where.nextAttemptAt as { lte?: Date } | undefined;
        if (due?.lte && state.nextAttemptAt > due.lte) return { count: 0 };
        beforeUpdate?.(data);
        Object.assign(state, data);
        return { count: 1 };
      },
    },
  };
}

function deterministicComment(eventId: string) {
  return `artmate${crypto.createHash("sha256").update(eventId).digest("hex")}`;
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
