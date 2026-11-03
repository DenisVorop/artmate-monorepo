import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { PGlite, type Transaction } from "@electric-sql/pglite";

import { OrderStatusMonitorService } from "../src/cron/order-status-monitor.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { Prisma } from "../src/generated/prisma/client";
import { publishAdminNotice } from "../src/notifications/contracts/admin-notice-command.contract";
import { AdminTelegramAdapter } from "../src/notifications/integrations/admin-telegram.adapter";
import { NotificationQueueService } from "../src/notifications/notification-queue.service";

describe("administrative notification transactions", () => {
  let db: PGlite;
  let failNotification = false;
  let lockAvailable = true;
  let monitor: OrderStatusMonitorService;
  const originalEnv = {
    key: process.env.OZON_API_KEY,
    client: process.env.OZON_CLIENT_ID,
  };

  function writer(tx: Transaction) {
    return {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const sql = strings.join("");
        if (sql.includes("pg_try_advisory_xact_lock"))
          return [{ locked: lockAvailable }];
        return (await tx.query(sql)).rows;
      },
      adminNotificationIncident: {
        upsert: async ({ where }: { where: { key: string } }) =>
          (
            await tx.query(
              "INSERT INTO admin_notification_incidents (key) VALUES ($1) ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING *",
              [where.key],
            )
          ).rows[0],
        update: async ({
          where,
          data,
        }: {
          where: { key: string };
          data: { active: boolean; openedAt: Date | null };
        }) =>
          tx.query(
            "UPDATE admin_notification_incidents SET active = $2, opened_at = $3 WHERE key = $1",
            [where.key, data.active, data.openedAt],
          ),
      },
      notificationJob: {
        create: async ({
          data,
        }: {
          data: { id?: string; payload: unknown };
        }) => {
          if (failNotification)
            throw new Error("notification insert unavailable");
          await tx.query(
            "INSERT INTO notification_jobs (id, payload) VALUES ($1, $2)",
            [data.id ?? randomUUID(), JSON.stringify(data.payload)],
          );
        },
      },
    } as unknown as Prisma.TransactionClient;
  }

  function service() {
    return new OrderStatusMonitorService({
      $transaction: (
        callback: (tx: Prisma.TransactionClient) => Promise<void>,
      ) => db.transaction((tx) => callback(writer(tx))),
    } as unknown as PrismaService);
  }

  before(async () => {
    db = new PGlite();
    await db.exec(
      await readFile(
        resolve(
          __dirname,
          "../prisma/migrations/20261103160000_admin_notification_incidents/migration.sql",
        ),
        "utf8",
      ),
    );
    await db.exec(`
      CREATE TABLE notification_jobs (id TEXT PRIMARY KEY, payload JSONB NOT NULL);
      CREATE TABLE delivery_tracking_requests (order_id TEXT PRIMARY KEY, revision TEXT, provider TEXT, enabled BOOLEAN, updated_at TIMESTAMP);
      CREATE TABLE delivery_tracking_observations (order_id TEXT PRIMARY KEY, revision TEXT, last_error TEXT, checked_at TIMESTAMP, locked_until TIMESTAMP, states JSONB DEFAULT '[]');
      CREATE TABLE delivery_completion_events (id TEXT PRIMARY KEY, observed_at TIMESTAMP);
      CREATE TABLE order_delivery_completion_receipts (event_id TEXT PRIMARY KEY);
    `);
  });

  after(async () => {
    if (originalEnv.key === undefined) delete process.env.OZON_API_KEY;
    else process.env.OZON_API_KEY = originalEnv.key;
    if (originalEnv.client === undefined) delete process.env.OZON_CLIENT_ID;
    else process.env.OZON_CLIENT_ID = originalEnv.client;
    await db.close();
  });

  beforeEach(async () => {
    await db.exec(
      "TRUNCATE admin_notification_incidents, notification_jobs, delivery_tracking_requests, delivery_tracking_observations, delivery_completion_events, order_delivery_completion_receipts",
    );
    failNotification = false;
    lockAvailable = true;
    process.env.OZON_API_KEY = "private-test-key";
    process.env.OZON_CLIENT_ID = "private-test-client";
    monitor = service();
  });

  async function seed(error: string | null = null) {
    await db.exec(
      "INSERT INTO delivery_tracking_requests VALUES ('AM-TEST', 'revision-1', 'ozon', true, now())",
    );
    await db.query(
      "INSERT INTO delivery_tracking_observations (order_id, revision, last_error, checked_at, states) VALUES ('AM-TEST', 'revision-1', $1, now(), '[{\"state\":\"in_transit\"}]')",
      [error],
    );
  }

  async function notices() {
    return (
      await db.query<{
        payload: { title: string; lines: string[]; kind: string };
      }>("SELECT payload FROM notification_jobs ORDER BY ctid")
    ).rows.map(({ payload }) => payload);
  }

  it("does not alert for healthy jobs, no active deliveries, or work claimed by another replica", async () => {
    await monitor.check();
    await seed();
    await monitor.check();
    lockAvailable = false;
    await db.exec(
      "UPDATE delivery_tracking_observations SET last_error = 'access_denied'",
    );
    await monitor.check();
    assert.deepEqual(await notices(), []);
  });

  it("reports denied access once across cron runs/restarts and reports actual recovery once", async () => {
    await seed("access_denied");
    await monitor.check();
    await service().check();
    let messages = await notices();
    assert.equal(messages.length, 1);
    assert.match(messages[0]!.lines.join(" "), /Ozon отклонил доступ/);
    assert.doesNotMatch(JSON.stringify(messages), /private-test-/);

    await db.exec(
      "UPDATE delivery_tracking_observations SET checked_at = NULL, last_error = NULL, states = '[]', locked_until = now() + interval '10 minutes'",
    );
    await monitor.check();
    assert.equal(
      (await notices()).length,
      1,
      "in-flight leases cannot confirm recovery",
    );

    await db.exec(
      "UPDATE delivery_tracking_observations SET checked_at = now(), locked_until = NULL",
    );
    await monitor.check();
    await service().check();
    messages = await notices();
    assert.equal(messages.length, 2);
    assert.match(messages[1]!.title, /восстановлено/);
  });

  it("alerts immediately for missing credentials only when there are active requests", async () => {
    delete process.env.OZON_API_KEY;
    await monitor.check();
    assert.equal((await notices()).length, 0);
    await seed();
    await monitor.check();
    assert.match((await notices())[0]!.lines.join(" "), /Не настроен доступ/);
  });

  it("closes an incident without claiming recovery when no active requests remain", async () => {
    await seed("access_denied");
    await monitor.check();
    await db.exec("UPDATE delivery_tracking_requests SET enabled = false");
    await monitor.check();
    const messages = await notices();
    assert.equal(messages.length, 2);
    assert.match(messages[1]!.title, /активных заказов больше нет/);
    assert.doesNotMatch(messages[1]!.title, /восстановлено/);
  });

  it("detects stale checks and abandoned leases but waits for a live lease", async () => {
    await seed();
    await db.exec(
      "UPDATE delivery_tracking_observations SET checked_at = now() - interval '16 minutes', locked_until = now() + interval '1 minute'",
    );
    await monitor.check();
    assert.equal((await notices()).length, 0);
    await db.exec(
      "UPDATE delivery_tracking_observations SET locked_until = NULL",
    );
    await monitor.check();
    assert.match((await notices())[0]!.lines.join(" "), /Просрочены проверки/);
  });

  it("alerts for a never-started request after the grace period", async () => {
    await db.exec(
      "INSERT INTO delivery_tracking_requests VALUES ('AM-TEST', 'revision-1', 'ozon', true, now() - interval '16 minutes')",
    );
    await monitor.check();
    assert.match((await notices())[0]!.lines.join(" "), /Просрочены проверки/);
  });

  it("detects an abandoned claim even when no previous check was completed", async () => {
    await seed();
    await db.exec(
      "UPDATE delivery_tracking_observations SET checked_at = NULL, locked_until = now() - interval '1 minute'",
    );
    await monitor.check();
    assert.match(
      (await notices())[0]!.lines.join(" "),
      /истёк срок выполнения проверки/,
    );
  });

  it("ignores previous revisions and alerts on unknown current provider statuses", async () => {
    await seed("access_denied");
    await db.exec(
      "UPDATE delivery_tracking_requests SET revision = 'revision-2'",
    );
    await monitor.check();
    assert.equal((await notices()).length, 0);
    await db.exec(
      "UPDATE delivery_tracking_observations SET revision = 'revision-2', last_error = NULL, states = '[{\"state\":\"unknown\"}]'",
    );
    await monitor.check();
    assert.match((await notices())[0]!.lines.join(" "), /неизвестный статус/);
  });

  it("detects delayed completion processing and recovers when the receipt is committed", async () => {
    await db.exec(
      "INSERT INTO delivery_completion_events VALUES ('event-1', now() - interval '4 minutes')",
    );
    await monitor.check();
    await service().check();
    assert.equal((await notices()).length, 1);
    assert.match((await notices())[0]!.title, /Не завершается/);
    await db.exec(
      "INSERT INTO order_delivery_completion_receipts VALUES ('event-1')",
    );
    await monitor.check();
    assert.equal((await notices()).length, 2);
    assert.match((await notices())[1]!.title, /восстановлена/);
  });

  it("rolls back the incident transition when queuing fails and retries next run", async () => {
    await seed("provider_unavailable");
    failNotification = true;
    await assert.rejects(monitor.check(), /notification insert unavailable/);
    assert.equal(
      (await db.query("SELECT * FROM admin_notification_incidents")).rows
        .length,
      0,
    );
    failNotification = false;
    await monitor.check();
    assert.equal((await notices()).length, 1);
  });

  it("commits a moderation event and its notice together, with a unique revision job identity", async () => {
    const command = {
      title: "Новая работа на модерации",
      lines: ["Картина № 17: Рыжий кот"],
      adminPath: `/workshop-moderation/${"a".repeat(32)}`,
      actionLabel: "Проверить работу",
    };
    await assert.rejects(
      db.transaction(async (tx) => {
        await publishAdminNotice(
          writer(tx),
          command,
          "workshop-moderation:revision-1",
        );
        throw new Error("revision transaction failed");
      }),
      /revision transaction failed/,
    );
    assert.equal((await notices()).length, 0);
    await db.transaction((tx) =>
      publishAdminNotice(writer(tx), command, "workshop-moderation:revision-1"),
    );
    await assert.rejects(
      db.transaction((tx) =>
        publishAdminNotice(
          writer(tx),
          command,
          "workshop-moderation:revision-1",
        ),
      ),
    );
    assert.equal((await notices()).length, 1);
  });
});

