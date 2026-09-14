import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  YandexOfflineConversionsHttpError,
  YandexOfflineConversionsService,
  type YandexOrderConversionPayload,
} from "../src/analytics/yandex-offline-conversions.service";

const originalFetch = globalThis.fetch;
const originalCounterId = process.env.YANDEX_METRIKA_ID;
const originalToken = process.env.YANDEX_METRIKA_OAUTH_TOKEN;

beforeEach(() => {
  process.env.YANDEX_METRIKA_ID = "109148727";
  process.env.YANDEX_METRIKA_OAUTH_TOKEN = "secret-token";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("YANDEX_METRIKA_ID", originalCounterId);
  restoreEnv("YANDEX_METRIKA_OAUTH_TOKEN", originalToken);
});

describe("Yandex uploading verification contract", () => {
  for (const status of [
    "PREPARED",
    "UPLOADED",
    "EXPORTED",
    "MATCHED",
    "PROCESSED",
    "LINKAGE_FAILURE",
  ]) {
    it(`preserves documented status ${status} independently from upload acceptance`, async () => {
      respond({ status, source_quantity: 1, line_quantity: 1 });

      const uploading =
        await new YandexOfflineConversionsService().findUploadingById("42");

      assert.equal(uploading.status, status);
      assert.equal(uploading.id, "42");
      assert.equal(uploading.sourceQuantity, 1);
      assert.equal(uploading.lineQuantity, 1);
      assert.equal(uploading.linkedQuantity, undefined);
      assert.equal(uploading.verificationError, undefined);
    });
  }

  it("returns the matched visitor count when the provider supplies it", async () => {
    respond({
      status: "PROCESSED",
      source_quantity: 1,
      line_quantity: 1,
      linked_quantity: 1,
    });

    const uploading =
      await new YandexOfflineConversionsService().findUploadingById("42");

    assert.equal(uploading.linkedQuantity, 1);
    assert.equal(uploading.status, "PROCESSED");
  });

  it("does not manufacture validation or linkage counts", async () => {
    respond({ status: "PROCESSED" });

    const uploading =
      await new YandexOfflineConversionsService().findUploadingById("42");

    assert.equal(uploading.sourceQuantity, undefined);
    assert.equal(uploading.lineQuantity, undefined);
    assert.equal(uploading.linkedQuantity, undefined);
  });

  it("normalizes the provider creation time without exposing extra response fields", async () => {
    respond({
      status: "PROCESSED",
      create_time: "2026-09-08T19:04:09+03:00",
      source_quantity: 1,
      line_quantity: 1,
      client_id: "private-client-id",
      customerEmail: "private@example.com",
      errors: [{ message: "phone +79999999999, token secret-token" }],
    });

    const uploading =
      await new YandexOfflineConversionsService().findUploadingById("42");

    assert.equal(uploading.createTime, "2026-09-08T16:04:09.000Z");
    assert.deepEqual(JSON.parse(uploading.providerResponse), {
      id: "42",
      status: "PROCESSED",
      createTime: "2026-09-08T16:04:09.000Z",
      sourceQuantity: 1,
      lineQuantity: 1,
    });
    assert.doesNotMatch(
      JSON.stringify(uploading),
      /private|79999999999|secret-token/,
    );
  });

  for (const status of [undefined, null, "NEW_STATUS", "processed", 1, {}]) {
    it(`keeps the accepted upload ID and makes an unsupported status ${JSON.stringify(status)} unverifiable`, async () => {
      respond({ status, source_quantity: 1, line_quantity: 1 });

      const uploading =
        await new YandexOfflineConversionsService().findUploadingById("42");

      assert.equal(uploading.id, "42");
      assert.equal(uploading.status, "UNKNOWN");
      assert.match(
        uploading.verificationError ?? "",
        /status is missing or unsupported/,
      );
    });
  }

  for (const field of ["source_quantity", "line_quantity", "linked_quantity"]) {
    for (const value of [null, "1", -1, 0.5, Number.MAX_SAFE_INTEGER + 1, {}]) {
      it(`does not verify PROCESSED with invalid ${field}=${JSON.stringify(value)}`, async () => {
        respond({
          status: "PROCESSED",
          source_quantity: 1,
          line_quantity: 1,
          [field]: value,
        });

        const uploading =
          await new YandexOfflineConversionsService().findUploadingById("42");

        assert.equal(uploading.id, "42");
        assert.equal(uploading.status, "UNKNOWN");
        assert.equal(
          uploading.verificationError,
          "Yandex upload quantity is invalid",
        );
      });
    }
  }

  it("retains zero counts so the worker can detect unmatched and rejected rows", async () => {
    respond({
      status: "LINKAGE_FAILURE",
      source_quantity: 1,
      line_quantity: 0,
      linked_quantity: 0,
    });

    const uploading =
      await new YandexOfflineConversionsService().findUploadingById("42");

    assert.equal(uploading.status, "LINKAGE_FAILURE");
    assert.equal(uploading.lineQuantity, 0);
    assert.equal(uploading.linkedQuantity, 0);
  });

  it("rejects inconsistent validation counts without losing the upload ID", async () => {
    respond({ status: "PROCESSED", source_quantity: 1, line_quantity: 2 });

    const uploading =
      await new YandexOfflineConversionsService().findUploadingById("42");

    assert.equal(uploading.id, "42");
    assert.equal(uploading.status, "UNKNOWN");
    assert.equal(
      uploading.verificationError,
      "Yandex upload quantities are inconsistent",
    );
  });

  it("does not retain malformed creation timestamps or raw status text", async () => {
    respond({
      status: "PROCESSED private@example.com",
      create_time: "secret-token",
    });

    const uploading =
      await new YandexOfflineConversionsService().findUploadingById("42");

    assert.equal(uploading.id, "42");
    assert.equal(uploading.status, "UNKNOWN");
    assert.equal(uploading.createTime, undefined);
    assert.doesNotMatch(
      JSON.stringify(uploading),
      /private@example.com|secret-token/,
    );
  });

  for (const target of ["order_created", "order_paid"] as const) {
    it(`uploads a ${target} conversion and preserves an accepted ID with incomplete metadata`, async () => {
      let csv = "";
      const sequence: string[] = [];
      globalThis.fetch = async (_input, init) => {
        sequence.push("fetch");
        assert.equal(init?.method, "POST");
        assert.ok(init.body instanceof FormData);
        const file = init.body.get("file");
        assert.ok(file instanceof File);
        csv = await file.text();
        return Response.json({ uploading: { id: 42, comment: "comment1" } });
      };
      const payload: YandexOrderConversionPayload = {
        clientId: "123456",
        currency: "RUB",
        dateTime: 1788611696,
        price: "799.00",
        purchaseId: "AM-1",
        target,
      };

      const uploading = await new YandexOfflineConversionsService().upload(
        payload,
        "comment1",
        async () => {
          sequence.push("beforeRequest");
        },
      );

      assert.equal(
        csv,
        `ClientId,Yclid,PurchaseId,Target,DateTime,Price,Currency\r\n123456,,AM-1,${target},1788611696,799.00,RUB\r\n`,
      );
      assert.equal(uploading.id, "42");
      assert.equal(uploading.status, "UNKNOWN");
      assert.deepEqual(sequence, ["beforeRequest", "fetch"]);
    });
  }

  it("returns only the matching upload diagnostic after comment-based crash recovery", async () => {
    globalThis.fetch = async () =>
      Response.json({
        uploadings: [
          {
            id: 41,
            comment: "private@example.com",
            status: "PROCESSED",
            secret: "secret-token",
          },
          {
            id: 42,
            comment: "comment1",
            status: "UPLOADED",
            source_quantity: 1,
            line_quantity: 1,
          },
        ],
      });

    const uploading =
      await new YandexOfflineConversionsService().findUploadingByComment(
        "comment1",
      );

    assert.equal(uploading?.id, "42");
    assert.equal(uploading?.status, "UPLOADED");
    assert.doesNotMatch(JSON.stringify(uploading), /private|secret-token/);
  });

  it("keeps HTTP error classification without persisting provider messages or CSV rows", async () => {
    globalThis.fetch = async () =>
      Response.json(
        {
          errors: [
            {
              error_type: "invalid_parameter",
              message: "Invalid row: private@example.com, +79999999999",
            },
            { message: "OAuth secret-token" },
          ],
        },
        { status: 422 },
      );

    await assert.rejects(
      () => new YandexOfflineConversionsService().findUploadingById("42"),
      (error: unknown) => {
        assert.ok(error instanceof YandexOfflineConversionsHttpError);
        assert.equal(error.status, 422);
        assert.deepEqual(JSON.parse(error.providerResponse), {
          httpStatus: 422,
          errorCount: 2,
        });
        assert.doesNotMatch(
          `${error.message} ${error.providerResponse}`,
          /private|79999999999|secret-token/,
        );
        return true;
      },
    );
  });

  it("does not persist HTML or unstructured provider error bodies", async () => {
    globalThis.fetch = async () =>
      new Response("<html>private@example.com secret-token</html>", {
        status: 503,
      });

    await assert.rejects(
      () => new YandexOfflineConversionsService().findUploadingById("42"),
      (error: unknown) => {
        assert.ok(error instanceof YandexOfflineConversionsHttpError);
        assert.equal(error.providerResponse, '{"httpStatus":503}');
        assert.doesNotMatch(error.message, /private|secret-token/);
        return true;
      },
    );
  });
});

function respond(fields: Record<string, unknown>) {
  globalThis.fetch = async () =>
    Response.json({ uploading: { id: 42, comment: "comment1", ...fields } });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
