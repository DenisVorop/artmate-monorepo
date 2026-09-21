import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { AuthGuard } from "../src/auth/auth.guard";
import { LoyaltyController } from "../src/loyalty/loyalty.controller";
import {
  EnrollLoyaltyDTO,
  LoyaltyHistoryQueryDTO,
  LoyaltyOverviewDTO,
  LoyaltyOperationDTO,
} from "../src/loyalty/dto";
import { LoyaltyMembershipService } from "../src/loyalty/membership.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const validation = { whitelist: true, forbidNonWhitelisted: true };

describe("loyalty membership boundary", () => {
  it("accepts restored spent points as a distinct history operation", () => {
    const operation = plainToInstance(LoyaltyOperationDTO, {
      id: "operation-restore",
      title: "Возврат потраченных баллов",
      sequence: 4,
      kind: "restore",
      balanceDelta: 25,
      reservedDelta: 0,
      balanceAfter: 100,
      reservedAfter: 0,
      occurredAt: "2026-09-20T12:00:00.000Z",
      recordedAt: "2026-09-20T12:00:01.000Z",
    });
    assert.deepEqual(validateSync(operation, validation), []);
  });
  it("requires explicit true consent and rejects client-selected member identifiers", () => {
    for (const body of [
      { acceptedTerms: false, termsVersion: "loyalty-v1" },
      { acceptedTerms: "true", termsVersion: "loyalty-v1" },
      { termsVersion: "loyalty-v1" },
      { acceptedTerms: true, termsVersion: "loyalty-v1", userId: "other-user" },
      { acceptedTerms: true, termsVersion: "loyalty-v1", points: 10000 },
    ])
      assert.ok(
        validateSync(plainToInstance(EnrollLoyaltyDTO, body), validation)
          .length > 0,
      );
    assert.equal(
      validateSync(
        plainToInstance(EnrollLoyaltyDTO, {
          acceptedTerms: true,
          termsVersion: "loyalty-v1",
        }),
        validation,
      ).length,
      0,
    );
  });

  it("guards all routes and takes the current user only from the authenticated request", async () => {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, LoyaltyController), [
      AuthGuard,
    ]);
    const calls: unknown[][] = [];
    const service = {
      getMine: async (...args: unknown[]) => {
        calls.push(args);
      },
      enroll: async (...args: unknown[]) => {
        calls.push(args);
      },
      listOperations: async (...args: unknown[]) => {
        calls.push(args);
      },
    } as unknown as LoyaltyMembershipService;
    const controller = new LoyaltyController(service);
    const request = {
      user: {
        id: "current-user",
        provider: "credentials" as const,
        providerUserId: "identity",
        roles: [],
      },
    };
    const body = { acceptedTerms: true as const, termsVersion: "loyalty-v1" };
    await controller.getMine(request);
    await controller.enroll(request, body);
    await controller.listOperations(request, { limit: 1 });
    assert.deepEqual(calls, [
      ["current-user"],
      ["current-user", body],
      ["current-user", { limit: 1 }],
    ]);
  });

  it("does not enroll or write on overview/history reads", async () => {
    const service = new LoyaltyMembershipService({
      user: { findUnique: async () => ({ status: "ACTIVE", deletedAt: null }) },
      loyaltyMember: { findUnique: async () => null },
    } as unknown as PrismaService);
    const result = await service.getMine("user");
    assert.deepEqual(result, {
      enrolled: false,
      termsVersion: "loyalty-v1",
      member: null,
    });
    assert.equal(
      validateSync(plainToInstance(LoyaltyOverviewDTO, result), validation)
        .length,
      0,
    );
    assert.deepEqual(await service.listOperations("user", {}), {
      items: [],
      nextCursor: null,
    });
  });

  it("validates consent/version before opening a transaction and bounds pagination", async () => {
    const service = new LoyaltyMembershipService({} as PrismaService);
    await assert.rejects(
      service.enroll("user", {
        acceptedTerms: false as never,
        termsVersion: "loyalty-v1",
      }),
      /must be accepted/,
    );
    await assert.rejects(
      service.enroll("user", { acceptedTerms: true, termsVersion: "old" }),
      /have changed/,
    );
    for (const limit of [0, -1, 101, 1.5, NaN])
      await assert.rejects(
        service.listOperations("user", { limit }),
        /page size/,
      );
    for (const cursor of ["0", "-1", "1.1", "9007199254740992", "", "1e2"])
      await assert.rejects(
        service.listOperations("user", { cursor }),
        /cursor/,
      );
    const query = plainToInstance(LoyaltyHistoryQueryDTO, {
      limit: "20",
      cursor: "1",
    });
    assert.equal(validateSync(query, validation).length, 0);
    assert.equal(query.limit, 20);
  });
});
