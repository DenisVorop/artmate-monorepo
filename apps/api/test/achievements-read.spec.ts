import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { AchievementsDTO } from "../src/achievements/dto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUARDS_METADATA,
  HEADERS_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { AuthGuard } from "../src/auth/auth.guard";
import { AchievementsController } from "../src/achievements/achievements.controller";
import { AchievementsService } from "../src/achievements/achievements.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("independent achievements read boundary", () => {
  it("rejects private/internal fields and invalid achievement conditions in DTOs", () => {
    const result = {
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
      validateSync(plainToInstance(AchievementsDTO, input), {
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

  it("requires authentication and reads the session owner with private no-store", async () => {
    assert.deepEqual(
      Reflect.getMetadata(GUARDS_METADATA, AchievementsController),
      [AuthGuard],
    );
    assert.equal(
      Reflect.getMetadata(PATH_METADATA, AchievementsController),
      "achievements",
    );
    assert.equal(
      Reflect.getMetadata(
        PATH_METADATA,
        AchievementsController.prototype.getMine,
      ),
      "me",
    );
    assert.deepEqual(
      Reflect.getMetadata(
        HEADERS_METADATA,
        AchievementsController.prototype.getMine,
      ),
      [{ name: "Cache-Control", value: "private, no-store" }],
    );
    let owner: string | undefined;
    const controller = new AchievementsController({
      getMine: async (id: string) => {
        owner = id;
      },
    } as unknown as AchievementsService);
    await controller.getMine({
      user: {
        id: "session-owner",
        provider: "credentials",
        providerUserId: "identity",
        roles: [],
      },
    });
    assert.equal(owner, "session-owner");
  });

  it("reads badges for an active user without membership or writes", async () => {
    const earnedAt = new Date("2026-09-21T10:00:00Z");
    let reads = 0;
    const service = new AchievementsService({
      $transaction: async (fn: (tx: unknown) => unknown, options: unknown) => {
        assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
        return fn({
          user: {
            findUnique: async () => ({ status: "ACTIVE", deletedAt: null }),
          },
          $queryRaw: async (query: { sql: string; values: unknown[] }) => {
            reads += 1;
            assert.match(query.sql, /achievement_badges/);
            assert.doesNotMatch(
              query.sql,
              /loyalty_members|loyalty_achievement_awards|INSERT|UPDATE/,
            );
            assert.ok(query.values.every((value) => value === "owner"));
            return [{ id: "badge", earnedAt }];
          },
        });
      },
    } as unknown as PrismaService);
    assert.deepEqual(await service.getMine("owner"), {
      achievements: [{ id: "badge", earnedAt: earnedAt.toISOString() }],
    });
    assert.equal(reads, 1);
  });

  it("rejects missing, blocked and deleted users before reading facts", async () => {
    for (const user of [
      null,
      { status: "BLOCKED", deletedAt: null },
      { status: "ACTIVE", deletedAt: new Date() },
    ]) {
      const service = new AchievementsService({
        $transaction: async (fn: (tx: unknown) => unknown) =>
          fn({ user: { findUnique: async () => user } }),
      } as unknown as PrismaService);
      await assert.rejects(service.getMine("owner"), /Account is unavailable/);
    }
  });
});
