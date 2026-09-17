import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PGlite, type Transaction } from "@electric-sql/pglite";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ArgumentMetadata,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { NestFactory } from "@nestjs/core";

import {
  AdminAffiliateAnalyticsController,
  AffiliateAnalyticsController,
} from "../src/affiliate/affiliate-analytics.controller";
import { AffiliateAnalyticsService } from "../src/affiliate/affiliate-analytics.service";
import {
  AffiliateAnalyticsQueryDTO,
  AffiliateLedgerDTO,
  AffiliateLedgerQueryDTO,
} from "../src/affiliate/dto";
import { AffiliatePartnerStatus } from "../src/generated/prisma/client";
import { getAffiliateCommissionStatus } from "../src/orders/refunds/refund-accounting";
import type { PrismaService } from "../src/prisma/prisma.service";
import { AuthGuard } from "../src/auth/auth.guard";
import { UsersService } from "../src/users/users.service";

const pipe = new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
});

@Controller("affiliate-query-validation")
class AffiliateQueryValidationController {
  @Get()
  get(@Query() query: AffiliateAnalyticsQueryDTO) {
    return query;
  }
}

@Module({ controllers: [AffiliateQueryValidationController] })
class AffiliateQueryValidationModule {}

describe("affiliate analytics query contract", () => {
  it("applies defaults, strict day choices, page bounds and offset bounds", async () => {
    const analytics = await transform(AffiliateAnalyticsQueryDTO, {});
    const ledger = await transform(AffiliateLedgerQueryDTO, {});
    assert.deepEqual(
      [analytics.days, analytics.codePage, analytics.codePageSize],
      [30, 1, 10],
    );
    assert.deepEqual([ledger.days, ledger.page, ledger.pageSize], [30, 1, 20]);

    for (const query of [
      { days: 8 },
      { days: null },
      { days: ["7"] },
      { codePage: 0 },
      { codePage: true },
      { codePage: ["1"] },
      { codePage: "" },
      { codePageSize: 51 },
      { unexpected: "partner-1" },
    ]) {
      await assert.rejects(transform(AffiliateAnalyticsQueryDTO, query));
    }

    const strings = await transform(AffiliateAnalyticsQueryDTO, {
      days: "7",
      codePage: "2",
      codePageSize: "50",
    });
    assert.deepEqual(
      [strings.days, strings.codePage, strings.codePageSize],
      [7, 2, 50],
    );

    const service = new AffiliateAnalyticsService({} as PrismaService);
    await assert.rejects(
      service.getAdminLedger("user-1", {
        days: 30,
        page: 2_147_483_647,
        pageSize: 50,
      }),
      BadRequestException,
    );
  });

  it("requires nullable response fields and enforces financial safe ranges", async () => {
    const response = validLedgerResponse();
    assert.deepEqual(await validate(plainToInstance(AffiliateLedgerDTO, response)), []);

    const withoutAvailableAt = structuredClone(response);
    delete (withoutAvailableAt.items[0] as { availableAt?: string | null })
      .availableAt;
    assert.notEqual(
      (await validate(plainToInstance(AffiliateLedgerDTO, withoutAvailableAt)))
        .length,
      0,
    );

    const withoutHoldReason = structuredClone(response);
    delete (withoutHoldReason.items[0] as { holdReason?: string | null })
      .holdReason;
    assert.notEqual(
      (await validate(plainToInstance(AffiliateLedgerDTO, withoutHoldReason)))
        .length,
      0,
    );

    const invalidHoldReason = structuredClone(response);
    invalidHoldReason.items[0]!.holdReason = "customer_requested" as never;
    assert.notEqual(
      (await validate(plainToInstance(AffiliateLedgerDTO, invalidHoldReason)))
        .length,
      0,
    );

    const invalidRate = structuredClone(response);
    invalidRate.items[0]!.partnerPercent = 16;
    assert.notEqual(
      (await validate(plainToInstance(AffiliateLedgerDTO, invalidRate))).length,
      0,
    );

    const unsafeAmount = structuredClone(response);
    unsafeAmount.items[0]!.amountKopecks = Number.MAX_SAFE_INTEGER + 1;
    assert.notEqual(
      (await validate(plainToInstance(AffiliateLedgerDTO, unsafeAmount))).length,
      0,
    );
  });

  it("rejects malformed and repeated values through the actual HTTP query pipe", async () => {
    const app = await NestFactory.create(AffiliateQueryValidationModule, {
      logger: false,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    try {
      const baseUrl = await app.getUrl();
      const valid = await fetch(
        `${baseUrl}/affiliate-query-validation?days=7&codePage=2&codePageSize=50`,
      );
      assert.equal(valid.status, 200);
      assert.deepEqual(await valid.json(), {
        days: 7,
        codePage: 2,
        codePageSize: 50,
      });

      for (const search of [
        "days=",
        "days=null",
        "days=7&days=30",
        "codePage=true",
        "codePage=1&codePage=2",
        "codePageSize=1.5",
        "unexpected=partner-1",
      ]) {
        const response = await fetch(
          `${baseUrl}/affiliate-query-validation?${search}`,
        );
        assert.equal(response.status, 400, search);
      }
    } finally {
      await app.close();
    }
  });

  it("requires the partner role before accessing own data", async () => {
    const service = new AffiliateAnalyticsService({} as PrismaService);
    assert.throws(
      () =>
        service.getOwnAnalytics(
          {
            id: "user-1",
            provider: "credentials",
            providerUserId: "user@example.com",
            roles: ["customer"],
          },
          { days: 30, codePage: 1, codePageSize: 10 },
        ),
      ForbiddenException,
    );
  });

  it("guards both controllers and enforces the admin role in the controller", () => {
    for (const controller of [
      AffiliateAnalyticsController,
      AdminAffiliateAnalyticsController,
    ]) {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ??
        []) as unknown[];
      assert.equal(guards.includes(AuthGuard), true);
    }

    const controller = new AdminAffiliateAnalyticsController(
      {} as AffiliateAnalyticsService,
      new UsersService({} as PrismaService),
    );
    assert.throws(
      () =>
        controller.getAnalytics(
          "user-1",
          { days: 30, codePage: 1, codePageSize: 10 },
          {
            user: {
              id: "customer-1",
              provider: "credentials",
              providerUserId: "customer@example.com",
              roles: ["customer"],
            },
          },
        ),
      ForbiddenException,
    );
  });
});

describe("AffiliateAnalyticsService SQL", () => {
  it("aggregates immutable events, Moscow days, balances and SQL pagination", async () => {
    const fixture = await createFixture();
    try {
      const analytics = await fixture.service.getAdminAnalytics("active-user", {
        days: 30,
        codePage: 1,
        codePageSize: 2,
      });

      assert.equal(analytics.period.timeZone, "Europe/Moscow");
      assert.equal(analytics.daily.length, 30);
      assert.deepEqual(analytics.totals, {
        orderCount: 2,
        salesKopecks: 1_500,
        earnedKopecks: 100,
        reversedKopecks: 340,
        netKopecks: -240,
      });
      assert.deepEqual(analytics.balance, {
        availableKopecks: 60,
        pendingKopecks: 200,
        heldKopecks: 50,
        reversedKopecks: 340,
      });
      assert.equal(analytics.codes.total, 3);
      assert.deepEqual(
        analytics.codes.items.map((item) => item.code),
        ["ALPHA", "OLD"],
      );
      assert.equal(
        analytics.daily.reduce((sum, day) => sum + day.netKopecks, 0),
        analytics.totals.netKopecks,
      );

      const secondPage = await fixture.service.getAdminAnalytics("active-user", {
        days: 30,
        codePage: 2,
        codePageSize: 2,
      });
      assert.deepEqual(
        secondPage.codes.items.map((item) => item.code),
        ["ZETA"],
      );
      assert.equal(fixture.isolationLevels.every((value) => value === "RepeatableRead"), true);
      assert.equal(fixture.readOnlyCommands.every((value) => value === "SET TRANSACTION READ ONLY"), true);
    } finally {
      await fixture.close();
    }
  });

  it("keeps UTC timestamp boundaries stable across database session time zones", async () => {
    const fixture = await createBoundaryFixture();
    try {
      for (const zone of ["UTC", "Europe/Moscow", "America/New_York"]) {
        await fixture.db.exec(`SET TIME ZONE '${zone}'`);
        const analytics = await fixture.service.getAdminAnalytics("active-user", {
          days: 7,
          codePage: 1,
          codePageSize: 1,
        });
        const secondCodePage = await fixture.service.getAdminAnalytics(
          "active-user",
          { days: 7, codePage: 2, codePageSize: 1 },
        );

        assert.equal(analytics.totals.orderCount, 4, `${zone}: period range`);
        assert.deepEqual(
          analytics.daily.map((day) => day.date),
          [
            "2026-09-11",
            "2026-09-12",
            "2026-09-13",
            "2026-09-14",
            "2026-09-15",
            "2026-09-16",
            "2026-09-17",
          ],
        );
        assert.equal(analytics.daily[0]!.orderCount, 1);
        assert.equal(analytics.daily[5]!.orderCount, 1);
        assert.equal(analytics.daily[6]!.orderCount, 2);
        assert.equal(
          analytics.daily.reduce((sum, day) => sum + day.netKopecks, 0),
          analytics.totals.netKopecks,
        );
        assert.equal(
          [...analytics.codes.items, ...secondCodePage.codes.items].reduce(
            (sum, code) => sum + code.netKopecks,
            0,
          ),
          analytics.totals.netKopecks,
        );
      }
    } finally {
      await fixture.close();
    }
  });

  it("returns opaque ledger rows and keeps SQL status parity with refund accounting", async () => {
    const fixture = await createFixture();
    try {
      const ledger = await fixture.service.getAdminLedger("active-user", {
        days: 90,
        page: 1,
        pageSize: 20,
      });
      assert.equal(ledger.total, 7);
      assert.equal(JSON.stringify(ledger).includes("customer"), false);

      const statuses = new Map(ledger.items.map((item) => [item.id, item.status]));
      const now = new Date(ledger.asOf);
      assert.equal(
        statuses.get("entry-zeta-credit"),
        getAffiliateCommissionStatus({
          availableAt: new Date("2020-01-01T00:00:00.000Z"),
          completedAt: new Date("2020-01-01T00:00:00.000Z"),
          earnedKopecks: 100,
          isCancelled: false,
          isCompleted: true,
          isPaid: true,
          now,
          reversedKopecks: 40,
        }),
      );
      assert.equal(statuses.get("entry-zero-credit"), "not_earned");
      assert.equal(statuses.get("entry-old-reversal"), "reversed");
      assert.equal(statuses.get("entry-pending-credit"), "pending");
      assert.equal(statuses.get("entry-held-credit"), "held");
      const ledgerItems = ledger.items as Array<
        (typeof ledger.items)[number] & { holdReason: string | null }
      >;
      assert.equal(
        ledgerItems.find((item) => item.id === "entry-held-credit")
          ?.holdReason,
        "order_cancelled",
      );
      assert.equal(
        ledgerItems.find((item) => item.id === "entry-old-reversal")
          ?.holdReason,
        null,
      );
      assert.equal(
        ledger.items.find((item) => item.id === "entry-old-reversal")
          ?.amountKopecks,
        -300,
      );
    } finally {
      await fixture.close();
    }
  });

  it("derives held credit reasons from current order state with stable priority", async () => {
    const fixture = await createFixture();
    try {
      await fixture.db.exec(`
        INSERT INTO "orders" VALUES
          ('order-payment-held', 'failed', 'completed', NOW() - interval '10 days'),
          ('order-completion-held', 'paid', 'paid', NOW() - interval '10 days');
        INSERT INTO "affiliate_commissions" VALUES
          ('commission-payment-held', 'order-payment-held', 'partner-active', 'PAYMENT', 10, false, 1000, 100, '2020-01-01T00:00:00Z', NOW() - interval '10 days'),
          ('commission-completion-held', 'order-completion-held', 'partner-active', 'COMPLETION', 10, false, 1000, 100, '2020-01-01T00:00:00Z', NOW() - interval '10 days');
        INSERT INTO "affiliate_ledger_entries" VALUES
          ('entry-payment-held', 'commission-payment-held', 'partner-active', 'credit', 100, NOW() - interval '10 days'),
          ('entry-completion-held', 'commission-completion-held', 'partner-active', 'credit', 100, NOW() - interval '10 days'),
          ('entry-held-reversal', 'commission-held', 'partner-active', 'reversal', -10, NOW() - interval '5 days');
      `);

      const ledger = await fixture.service.getAdminLedger("active-user", {
        days: 90,
        page: 1,
        pageSize: 20,
      });
      const reasons = new Map(
        (
          ledger.items as Array<
            (typeof ledger.items)[number] & { holdReason: string | null }
          >
        ).map((item) => [item.id, item.holdReason]),
      );

      assert.equal(reasons.get("entry-held-credit"), "order_cancelled");
      assert.equal(reasons.get("entry-payment-held"), "payment_not_confirmed");
      assert.equal(reasons.get("entry-completion-held"), "order_not_completed");
      assert.equal(reasons.get("entry-held-reversal"), null);
      assert.equal(reasons.get("entry-pending-credit"), null);
    } finally {
      await fixture.close();
    }
  });

  it("allows suspended profiles to admins but rejects own and missing profiles", async () => {
    const fixture = await createFixture();
    try {
      await assert.doesNotReject(
        fixture.service.getAdminLedger("suspended-user", {
          days: 30,
          page: 1,
          pageSize: 20,
        }),
      );
      await assert.rejects(
        fixture.service.getOwnLedger(
          {
            id: "suspended-user",
            provider: "credentials",
            providerUserId: "suspended@example.com",
            roles: ["partner"],
          },
          { days: 30, page: 1, pageSize: 20 },
        ),
        ForbiddenException,
      );
      await assert.rejects(
        fixture.service.getAdminLedger("missing-user", {
          days: 30,
          page: 1,
          pageSize: 20,
        }),
        NotFoundException,
      );
    } finally {
      await fixture.close();
    }
  });

  it("fails loudly when persisted money exceeds JavaScript safe integers", async () => {
    const fixture = await createFixture();
    try {
      await fixture.db.exec(`
        UPDATE "affiliate_commissions"
        SET "subtotal_kopecks" = 9007199254740992
        WHERE "id" = 'commission-zeta'
      `);
      await assert.rejects(
        fixture.service.getAdminAnalytics("active-user", {
          days: 30,
          codePage: 1,
          codePageSize: 10,
        }),
        RangeError,
      );
    } finally {
      await fixture.close();
    }
  });

  it("fails loudly when the persisted credit and immutable snapshot disagree", async () => {
    const fixture = await createFixture();
    try {
      await fixture.db.exec(`
        UPDATE "affiliate_commissions"
        SET "earned_kopecks" = 999
        WHERE "id" = 'commission-pending'
      `);
      await assert.rejects(
        fixture.service.getAdminAnalytics("active-user", {
          days: 30,
          codePage: 1,
          codePageSize: 10,
        }),
        /ledger is inconsistent/,
      );
    } finally {
      await fixture.close();
    }
  });

  it("fails loudly when reversals make a persisted balance negative", async () => {
    const fixture = await createFixture();
    try {
      await fixture.db.exec(`
        UPDATE "affiliate_ledger_entries"
        SET "amount_kopecks" = -301
        WHERE "id" = 'entry-old-reversal'
      `);
      await assert.rejects(
        fixture.service.getAdminAnalytics("active-user", {
          days: 30,
          codePage: 1,
          codePageSize: 10,
        }),
        /remaining balance is negative/,
      );
      await assert.rejects(
        fixture.service.getAdminLedger("active-user", {
          days: 90,
          page: 1,
          pageSize: 20,
        }),
        /ledger is inconsistent/,
      );
    } finally {
      await fixture.close();
    }
  });
});

async function createFixture() {
  const db = new PGlite();
  await db.exec(`
    SET TIME ZONE 'UTC';
    CREATE TYPE "affiliate_partner_status" AS ENUM ('active', 'suspended');
    CREATE TYPE "affiliate_ledger_entry_kind" AS ENUM ('credit', 'reversal');
    CREATE TYPE "order_payment_status" AS ENUM ('pending', 'paid', 'failed');
    CREATE TYPE "order_crm_status" AS ENUM ('new', 'in_progress', 'waiting_payment', 'paid', 'delivering', 'completed', 'cancelled');

    CREATE TABLE "affiliate_partners" (
      "id" VARCHAR(32) PRIMARY KEY,
      "user_id" TEXT UNIQUE NOT NULL,
      "status" "affiliate_partner_status" NOT NULL
    );
    CREATE TABLE "orders" (
      "id" VARCHAR(32) PRIMARY KEY,
      "payment_status" "order_payment_status" NOT NULL,
      "crm_status" "order_crm_status" NOT NULL,
      "completed_at" TIMESTAMP(3)
    );
    CREATE TABLE "affiliate_commissions" (
      "id" VARCHAR(32) PRIMARY KEY,
      "order_id" VARCHAR(32) NOT NULL,
      "partner_id" VARCHAR(32) NOT NULL,
      "code_snapshot" VARCHAR(40) NOT NULL,
      "partner_percent" INTEGER NOT NULL,
      "is_self_purchase" BOOLEAN NOT NULL,
      "subtotal_kopecks" BIGINT NOT NULL,
      "earned_kopecks" BIGINT NOT NULL,
      "available_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL
    );
    CREATE TABLE "affiliate_ledger_entries" (
      "id" VARCHAR(32) PRIMARY KEY,
      "commission_id" VARCHAR(32) NOT NULL,
      "partner_id" VARCHAR(32) NOT NULL,
      "kind" "affiliate_ledger_entry_kind" NOT NULL,
      "amount_kopecks" BIGINT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL
    );

    INSERT INTO "affiliate_partners" VALUES
      ('partner-active', 'active-user', 'active'),
      ('partner-suspended', 'suspended-user', 'suspended');
    INSERT INTO "orders" VALUES
      ('order-zeta', 'paid', 'completed', NOW() - interval '20 days'),
      ('order-zero', 'paid', 'completed', NOW() - interval '20 days'),
      ('order-old', 'paid', 'completed', NOW() - interval '60 days'),
      ('order-pending', 'paid', 'paid', NULL),
      ('order-held', 'failed', 'cancelled', NOW() - interval '60 days');
    INSERT INTO "affiliate_commissions" VALUES
      ('commission-zeta', 'order-zeta', 'partner-active', 'ZETA', 10, false, 1000, 100, '2020-01-01T00:00:00Z', NOW() - interval '2 days'),
      ('commission-zero', 'order-zero', 'partner-active', 'ALPHA', 0, true, 500, 0, '2020-01-01T00:00:00Z', NOW() - interval '2 days'),
      ('commission-old', 'order-old', 'partner-active', 'OLD', 10, false, 3000, 300, '2020-01-01T00:00:00Z', NOW() - interval '60 days'),
      ('commission-pending', 'order-pending', 'partner-active', 'PENDING', 10, false, 2000, 200, NULL, NOW() - interval '40 days'),
      ('commission-held', 'order-held', 'partner-active', 'HELD', 10, false, 500, 50, '2020-01-01T00:00:00Z', NOW() - interval '40 days');
    INSERT INTO "affiliate_ledger_entries" VALUES
      ('entry-zeta-credit', 'commission-zeta', 'partner-active', 'credit', 100, NOW() - interval '2 days'),
      ('entry-zeta-reversal', 'commission-zeta', 'partner-active', 'reversal', -40, NOW() - interval '1 day'),
      ('entry-zero-credit', 'commission-zero', 'partner-active', 'credit', 0, NOW() - interval '2 days'),
      ('entry-old-credit', 'commission-old', 'partner-active', 'credit', 300, NOW() - interval '60 days'),
      ('entry-old-reversal', 'commission-old', 'partner-active', 'reversal', -300, NOW() - interval '1 day'),
      ('entry-pending-credit', 'commission-pending', 'partner-active', 'credit', 200, NOW() - interval '40 days'),
      ('entry-held-credit', 'commission-held', 'partner-active', 'credit', 50, NOW() - interval '40 days');
  `);

  const isolationLevels: string[] = [];
  const readOnlyCommands: string[] = [];
  const prisma = {
    $transaction: async <T>(
      callback: (client: unknown) => Promise<T>,
      options: { isolationLevel: string },
    ) => {
      isolationLevels.push(options.isolationLevel);
      return db.transaction(async (transaction) =>
        callback(createTransactionClient(transaction, readOnlyCommands)),
      );
    },
  } as unknown as PrismaService;

  return {
    db,
    service: new AffiliateAnalyticsService(prisma),
    isolationLevels,
    readOnlyCommands,
    close: () => db.close(),
  };
}

async function createBoundaryFixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TYPE "affiliate_partner_status" AS ENUM ('active', 'suspended');
    CREATE TYPE "affiliate_ledger_entry_kind" AS ENUM ('credit', 'reversal');
    CREATE TYPE "order_payment_status" AS ENUM ('pending', 'paid', 'failed');
    CREATE TYPE "order_crm_status" AS ENUM ('new', 'in_progress', 'waiting_payment', 'paid', 'delivering', 'completed', 'cancelled');
    CREATE TABLE "affiliate_partners" (
      "id" VARCHAR(32) PRIMARY KEY, "user_id" TEXT UNIQUE NOT NULL,
      "status" "affiliate_partner_status" NOT NULL
    );
    CREATE TABLE "orders" (
      "id" VARCHAR(32) PRIMARY KEY,
      "payment_status" "order_payment_status" NOT NULL,
      "crm_status" "order_crm_status" NOT NULL,
      "completed_at" TIMESTAMP(3)
    );
    CREATE TABLE "affiliate_commissions" (
      "id" VARCHAR(32) PRIMARY KEY, "order_id" VARCHAR(32) NOT NULL,
      "partner_id" VARCHAR(32) NOT NULL, "code_snapshot" VARCHAR(40) NOT NULL,
      "partner_percent" INTEGER NOT NULL, "is_self_purchase" BOOLEAN NOT NULL,
      "subtotal_kopecks" BIGINT NOT NULL, "earned_kopecks" BIGINT NOT NULL,
      "available_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL
    );
    CREATE TABLE "affiliate_ledger_entries" (
      "id" VARCHAR(32) PRIMARY KEY, "commission_id" VARCHAR(32) NOT NULL,
      "partner_id" VARCHAR(32) NOT NULL,
      "kind" "affiliate_ledger_entry_kind" NOT NULL,
      "amount_kopecks" BIGINT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL
    );
    INSERT INTO "affiliate_partners" VALUES ('partner-active', 'active-user', 'active');
  `);

  const dates = [
    "2026-09-10 20:59:59.999",
    "2026-09-10 21:00:00.000",
    "2026-09-16 20:59:59.999",
    "2026-09-16 21:00:00.000",
    "2026-09-17 00:00:00.000",
  ];
  for (const [index, date] of dates.entries()) {
    const id = `boundary-${index}`;
    const code = index % 2 === 0 ? "ALPHA" : "BETA";
    await db.query(
      `INSERT INTO "orders" VALUES ($1, 'paid', 'completed', '2026-08-01 00:00:00.000')`,
      [id],
    );
    await db.query(
      `INSERT INTO "affiliate_commissions" VALUES ($1, $1, 'partner-active', $2, 10, false, 1000, 100, '2026-08-15 00:00:00.000', $3)`,
      [id, code, date],
    );
    await db.query(
      `INSERT INTO "affiliate_ledger_entries" VALUES ($1, $1, 'partner-active', 'credit', 100, $2)`,
      [id, date],
    );
  }

  const prisma = {
    $transaction: async <T>(callback: (client: unknown) => Promise<T>) =>
      db.transaction(async (transaction) =>
        callback({
          ...createTransactionClient(transaction, []),
          $queryRaw: async <R extends object[]>(query: {
            text: string;
            values: unknown[];
          }) => {
            if (query.text.includes('CURRENT_TIMESTAMP AS "as_of"')) {
              return [
                {
                  as_of: new Date("2026-09-17T12:00:00.000Z"),
                  period_start: new Date("2026-09-10T21:00:00.000Z"),
                },
              ] as R;
            }
            const result = await transaction.query<R[number]>(
              query.text,
              query.values.map(toPrismaPgValue),
            );
            return result.rows as R;
          },
        }),
      ),
  } as unknown as PrismaService;

  return {
    db,
    service: new AffiliateAnalyticsService(prisma),
    close: () => db.close(),
  };
}

function createTransactionClient(
  transaction: Transaction,
  readOnlyCommands: string[],
) {
  return {
    $executeRawUnsafe: async (sql: string) => {
      readOnlyCommands.push(sql);
      await transaction.exec(sql);
      return 0;
    },
    $queryRaw: async <T extends object[]>(query: {
      text: string;
      values: unknown[];
    }) => {
      const result = await transaction.query<T[number]>(query.text, query.values.map(toPrismaPgValue));
      return result.rows;
    },
    affiliatePartner: {
      findUnique: async ({ where }: { where: { userId: string } }) => {
        const result = await transaction.query<{
          id: string;
          status: "active" | "suspended";
        }>(
          `SELECT "id", "status"::text AS "status" FROM "affiliate_partners" WHERE "user_id" = $1`,
          [where.userId],
        );
        const partner = result.rows[0];
        if (!partner) return null;
        return {
          id: partner.id,
          status:
            partner.status === "active"
              ? AffiliatePartnerStatus.ACTIVE
              : AffiliatePartnerStatus.SUSPENDED,
        };
      },
    },
  };
}

function toPrismaPgValue(value: unknown) {
  return value instanceof Date
    ? value.toISOString().replace("T", " ").replace("Z", "")
    : value;
}

function validLedgerResponse() {
  return {
    asOf: "2026-09-17T12:00:00.000Z",
    period: {
      days: 30 as const,
      from: "2026-08-18T21:00:00.000Z",
      to: "2026-09-17T12:00:00.000Z",
      timeZone: "Europe/Moscow" as const,
    },
    items: [
      {
        id: "entry-1",
        code: "ARTM-CODE",
        kind: "credit" as const,
        amountKopecks: 100,
        createdAt: "2026-09-17T10:00:00.000Z",
        availableAt: null,
        status: "pending" as const,
        holdReason: null,
        isSelfPurchase: false,
        partnerPercent: 10,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  };
}

function transform<T extends object>(
  dto: new () => T,
  value: unknown,
): Promise<T> {
  return pipe.transform(value, {
    metatype: dto,
    type: "query",
  } as ArgumentMetadata);
}
