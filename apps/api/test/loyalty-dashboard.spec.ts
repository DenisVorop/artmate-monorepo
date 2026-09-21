import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GUARDS_METADATA, HEADERS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { AuthGuard } from "../src/auth/auth.guard";
import { Prisma } from "../src/generated/prisma/client";
import { readLoyaltyDashboard } from "../src/loyalty/dashboard";
import { LoyaltyDashboardDTO } from "../src/loyalty/dto";
import { LoyaltyController } from "../src/loyalty/loyalty.controller";
import { LoyaltyMembershipService } from "../src/loyalty/membership.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("loyalty cabinet read boundary", () => {
  it("requires authentication, private no-store and the authenticated owner", async () => {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, LoyaltyController), [
      AuthGuard,
    ]);
    assert.deepEqual(
      Reflect.getMetadata(
        HEADERS_METADATA,
        LoyaltyController.prototype.getDashboard,
      ),
      [{ name: "Cache-Control", value: "private, no-store" }],
    );
    let owner: string | undefined;
    const controller = new LoyaltyController({
      getDashboard: async (id: string) => {
        owner = id;
      },
    } as unknown as LoyaltyMembershipService);
    await controller.getDashboard({
      user: {
        id: "session-owner",
        provider: "credentials",
        providerUserId: "identity",
        roles: [],
      },
    });
    assert.equal(owner, "session-owner");
  });

  it("does not enroll, query progress or write for an unenrolled owner", async () => {
    const tx = {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          assert.equal(where.id, "owner");
          return { status: "ACTIVE", deletedAt: null };
        },
      },
      loyaltyMember: {
        findUnique: async ({ where }: { where: { userId: string } }) => {
          assert.equal(where.userId, "owner");
          return null;
        },
      },
    };
    const service = new LoyaltyMembershipService({
      $transaction: async (
        fn: (client: unknown) => unknown,
        options: unknown,
      ) => {
        assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
        return fn(tx);
      },
    } as unknown as PrismaService);
    const result = await service.getDashboard("owner");
    assert.deepEqual(result, { tier: null, achievements: [] });
    assert.deepEqual(
      validateSync(plainToInstance(LoyaltyDashboardDTO, result), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
      [],
    );
  });

  it("rejects unavailable owners before reading membership", async () => {
    for (const user of [
      null,
      { status: "BLOCKED", deletedAt: null },
      { status: "ACTIVE", deletedAt: new Date() },
    ]) {
      const service = new LoyaltyMembershipService({
        $transaction: async (fn: (client: unknown) => unknown) =>
          fn({ user: { findUnique: async () => user } }),
      } as unknown as PrismaService);
      await assert.rejects(
        service.getDashboard("owner"),
        /Account is unavailable/,
      );
    }
  });

  it("uses the same inclusive rate thresholds and safe numeric DTO as checkout", async () => {
    for (const [spend, rate, threshold, nextRate] of [
      [0, 3, 300000, 5],
      [299999, 3, 300000, 5],
      [300000, 5, 700000, 7],
      [699999, 5, 700000, 7],
      [700000, 7, 1200000, 10],
      [1199999, 7, 1200000, 10],
      [1200000, 10, null, null],
    ] as const) {
      let reads = 0;
      const result = await readLoyaltyDashboard(
        {
          $queryRaw: async () =>
            ++reads === 1
              ? [{ spendKopecks: String(spend), invalid: false }]
              : [],
        } as unknown as Prisma.TransactionClient,
        "owner",
        "member",
      );
      assert.deepEqual(result.tier, {
        spendKopecks: spend,
        ratePercent: rate,
        nextThresholdKopecks: threshold,
        nextRatePercent: nextRate,
      });
      assert.deepEqual(
        validateSync(plainToInstance(LoyaltyDashboardDTO, result), {
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
        [],
      );
    }
    await assert.rejects(
      readLoyaltyDashboard(
        {
          $queryRaw: async () => [
            { spendKopecks: "9007199254740992", invalid: false },
          ],
        } as unknown as Prisma.TransactionClient,
        "owner",
        "member",
      ),
      /safe integer/,
    );
  });

  it("rejects private/internal fields and invalid achievement conditions in DTOs", () => {
    const result = {
      tier: null,
      achievements: [
        {
          id: "a",
          title: "A",
          description: "Description",
          imageUrl: null,
          conditionKind: "completed_order_count",
          target: 3,
          rewardPoints: 25,
          progress: 2,
          earnedAt: null,
        },
      ],
    };
    const validate = (input: unknown) =>
      validateSync(plainToInstance(LoyaltyDashboardDTO, input), {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
    assert.deepEqual(validate(result), []);
    assert.ok(
      validate({
        ...result,
        achievements: [{ ...result.achievements[0], sourceKey: "internal" }],
      }).length,
    );
    assert.ok(
      validate({
        ...result,
        achievements: [
          { ...result.achievements[0], conditionKind: "arbitrary" },
        ],
      }).length,
    );
  });

  it("labels history from structural reward relations without exposing internal keys", async () => {
    const at = new Date("2026-09-21T12:00:00.000Z");
    const base = {
      id: "operation",
      kind: "CREDIT",
      sequence: 1n,
      balanceDelta: 25n,
      reservedDelta: 0n,
      balanceAfter: 25n,
      reservedAfter: 0n,
      occurredAt: at,
      recordedAt: at,
      sourceKey: "private-source",
      operationKey: "private-key",
    };
    const service = new LoyaltyMembershipService({
      user: { findUnique: async () => ({ status: "ACTIVE", deletedAt: null }) },
      loyaltyMember: { findUnique: async () => ({ id: "member" }) },
      loyaltyOperation: {
        findMany: async ({ where }: { where: { memberId: string } }) => {
          assert.equal(where.memberId, "member");
          return [
            { ...base, achievementAwardId: "award" },
            { ...base, workRewardId: "work" },
            { ...base, purchaseOrderId: "order" },
          ];
        },
      },
    } as unknown as PrismaService);
    const result = await service.listOperations("owner", {});
    assert.deepEqual(
      result.items.map((item) => item.title),
      [
        "Награда за достижение",
        "Награда за опубликованную работу",
        "Баллы за покупку",
      ],
    );
    assert.ok(!JSON.stringify(result).includes("private-"));
    assert.ok(!JSON.stringify(result).includes("achievementAwardId"));
  });
});
