import "reflect-metadata";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { MODULE_METADATA } from "@nestjs/common/constants";

import { DeliveryModule } from "../src/delivery/delivery.module";
import type { CdekClientService } from "../src/delivery/providers/cdek/cdek-client.service";
import { CdekWebhookService } from "../src/delivery/providers/cdek/cdek-webhook.service";

const expectedUrl =
  "https://api.example.com/orders/delivery/cdek/webhook/webhook-secret";
const expectedWebhook = {
  type: "ORDER_STATUS",
  url: expectedUrl,
  uuid: "new-uuid",
};
const environmentNames = [
  "API_PUBLIC_URL",
  "CDEK_WEBHOOK_SECRET",
  "CDEK_WEBHOOK_AUTO_REGISTER_ENABLED",
] as const;

describe("CdekWebhookService", () => {
  let previousEnvironment: Record<
    (typeof environmentNames)[number],
    string | undefined
  >;

  beforeEach(() => {
    previousEnvironment = {
      API_PUBLIC_URL: process.env.API_PUBLIC_URL,
      CDEK_WEBHOOK_SECRET: process.env.CDEK_WEBHOOK_SECRET,
      CDEK_WEBHOOK_AUTO_REGISTER_ENABLED:
        process.env.CDEK_WEBHOOK_AUTO_REGISTER_ENABLED,
    };
    process.env.API_PUBLIC_URL = "https://api.example.com";
    process.env.CDEK_WEBHOOK_SECRET = "webhook-secret";
    process.env.CDEK_WEBHOOK_AUTO_REGISTER_ENABLED = "true";
  });

  afterEach(() => {
    for (const name of environmentNames) {
      restoreEnvironment(name, previousEnvironment[name]);
    }
  });

  it("registers CdekWebhookService as a delivery provider", () => {
    const providers =
      (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, DeliveryModule) as
        | unknown[]
        | undefined) ?? [];

    assert.equal(providers.includes(CdekWebhookService), true);
  });

  it("creates the expected ORDER_STATUS webhook when none exists", async () => {
    const fixture = createFixture([
      [],
      { entity: { uuid: "new-uuid" } },
      [expectedWebhook],
    ]);

    await fixture.service.reconcileOrderStatusWebhook();

    assert.deepEqual(fixture.calls, [
      { path: "/v2/webhooks", options: undefined },
      {
        path: "/v2/webhooks",
        options: {
          method: "POST",
          body: { type: "ORDER_STATUS", url: expectedUrl },
        },
      },
      { path: "/v2/webhooks", options: undefined },
    ]);
  });

  it("does not create a duplicate exact subscription", async () => {
    const fixture = createFixture([[expectedWebhook]]);

    await fixture.service.reconcileOrderStatusWebhook();

    assert.deepEqual(fixture.calls, [
      { path: "/v2/webhooks", options: undefined },
    ]);
  });

  it("preserves subscriptions during overlapping configuration reconciliations", async () => {
    const oldUrl =
      "https://old-api.example.com/orders/delivery/cdek/webhook/old-secret";
    const subscriptions: Array<{
      type: string;
      url: string;
      uuid: string;
    }> = [];
    const calls: RequestCall[] = [];
    let listRequestCount = 0;
    let resolveInitialLists!: () => void;
    const initialListsReady = new Promise<void>((resolve) => {
      resolveInitialLists = resolve;
    });
    let postRequestCount = 0;
    let resolvePosts!: () => void;
    const postsReady = new Promise<void>((resolve) => {
      resolvePosts = resolve;
    });
    const cdekClient = {
      request: async (path: string, options?: unknown) => {
        calls.push({ path, options });
        const requestOptions = options as
          | {
              method?: string;
              body?: { type: string; url: string };
            }
          | undefined;

        if (requestOptions?.method === "POST") {
          assert.ok(requestOptions.body);
          const uuid =
            requestOptions.body.url === oldUrl ? "old-uuid" : "new-uuid";

          subscriptions.push({ ...requestOptions.body, uuid });
          postRequestCount += 1;

          if (postRequestCount === 2) {
            resolvePosts();
          }

          await postsReady;
          return { entity: { uuid } };
        }

        if (requestOptions?.method === "DELETE") {
          const uuid = decodeURIComponent(path.split("/").at(-1) ?? "");
          const index = subscriptions.findIndex(
            (subscription) => subscription.uuid === uuid,
          );

          if (index !== -1) {
            subscriptions.splice(index, 1);
          }

          return { entity: { uuid } };
        }

        assert.equal(path, "/v2/webhooks");
        const snapshot = subscriptions.map((subscription) => ({
          ...subscription,
        }));

        listRequestCount += 1;

        if (listRequestCount <= 2) {
          if (listRequestCount === 2) {
            resolveInitialLists();
          }

          await initialListsReady;
        }

        return snapshot;
      },
    } as unknown as CdekClientService;
    const oldService = new CdekWebhookService(cdekClient);
    const newService = new CdekWebhookService(cdekClient);

    process.env.API_PUBLIC_URL = "https://old-api.example.com";
    process.env.CDEK_WEBHOOK_SECRET = "old-secret";
    const oldReconciliation = oldService.reconcileOrderStatusWebhook();

    process.env.API_PUBLIC_URL = "https://api.example.com";
    process.env.CDEK_WEBHOOK_SECRET = "webhook-secret";
    const newReconciliation = newService.reconcileOrderStatusWebhook();

    await Promise.all([oldReconciliation, newReconciliation]);

    assert.equal(
      calls.some(
        (call) =>
          (call.options as { method?: string } | undefined)?.method ===
          "DELETE",
      ),
      false,
    );
    assert.deepEqual(
      subscriptions.map((subscription) => subscription.url).sort(),
      [oldUrl, expectedUrl].sort(),
    );
  });

  it("creates and confirms the expected webhook while preserving a stale ORDER_STATUS webhook", async () => {
    const stale = {
      type: "ORDER_STATUS",
      url: "https://old.example.com/cdek",
      uuid: "stale-uuid",
    };
    const fixture = createFixture([
      [stale],
      { entity: { uuid: "new-uuid" } },
      [stale, expectedWebhook],
    ]);

    await fixture.service.reconcileOrderStatusWebhook();

    assert.deepEqual(fixture.calls, [
      { path: "/v2/webhooks", options: undefined },
      {
        path: "/v2/webhooks",
        options: {
          method: "POST",
          body: { type: "ORDER_STATUS", url: expectedUrl },
        },
      },
      { path: "/v2/webhooks", options: undefined },
    ]);
  });

  it("never deletes a webhook of another type", async () => {
    const fixture = createFixture([
      [
        expectedWebhook,
        {
          type: "PRINT_FORM",
          url: "https://example.com/print-form",
          uuid: "print-form-uuid",
        },
      ],
    ]);

    await fixture.service.reconcileOrderStatusWebhook();

    assert.deepEqual(fixture.calls, [
      { path: "/v2/webhooks", options: undefined },
    ]);
  });

  it("refuses replacement when both CDEK webhook slots are occupied", async () => {
    const fixture = createFixture([
      [
        {
          type: "ORDER_STATUS",
          url: "https://old.example.com/cdek",
          uuid: "stale-uuid",
        },
        {
          type: "PRINT_FORM",
          url: "https://example.com/print-form",
          uuid: "print-form-uuid",
        },
      ],
    ]);

    await assert.rejects(
      fixture.service.reconcileOrderStatusWebhook(),
      /CDEK webhook limit is full/,
    );
    assert.equal(fixture.calls.length, 1);
  });

  it("does not contact CDEK on bootstrap when auto-registration is disabled", () => {
    process.env.CDEK_WEBHOOK_AUTO_REGISTER_ENABLED = "false";
    const fixture = createFixture([]);

    fixture.service.onApplicationBootstrap();

    assert.deepEqual(fixture.calls, []);
  });

  it("contains reconciliation errors during bootstrap", async () => {
    process.env.CDEK_WEBHOOK_AUTO_REGISTER_ENABLED = "true";
    const fixture = createFixture([]);
    let logged = false;
    const protectedService = fixture.service as unknown as {
      logger: { error: () => void };
      reconcileOrderStatusWebhook: () => Promise<void>;
    };

    protectedService.logger.error = () => {
      logged = true;
    };
    protectedService.reconcileOrderStatusWebhook = async () => {
      throw new Error("upstream unavailable");
    };

    fixture.service.onApplicationBootstrap();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(logged, true);
  });
});

type RequestCall = {
  path: string;
  options: unknown;
};

function createFixture(responses: unknown[]) {
  const calls: RequestCall[] = [];
  let responseIndex = 0;
  const cdekClient = {
    request: async (path: string, options?: unknown) => {
      calls.push({ path, options });

      if (responseIndex >= responses.length) {
        throw new Error(`Unexpected CDEK request to ${path}`);
      }

      return responses[responseIndex++];
    },
  } as unknown as CdekClientService;

  return {
    calls,
    service: new CdekWebhookService(cdekClient),
  };
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
