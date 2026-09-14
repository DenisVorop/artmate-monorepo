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
    let request:
      | { input: string | URL | Request; init?: RequestInit }
      | undefined;
    globalThis.fetch = async (input, init) => {
      request = { input, init };
      return new Response(
        '{"uploading":{"id":1,"comment":"artmateevent1","status":"UPLOADED","source_quantity":1,"line_quantity":1}}',
        {
          status: 200,
        },
      );
    };

    const response = await new YandexOfflineConversionsService().upload(
      {
        clientId: "123456",
        currency: "RUB",
        dateTime: 1788611696,
        price: "2897.00",
        purchaseId: "AM-PAID-1",
        target: "order_paid",
        yclid: "987654",
      },
      "artmateevent1",
    );

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
      status: "UPLOADED",
      sourceQuantity: 1,
      lineQuantity: 1,
      providerResponse: JSON.stringify({
        id: "1",
        status: "UPLOADED",
        sourceQuantity: 1,
        lineQuantity: 1,
      }),
    });
  });

  it("rejects malformed 2xx upload responses", async () => {
    process.env.YANDEX_METRIKA_ID = "109148727";
    process.env.YANDEX_METRIKA_OAUTH_TOKEN = "secret-token";
    globalThis.fetch = async () =>
      new Response('{"uploading":{"comment":"comment1"}}');

    await assert.rejects(
      () =>
        new YandexOfflineConversionsService().upload(
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
      const uploadings =
        urls.length === 1
          ? Array.from({ length: 1_000 }, (_, index) => ({
              comment: index === 0 ? "comment1suffix" : `other${index}`,
              id: index + 1,
            }))
          : [{ comment: "comment1", id: 1001 }];
      return Response.json({ uploadings });
    };

    const service = new YandexOfflineConversionsService();
    const findUploadingByComment = service.findUploadingByComment.bind(
      service,
    ) as (
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
        error instanceof YandexOfflineConversionsHttpError &&
        error.status === 404,
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
            const due = input.where.nextAttemptAt as { lte?: Date } | undefined;
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
        return processedUploading(comment, "1");
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
      AnalyticsOutboxStatus.CONFIRMED,
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
    const prisma = createStatefulPrisma(
      state,
      (data: Record<string, unknown>) => {
        if (data.providerUploadId && failLocalWrite) {
          failLocalWrite = false;
          throw new Error("database unavailable after remote upload");
        }
      },
    );
    const yandex = {
      findUploadingByComment: async (comment: string) =>
        remoteUpload?.comment === comment ? remoteUpload : null,
      findUploadingById: async () => null,
      upload: async (_payload: unknown, comment: string) => {
        uploadCount += 1;
        remoteUpload = processedUploading(comment, "42");
        return remoteUpload;
      },
    };

    await new AnalyticsOutboxService(
      prisma as never,
      yandex as never,
    ).processDueEvents();
    state.status = AnalyticsOutboxStatus.PENDING;
    state.lockedAt = null;
    state.nextAttemptAt = new Date(0);
    await new AnalyticsOutboxService(
      prisma as never,
      yandex as never,
    ).processDueEvents();

    assert.equal(uploadCount, 1);
    assert.equal(state.providerUploadId, "42");
    assert.equal(state.status, AnalyticsOutboxStatus.CONFIRMED);
  });

  it("reconciles a known provider upload id by GET without POST", async () => {
    const state = event({ providerUploadId: "42" });
    let uploadCount = 0;
    let detailCount = 0;
    const comment = deterministicComment(state.id);
    const yandex = {
      findUploadingByComment: async () =>
        assert.fail("comment search is not needed"),
      findUploadingById: async (id: string) => {
        detailCount += 1;
        assert.equal(id, "42");
        return processedUploading(comment, id);
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
    assert.equal(state.status, AnalyticsOutboxStatus.CONFIRMED);
  });

  it("waits for processing after POST, polls the same id and confirms exactly once", async () => {
    const state = event();
    const comment = deterministicComment(state.id);
    let posts = 0;
    let gets = 0;
    const accepted = {
      ...processedUploading(comment, "42"),
      status: "UPLOADED" as const,
    };
    const yandex = {
      findUploadingByComment: async () => null,
      upload: async () => {
        posts += 1;
        return accepted;
      },
      findUploadingById: async (id: string) => {
        assert.equal(id, "42");
        gets += 1;
        return processedUploading(comment, id);
      },
    };
    const worker = new AnalyticsOutboxService(
      createStatefulPrisma(state) as never,
      yandex as never,
    );
    await worker.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.SENT);
    assert.equal(state.providerStatus, "UPLOADED");
    assert.equal(state.providerUploadId, "42");
    assert.equal(state.confirmedAt, null);
    assert.ok(state.sentAt instanceof Date);
    const sentAt = state.sentAt;
    assert.ok(state.nextAttemptAt > new Date());
    await worker.processDueEvents();
    assert.equal(gets, 0, "do not poll before backoff expires");
    state.nextAttemptAt = new Date(0);
    await worker.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.CONFIRMED);
    assert.equal(state.providerStatus, "PROCESSED");
    assert.equal(state.sentAt, sentAt);
    assert.ok((state as AnalyticsOutboxEvent).confirmedAt instanceof Date);
    await worker.processDueEvents();
    assert.equal(posts, 1);
    assert.equal(gets, 1);
  });

  it("rechecks legacy SENT rows without creating another upload", async () => {
    const state = event({
      status: AnalyticsOutboxStatus.SENT,
      providerUploadId: "42",
      sentAt: new Date("2026-09-08T13:04:35Z"),
    });
    const worker = new AnalyticsOutboxService(
      createStatefulPrisma(state) as never,
      {
        findUploadingByComment: async () => assert.fail("must use existing id"),
        upload: async () => assert.fail("must not resend a legacy conversion"),
        findUploadingById: async () => ({
          ...processedUploading(deterministicComment(state.id), "42"),
          status: "LINKAGE_FAILURE",
        }),
      } as never,
    );
    await worker.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.FAILED);
    assert.equal(state.providerStatus, "LINKAGE_FAILURE");
    assert.match(state.lastError ?? "", /YANDEX_LINKAGE_FAILURE/);
    assert.equal(state.confirmedAt, null);
    assert.ok(state.failedAt instanceof Date);
    await worker.processDueEvents();
    assert.equal(state.attempts, 1);
  });

  it("does not POST a legacy accepted event with a missing upload id", async () => {
    const state = event({
      status: AnalyticsOutboxStatus.SENT,
      sentAt: new Date(),
      providerUploadId: null,
    });
    const worker = new AnalyticsOutboxService(
      createStatefulPrisma(state) as never,
      {} as never,
    );
    await worker.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.FAILED);
    assert.match(state.lastError ?? "", /no provider id/);
  });

  for (const status of [
    "PREPARED",
    "UPLOADED",
    "EXPORTED",
    "MATCHED",
    "UNKNOWN",
  ] as const) {
    it(`does not confirm intermediate or unknown provider status ${status}`, async () => {
      const state = event();
      const fixture = createWorkerFixture([state], {
        ...processedUploading(deterministicComment(state.id), "42"),
        status,
      });
      await fixture.service.processDueEvents();
      assert.equal(state.status, AnalyticsOutboxStatus.SENT);
      assert.equal(state.providerStatus, status);
      assert.equal(state.providerUploadId, "42");
      assert.equal(state.confirmedAt, null);
      assert.equal(state.failedAt, null);
      assert.ok(state.nextAttemptAt > new Date());
    });
  }

  it("keeps an upload id when provider verification metadata is malformed", async () => {
    const state = event();
    const fixture = createWorkerFixture([state], {
      ...processedUploading(deterministicComment(state.id), "42"),
      verificationError: "Invalid Yandex line_quantity",
    });
    await fixture.service.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.SENT);
    assert.equal(state.providerUploadId, "42");
    assert.equal(state.lastError, "Invalid Yandex line_quantity");
    assert.equal(state.confirmedAt, null);
  });

  for (const counts of [
    { lineQuantity: 0 },
    { sourceQuantity: 2 },
    { linkedQuantity: 0 },
    { linkedQuantity: 2 },
    { lineQuantity: undefined },
  ]) {
    it(`fails PROCESSED with unexpected conversion counts ${JSON.stringify(counts)}`, async () => {
      const state = event();
      const fixture = createWorkerFixture([state], {
        ...processedUploading(deterministicComment(state.id), "42"),
        ...counts,
      });
      await fixture.service.processDueEvents();
      assert.equal(state.status, AnalyticsOutboxStatus.FAILED);
      assert.equal(state.providerStatus, "PROCESSED");
      assert.equal(state.confirmedAt, null);
      assert.match(state.lastError ?? "", /COUNT_MISMATCH/);
    });
  }

  it("accepts documented PROCESSED success when optional linked_quantity is absent", async () => {
    const state = event();
    const fixture = createWorkerFixture([state], {
      ...processedUploading(deterministicComment(state.id), "42"),
      linkedQuantity: undefined,
    });
    await fixture.service.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.CONFIRMED);
  });

  it("stops checking a non-final upload after 24 hours without another POST", async () => {
    const state = event({
      status: AnalyticsOutboxStatus.SENT,
      providerUploadId: "42",
      sentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    const worker = new AnalyticsOutboxService(
      createStatefulPrisma(state) as never,
      {
        findUploadingById: async () => ({
          ...processedUploading(deterministicComment(state.id), "42"),
          status: "UPLOADED",
        }),
        upload: async () => assert.fail("must not upload again"),
      } as never,
    );
    await worker.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.FAILED);
    assert.match(state.lastError ?? "", /PROCESSING_TIMEOUT/);
  });

  it("retries temporary status lookup errors without uploading again", async () => {
    const state = event({
      status: AnalyticsOutboxStatus.SENT,
      providerUploadId: "42",
      sentAt: new Date(),
    });
    let gets = 0;
    const worker = new AnalyticsOutboxService(
      createStatefulPrisma(state) as never,
      {
        findUploadingById: async () => {
          gets += 1;
          if (gets === 1)
            throw new YandexOfflineConversionsHttpError(503, "unavailable");
          return processedUploading(deterministicComment(state.id), "42");
        },
        upload: async () => assert.fail("must not upload again"),
      } as never,
    );
    await worker.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.PENDING);
    assert.equal(state.providerUploadId, "42");
    state.nextAttemptAt = new Date(0);
    await worker.processDueEvents();
    assert.equal(gets, 2);
    assert.equal(state.status, AnalyticsOutboxStatus.CONFIRMED);
  });

  it("uploads server order_created with its own target and rejects target mismatch", async () => {
    const state = event({
      eventType: "order_created",
      payload: { ...(event().payload as object), target: "order_created" },
    });
    const fixture = createWorkerFixture([state]);
    await fixture.service.processDueEvents();
    assert.equal(state.status, AnalyticsOutboxStatus.CONFIRMED);
    const invalid = event({ eventType: "order_created" });
    const invalidFixture = createWorkerFixture([invalid]);
    await invalidFixture.service.processDueEvents();
    assert.equal(invalid.status, AnalyticsOutboxStatus.FAILED);
    assert.equal(invalidFixture.uploads(), 0);
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
      assert.ok((update?.lastError as string).length < 2000);
      assert.equal(
        (update?.lastError as string).includes("x".repeat(20)),
        false,
      );
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
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      ),
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
    it(`permanently fails HTTP ${status}, clears its lease, and is not retried`, async () => {
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
    });
  }

  it("terminally rejects mismatched outbox identity without contacting Yandex", async () => {
    const fixture = createWorkerFixture([
      event({ id: "invalid-event-type", eventType: "order_unknown" }),
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
      [
        "Analytics event type is invalid",
        "Analytics purchase id does not match aggregate",
      ],
    );
  });
});

function processedUploading(comment: string, id: string): YandexUploading {
  return {
    comment,
    id,
    status: "PROCESSED",
    sourceQuantity: 1,
    lineQuantity: 1,
    linkedQuantity: 1,
    providerResponse: "processed",
  };
}

function createWorkerFixture(
  events: AnalyticsOutboxEvent[],
  result: Response | Error | YandexUploading = processedUploading(
    deterministicComment("event-1"),
    "1",
  ),
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
              (event.status === AnalyticsOutboxStatus.PENDING ||
                event.status === AnalyticsOutboxStatus.SENT) &&
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
    providerStatus: null,
    providerUploadId: null,
    confirmedAt: null,
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
        (state.status === AnalyticsOutboxStatus.PENDING ||
          state.status === AnalyticsOutboxStatus.SENT) &&
        state.nextAttemptAt <= new Date()
          ? [{ ...state }]
          : [],
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
