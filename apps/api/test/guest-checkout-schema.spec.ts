import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const schemaDirectory = resolve(__dirname, "../prisma/schema");
const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260905120000_add_guest_checkout_activation_outbox/migration.sql",
);
const recoveryMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260907120000_add_order_payment_recovery_markers/migration.sql",
);
const analyticsUploadMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260907143000_add_analytics_provider_upload_id/migration.sql",
);

describe("guest checkout schema", () => {
  it("maps guest checkout, activation, throttle, and analytics persistence", async () => {
    const [ordersSchema, authSchema, usersSchema] = await Promise.all([
      readFile(resolve(schemaDirectory, "orders.prisma"), "utf8"),
      readFile(resolve(schemaDirectory, "auth.prisma"), "utf8"),
      readFile(resolve(schemaDirectory, "users.prisma"), "utf8"),
    ]);

    assert.match(
      ordersSchema,
      /checkoutAttemptId\s+String\?\s+@unique\s+@map\("checkout_attempt_id"\)\s+@db\.VarChar\(128\)/,
    );
    assert.match(
      ordersSchema,
      /checkoutPayloadFingerprint\s+String\?\s+@map\("checkout_payload_fingerprint"\)\s+@db\.Char\(64\)/,
    );
    assert.match(
      ordersSchema,
      /yandexClientId\s+String\?\s+@map\("yandex_client_id"\)\s+@db\.VarChar\(128\)/,
    );
    assert.match(
      ordersSchema,
      /yandexYclid\s+String\?\s+@map\("yandex_yclid"\)\s+@db\.VarChar\(128\)/,
    );
    assert.match(
      ordersSchema,
      /customerPhone\s+String\s+@map\("customer_phone"\)\s+@db\.VarChar\(80\)/,
    );
    assert.match(ordersSchema, /model OrderCheckoutThrottle\s*{/);
    assert.match(
      ordersSchema,
      /terminalPaymentFailedAt\s+DateTime\?\s+@map\("terminal_payment_failed_at"\)/,
    );
    assert.match(
      ordersSchema,
      /cartRestoredAt\s+DateTime\?\s+@map\("cart_restored_at"\)/,
    );
    assert.match(
      ordersSchema,
      /cartConsumedAt\s+DateTime\?\s+@map\("cart_consumed_at"\)/,
    );
    assert.match(
      ordersSchema,
      /cartConsumedQuantities\s+Json\?\s+@map\("cart_consumed_quantities"\)\s+@db\.JsonB/,
    );
    assert.match(
      ordersSchema,
      /cartRestoredQuantities\s+Json\?\s+@map\("cart_restored_quantities"\)\s+@db\.JsonB/,
    );
    assert.match(authSchema, /model AuthOrderActivationToken\s*{/);
    assert.match(
      authSchema,
      /model AuthOrderActivationToken\s*{[\s\S]*?id\s+String\s+@id\s+@db\.VarChar\(32\)/,
    );
    assert.match(
      authSchema,
      /model AuthOrderActivationToken\s*{[\s\S]*?user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/,
    );
    assert.match(
      usersSchema,
      /orderActivationTokens\s+AuthOrderActivationToken\[\]/,
    );
    assert.match(authSchema, /model AuthRecoveryThrottle\s*{/);
    assert.match(
      authSchema,
      /@@unique\(\[scope, subjectHash\]\)/,
    );
    assert.match(
      authSchema,
      /providerUserId\s+String\s+@map\("provider_user_id"\)\s+@db\.VarChar\(320\)/,
    );

    const analyticsSchema = await readFile(
      resolve(schemaDirectory, "analytics.prisma"),
      "utf8",
    );
    assert.match(
      analyticsSchema,
      /@@unique\(\[eventType, aggregateId\]\)/,
    );
    assert.match(
      analyticsSchema,
      /@@index\(\[status, nextAttemptAt, createdAt\]\)/,
    );
    assert.match(analyticsSchema, /@@index\(\[status, lockedAt\]\)/);

    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE "users" ("id" TEXT PRIMARY KEY);
        CREATE TABLE "auth_accounts" (
          "provider" TEXT NOT NULL,
          "provider_user_id" VARCHAR(191) NOT NULL
        );
        CREATE UNIQUE INDEX "auth_accounts_provider_provider_user_id_key"
          ON "auth_accounts"("provider", "provider_user_id");
        CREATE TABLE "orders" (
          "id" VARCHAR(32) PRIMARY KEY,
          "user_id" TEXT NOT NULL,
          "customer_phone" VARCHAR(80) NOT NULL
        );
      `);
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(await readFile(recoveryMigrationPath, "utf8"));
      await db.exec(await readFile(analyticsUploadMigrationPath, "utf8"));

      const columns = await db.query<{
        columnName: string;
        dataType: string;
        isNullable: string;
        maximumLength: number | null;
      }>(`
        SELECT column_name AS "columnName", data_type AS "dataType",
               is_nullable AS "isNullable",
               character_maximum_length AS "maximumLength"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orders'
          AND column_name IN (
             'user_id', 'customer_phone', 'checkout_attempt_id',
             'checkout_payload_fingerprint',
             'yandex_client_id', 'yandex_yclid',
             'terminal_payment_failed_at', 'cart_restored_at',
              'cart_consumed_at', 'cart_consumed_quantities',
              'cart_restored_quantities'
          )
        ORDER BY column_name
      `);
      assert.deepEqual(columns.rows, [
        {
          columnName: "cart_consumed_at",
          dataType: "timestamp without time zone",
          isNullable: "YES",
          maximumLength: null,
        },
        {
          columnName: "cart_consumed_quantities",
          dataType: "jsonb",
          isNullable: "YES",
          maximumLength: null,
        },
        {
          columnName: "cart_restored_at",
          dataType: "timestamp without time zone",
          isNullable: "YES",
          maximumLength: null,
        },
        {
          columnName: "cart_restored_quantities",
          dataType: "jsonb",
          isNullable: "YES",
          maximumLength: null,
        },
        {
          columnName: "checkout_attempt_id",
          dataType: "character varying",
          isNullable: "YES",
          maximumLength: 128,
        },
        {
          columnName: "checkout_payload_fingerprint",
          dataType: "character",
          isNullable: "YES",
          maximumLength: 64,
        },
        {
          columnName: "customer_phone",
          dataType: "character varying",
          isNullable: "NO",
          maximumLength: 80,
        },
        {
          columnName: "terminal_payment_failed_at",
          dataType: "timestamp without time zone",
          isNullable: "YES",
          maximumLength: null,
        },
        {
          columnName: "user_id",
          dataType: "text",
          isNullable: "YES",
          maximumLength: null,
        },
        {
          columnName: "yandex_client_id",
          dataType: "character varying",
          isNullable: "YES",
          maximumLength: 128,
        },
        {
          columnName: "yandex_yclid",
          dataType: "character varying",
          isNullable: "YES",
          maximumLength: 128,
        },
      ]);

      const activationId = await db.query<{
        dataType: string;
        maximumLength: number | null;
      }>(`
        SELECT data_type AS "dataType",
               character_maximum_length AS "maximumLength"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'auth_order_activation_tokens'
          AND column_name = 'id'
      `);
      assert.deepEqual(activationId.rows, [
        { dataType: "character varying", maximumLength: 32 },
      ]);

      const providerUserId = await db.query<{
        dataType: string;
        maximumLength: number | null;
      }>(`
        SELECT data_type AS "dataType",
               character_maximum_length AS "maximumLength"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'auth_accounts'
          AND column_name = 'provider_user_id'
      `);
      assert.deepEqual(providerUserId.rows, [
        { dataType: "character varying", maximumLength: 320 },
      ]);
      const longEmail = `${"a".repeat(200)}@example.com`;
      await db.query(
        `INSERT INTO "auth_accounts" ("provider", "provider_user_id") VALUES ('credentials', $1)`,
        [longEmail],
      );
      await assert.rejects(
        db.query(
          `INSERT INTO "auth_accounts" ("provider", "provider_user_id") VALUES ('credentials', $1)`,
          [longEmail],
        ),
        /unique constraint/i,
      );

      await assert.rejects(
        db.exec(`
          INSERT INTO "auth_order_activation_tokens"
            ("id", "user_id", "token_hash", "expires_at")
          VALUES ('missing-user-token', 'missing-user', 'missing-user-hash', CURRENT_TIMESTAMP);
        `),
        /foreign key constraint/i,
      );
      await db.exec(`
        INSERT INTO "users" ("id") VALUES ('activation-user');
        INSERT INTO "auth_order_activation_tokens"
          ("id", "user_id", "token_hash", "expires_at")
        VALUES ('activation-token', 'activation-user', 'activation-hash', CURRENT_TIMESTAMP);
        UPDATE "users" SET "id" = 'activation-user-updated'
        WHERE "id" = 'activation-user';
      `);
      const updatedActivationTokens = await db.query<{ userId: string }>(`
        SELECT "user_id" AS "userId"
        FROM "auth_order_activation_tokens"
        WHERE "id" = 'activation-token'
      `);
      assert.deepEqual(updatedActivationTokens.rows, [
        { userId: "activation-user-updated" },
      ]);
      await db.exec(`
        DELETE FROM "users" WHERE "id" = 'activation-user-updated';
      `);
      const activationTokens = await db.query<{ count: number }>(`
        SELECT COUNT(*)::int AS count
        FROM "auth_order_activation_tokens"
        WHERE "user_id" = 'activation-user-updated'
      `);
      assert.deepEqual(activationTokens.rows, [{ count: 0 }]);

      const analyticsColumns = await db.query<{
        columnName: string;
        maximumLength: number | null;
      }>(`
        SELECT column_name AS "columnName",
               character_maximum_length AS "maximumLength"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'analytics_outbox_events'
          AND column_name IN ('lease_token', 'provider_upload_id')
        ORDER BY column_name
      `);
      assert.deepEqual(analyticsColumns.rows, [
        { columnName: "lease_token", maximumLength: 36 },
        { columnName: "provider_upload_id", maximumLength: 128 },
      ]);
      await db.exec(`
        INSERT INTO "analytics_outbox_events"
          ("id", "event_type", "aggregate_id", "payload", "provider_upload_id")
        VALUES ('analytics-1', 'order_paid', 'order-1', '{}', 'upload-1');
      `);
      await assert.rejects(
        db.exec(`
          INSERT INTO "analytics_outbox_events"
            ("id", "event_type", "aggregate_id", "payload", "provider_upload_id")
          VALUES ('analytics-2', 'order_paid', 'order-2', '{}', 'upload-1');
        `),
        /unique constraint/i,
      );

      const indexes = await db.query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
             'orders_checkout_attempt_id_key',
             'auth_accounts_provider_provider_user_id_key',
            'order_checkout_throttles_scope_subject_hash_key',
            'order_checkout_throttles_blocked_until_idx',
            'auth_order_activation_tokens_token_hash_key',
            'auth_order_activation_tokens_user_id_idx',
            'auth_order_activation_tokens_expires_at_idx',
             'auth_order_activation_tokens_ip_hash_sent_at_idx',
             'auth_recovery_throttles_scope_subject_hash_key',
             'auth_recovery_throttles_blocked_until_idx',
            'analytics_outbox_events_event_type_aggregate_id_key',
            'analytics_outbox_events_provider_upload_id_key',
            'analytics_outbox_events_status_next_attempt_at_created_at_idx',
            'analytics_outbox_events_status_locked_at_idx'
          )
        ORDER BY indexname
      `);
      assert.deepEqual(
        indexes.rows.map(({ indexname }) => indexname),
        [
          "analytics_outbox_events_event_type_aggregate_id_key",
          "analytics_outbox_events_provider_upload_id_key",
          "analytics_outbox_events_status_locked_at_idx",
          "analytics_outbox_events_status_next_attempt_at_created_at_idx",
          "auth_accounts_provider_provider_user_id_key",
          "auth_order_activation_tokens_expires_at_idx",
          "auth_order_activation_tokens_ip_hash_sent_at_idx",
          "auth_order_activation_tokens_token_hash_key",
          "auth_order_activation_tokens_user_id_idx",
          "auth_recovery_throttles_blocked_until_idx",
          "auth_recovery_throttles_scope_subject_hash_key",
          "order_checkout_throttles_blocked_until_idx",
          "order_checkout_throttles_scope_subject_hash_key",
          "orders_checkout_attempt_id_key",
        ],
      );
    } finally {
      await db.close();
    }
  });
});