describe("admin Telegram delivery", () => {
  const originalEnv = {
    chat: process.env.TELEGRAM_ORDERS_CHAT_ID,
    fallback: process.env.TELEGRAM_CONTACTS_CHAT_ID,
    admin: process.env.ADMIN_URL,
  };
  const command = {
    kind: "admin_notice",
    contractVersion: 1,
    title: "Новая работа <на проверке>",
    lines: ["Картина: Кот & сова"],
    adminPath: `/workshop-moderation/${"a".repeat(32)}`,
    actionLabel: "Проверить работу",
  };
  beforeEach(() => {
    process.env.TELEGRAM_ORDERS_CHAT_ID = "admin-chat";
    process.env.TELEGRAM_CONTACTS_CHAT_ID = "fallback-chat";
    process.env.ADMIN_URL = "https://admin.example.test";
  });
  after(() => {
    for (const [name, value] of Object.entries({
      TELEGRAM_ORDERS_CHAT_ID: originalEnv.chat,
      TELEGRAM_CONTACTS_CHAT_ID: originalEnv.fallback,
      ADMIN_URL: originalEnv.admin,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("routes to the administrative bot/chat, escapes user text and links to authenticated moderation", () => {
    const message = AdminTelegramAdapter.prepare(command);
    assert.equal(message.bot, "orders");
    assert.equal(message.chatId, "admin-chat");
    assert.match(message.text, /&lt;на проверке&gt;/);
    assert.match(message.text, /Кот &amp; сова/);
    assert.equal(
      message.replyMarkup.inline_keyboard[0]![0]!.url,
      `https://admin.example.test${command.adminPath}`,
    );
    assert.doesNotMatch(JSON.stringify(message), /assets\/|storageKey/);
    delete process.env.TELEGRAM_ORDERS_CHAT_ID;
    assert.equal(AdminTelegramAdapter.prepare(command).chatId, "fallback-chat");
  });

  it("rejects invalid contracts and untrusted destinations rather than sending malformed notices", () => {
    for (const adminPath of [
      "//evil.test/orders",
      "https://evil.test",
      "/orders?token=secret",
      "/workshop-moderation/invalid",
    ])
      assert.throws(() =>
        AdminTelegramAdapter.prepare({ ...command, adminPath }),
      );
    assert.throws(() =>
      AdminTelegramAdapter.prepare({ ...command, contractVersion: 2 }),
    );
    delete process.env.TELEGRAM_ORDERS_CHAT_ID;
    delete process.env.TELEGRAM_CONTACTS_CHAT_ID;
    assert.throws(
      () => AdminTelegramAdapter.prepare(command),
      /not configured/,
    );
  });

  it("dispatches persisted admin notices through the existing Telegram sender", async () => {
    const queue = Object.create(NotificationQueueService.prototype) as {
      dispatchJob(job: { channel: string; payload: unknown }): Promise<void>;
      sendTelegram: (message: unknown) => Promise<void>;
    };
    const sent: unknown[] = [];
    queue.sendTelegram = async (message) => {
      sent.push(message);
    };
    await queue.dispatchJob({ channel: "TELEGRAM", payload: command });
    assert.deepEqual(sent, [AdminTelegramAdapter.prepare(command)]);
  });

  it("preserves existing customer and order Telegram payloads", async () => {
    const queue = Object.create(NotificationQueueService.prototype) as {
      dispatchJob(job: { channel: string; payload: unknown }): Promise<void>;
      sendTelegram: (message: unknown) => Promise<void>;
    };
    const sent: unknown[] = [];
    queue.sendTelegram = async (message) => {
      sent.push(message);
    };
    for (const bot of ["orders", "mini_app"]) {
      const message = {
        bot,
        chatId: "existing-chat",
        text: "Заказ оплачен",
        disableWebPagePreview: true,
        parseMode: "HTML",
        replyMarkup: {
          inline_keyboard: [
            [{ text: "Заказ", url: "https://artmate.ru/account/orders" }],
          ],
        },
      };
      await queue.dispatchJob({ channel: "TELEGRAM", payload: message });
      assert.deepEqual(sent.at(-1), message);
    }
  });
});
