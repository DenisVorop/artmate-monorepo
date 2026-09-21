import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { AuthGuard } from "../src/auth/auth.guard";
import type { AuthUser } from "../src/auth/auth.types";
import { LoyaltyAchievementDraftsController } from "../src/loyalty/achievement-drafts.controller";
import {
  achievementConditionKinds,
  achievementIntegerMax,
  ActivateAchievementDTO,
  ArchiveAchievementDraftDTO,
  CreateAchievementDraftDTO,
  UpdateAchievementDraftDTO,
} from "../src/loyalty/achievement-drafts.dto";
import { LoyaltyAchievementDraftsService } from "../src/loyalty/achievement-drafts.service";
import { UsersService } from "../src/users/users.service";

const validation = { whitelist: true, forbidNonWhitelisted: true };
const draft = {
  title: "First published coloring",
  description: "A configurable draft",
  imageUrl: null,
  conditionKind: "published_coloring_count" as const,
  target: 1,
  rewardPoints: 0,
  sortOrder: 0,
};

describe("achievement draft API boundary", () => {
  it("accepts the four editable conditions and trims title and description", () => {
    for (const conditionKind of achievementConditionKinds) {
      const input = plainToInstance(CreateAchievementDraftDTO, {
        ...draft,
        conditionKind,
        title: "  Title  ",
        description: "  Description  ",
        imageUrl: "https://example.com/badge.svg",
        target: achievementIntegerMax,
        rewardPoints: achievementIntegerMax,
        sortOrder: achievementIntegerMax,
      });
      assert.deepEqual(validateSync(input, validation), []);
      assert.equal(input.title, "Title");
      assert.equal(input.description, "Description");
    }
  });

  it("rejects invalid fields and client-selected identity, author or activation", () => {
    for (const fields of [
      { title: "   " },
      { title: "x".repeat(121) },
      { description: "x".repeat(1001) },
      { target: 0 },
      { target: 1.2 },
      { target: "1" },
      { target: achievementIntegerMax + 1 },
      { rewardPoints: -1 },
      { rewardPoints: achievementIntegerMax + 1 },
      { sortOrder: achievementIntegerMax + 1 },
      { conditionKind: "arbitrary" },
      { imageUrl: "ftp://example.com/badge.png" },
      { imageUrl: "javascript:alert(1)" },
      { imageUrl: "data:image/png;base64,abc" },
      { imageUrl: "//example.com/a.png" },
      { imageUrl: "https://" },
      { id: "another-id" },
      { createdById: "another-user" },
      { status: "active" },
    ]) {
      assert.ok(
        validateSync(
          plainToInstance(CreateAchievementDraftDTO, {
            ...draft,
            ...fields,
          }),
          validation,
        ).length > 0,
        JSON.stringify(fields),
      );
    }
  });

  it("requires complete replacement and valid expected versions", () => {
    assert.ok(
      validateSync(
        plainToInstance(UpdateAchievementDraftDTO, {
          expectedVersion: 1,
          title: "Partial update",
        }),
        validation,
      ).length > 0,
    );
    for (const expectedVersion of [
      undefined,
      0,
      -1,
      "1",
      1.5,
      achievementIntegerMax + 1,
    ]) {
      assert.ok(
        validateSync(
          plainToInstance(ActivateAchievementDTO, { expectedVersion }),
          validation,
        ).length > 0,
      );
      assert.ok(
        validateSync(
          plainToInstance(ArchiveAchievementDraftDTO, {
            expectedVersion,
          }),
          validation,
        ).length > 0,
      );
    }
    assert.deepEqual(
      validateSync(
        plainToInstance(UpdateAchievementDraftDTO, {
          ...draft,
          expectedVersion: 1,
        }),
        validation,
      ),
      [],
    );
  });

  it("guards every endpoint, denies non-admins and derives the author from authentication", async () => {
    assert.deepEqual(
      Reflect.getMetadata(GUARDS_METADATA, LoyaltyAchievementDraftsController),
      [AuthGuard],
    );
    const calls: unknown[][] = [];
    const service = Object.fromEntries(
      ["list", "create", "update", "activate", "archive"].map((method) => [
        method,
        async (...args: unknown[]) => {
          calls.push([method, ...args]);
        },
      ]),
    ) as unknown as LoyaltyAchievementDraftsService;
    const users = Object.create(UsersService.prototype) as UsersService;
    const controller = new LoyaltyAchievementDraftsController(service, users);
    const user: AuthUser = {
      id: "authenticated-author",
      provider: "credentials",
      providerUserId: "identity",
      roles: ["customer"],
    };
    for (const invoke of [
      () => controller.list({ user }),
      () => controller.create({ user }, draft),
      () => controller.update({ user }, "id", { ...draft, expectedVersion: 1 }),
      () => controller.archive({ user }, "id", { expectedVersion: 1 }),
      () => controller.activate({ user }, "id", { expectedVersion: 1 }),
    ])
      assert.throws(invoke, ForbiddenException);
    assert.deepEqual(calls, []);
    user.roles = ["admin"];
    await controller.create({ user }, draft);
    await controller.update({ user }, "id", { ...draft, expectedVersion: 1 });
    await controller.activate({ user }, "id", { expectedVersion: 1 });
    assert.deepEqual(calls, [
      ["create", user.id, draft],
      ["update", "id", user.id, { ...draft, expectedVersion: 1 }],
      ["activate", "id", user.id, 1],
    ]);
  });

  it("rejects the last representable version before attempting an increment", async () => {
    const service = new LoyaltyAchievementDraftsService({
      $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          $queryRaw: async () => [
            { currentVersion: achievementIntegerMax, archivedAt: null },
          ],
        }),
    } as unknown as ConstructorParameters<
      typeof LoyaltyAchievementDraftsService
    >[0]);
    await assert.rejects(
      service.update("id", "author", {
        ...draft,
        expectedVersion: achievementIntegerMax,
      }),
      /version limit reached/,
    );
  });
});
