import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ArgumentMetadata,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import {
  AdminAffiliateCodesController,
  AffiliateCodesController,
} from "../src/affiliate/affiliate-codes.controller";
import { AffiliateCodesService } from "../src/affiliate/affiliate-codes.service";
import {
  CreateAffiliateCodeRequestDTO,
  AffiliateCodeListDTO,
  ListAffiliateCodesQueryDTO,
  UpdateAffiliateCodeRequestDTO,
} from "../src/affiliate/dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthGuard } from "../src/auth/auth.guard";
import type { AuthUser } from "../src/auth/auth.types";
import { Prisma } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { UsersService } from "../src/users/users.service";

const pipe = new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
});

describe("affiliate code HTTP contract", () => {
  it("validates integer rates, trims comments and defaults pagination", async () => {
    for (const partnerPercent of [0, 15]) {
      const dto = await transform(CreateAffiliateCodeRequestDTO, {
        code: " creator_10 ",
        comment: " private campaign ",
        partnerPercent,
      });
      assert.equal(dto.code, "creator_10");
      assert.equal(dto.comment, "private campaign");
    }

    const query = await transform(ListAffiliateCodesQueryDTO, {});
    assert.deepEqual(
      { page: query.page, pageSize: query.pageSize },
      { page: 1, pageSize: 20 },
    );

    for (const invalid of [-1, 1.5, 16]) {
      await assert.rejects(
        transform(CreateAffiliateCodeRequestDTO, {
          partnerPercent: invalid,
        }),
      );
    }
    for (const invalid of [null, false, true, "", "10", [], {}]) {
      await assert.rejects(
        transform(CreateAffiliateCodeRequestDTO, {
          partnerPercent: invalid,
        }),
      );
      await assert.rejects(
        transform(UpdateAffiliateCodeRequestDTO, {
          partnerPercent: invalid,
        }),
      );
    }
    for (const invalid of [null, "", 0, 1, [], {}]) {
      await assert.rejects(
        transform(UpdateAffiliateCodeRequestDTO, { isActive: invalid }),
      );
    }
    for (const invalid of [null, false, true, [], {}]) {
      await assert.rejects(
        transform(CreateAffiliateCodeRequestDTO, {
          code: invalid,
          partnerPercent: 10,
        }),
      );
    }
    await assert.rejects(transform(UpdateAffiliateCodeRequestDTO, {}));
    await assert.doesNotReject(
      transform(UpdateAffiliateCodeRequestDTO, { comment: null }),
    );
    await assert.rejects(
      transform(CreateAffiliateCodeRequestDTO, {
        comment: "x".repeat(501),
        partnerPercent: 10,
      }),
    );
    await assert.rejects(
      transform(UpdateAffiliateCodeRequestDTO, {
        code: "CHANGED",
        partnerPercent: 10,
      }),
    );
    await assert.rejects(
      transform(ListAffiliateCodesQueryDTO, { pageSize: 101 }),
    );
    await assert.rejects(
      transform(ListAffiliateCodesQueryDTO, {
        page: String(2_147_483_648),
      }),
    );
  });

  it("protects both controllers and checks admin rights on the server", () => {
    for (const controller of [
      AffiliateCodesController,
      AdminAffiliateCodesController,
    ]) {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ??
        []) as unknown[];
      assert.equal(guards.includes(AuthGuard), true);
    }

    const controller = new AdminAffiliateCodesController(
      {} as AffiliateCodesService,
      new UsersService({} as PrismaService),
    );
    assert.throws(
      () =>
        controller.list(
          "user-1",
          { page: 1, pageSize: 20 },
          { user: { ...partnerUser(), roles: ["customer"] } },
        ),
      ForbiddenException,
    );
  });
});

describe("AffiliateCodesService", () => {
  it("creates boundary rates with a fixed 20 percent budget and private comment", async () => {
    for (const partnerPercent of [0, 15]) {
      const fixture = createFixture();
      const result = await fixture.service.createOwn(partnerUser(), {
        code: `RATE${partnerPercent}`,
        comment: " private ",
        partnerPercent,
      });

      assert.equal(result.partnerPercent, partnerPercent);
      assert.equal(result.buyerPercent, 20 - partnerPercent);
      assert.equal(result.comment, "private");
      assert.equal(fixture.createdData()?.basisPoints, (20 - partnerPercent) * 100);
      assert.equal(fixture.createdData()?.affiliatePartnerId, "partner-1");
    }
  });

  it("returns the exact paginated private response contract", async () => {
    const fixture = createFixture();
    const result = await fixture.service.listOwn(partnerUser(), {
      page: 2,
      pageSize: 20,
    });
    const response = result as typeof result & { limit: number };

    assert.deepEqual(Object.keys(result.items[0]!).sort(), [
      "buyerPercent",
      "code",
      "comment",
      "createdAt",
      "id",
      "isActive",
      "partnerPercent",
      "updatedAt",
    ]);
    assert.equal(result.items[0]?.comment, "private");
    assert.deepEqual(
      {
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
        limit: response.limit,
      },
      { total: 1, page: 2, pageSize: 20, limit: 3 },
    );
    assert.deepEqual(
      await validate(plainToInstance(AffiliateCodeListDTO, response)),
      [],
    );
    assert.equal(
      (
        await validate(
          plainToInstance(AffiliateCodeListDTO, { ...response, limit: 0 }),
        )
      ).length > 0,
      true,
    );
    assert.deepEqual(fixture.listWindow(), { skip: 20, take: 20 });

    const adminResult = await fixture.service.listAdmin("user-1", {
      page: 1,
      pageSize: 20,
    });
    assert.equal((adminResult as typeof adminResult & { limit: number }).limit, 3);
  });

  it("allows the third code but rejects partners already at or above the limit", async () => {
    const belowLimit = createFixture({ existingCodeCount: 2 });
    await assert.doesNotReject(
      belowLimit.service.createOwn(partnerUser(), { partnerPercent: 10 }),
    );
    assert.equal(belowLimit.createAttempts(), 1);

    for (const existingCodeCount of [3, 4]) {
      const atLimit = createFixture({ existingCodeCount });
      await assert.rejects(
        atLimit.service.createOwn(partnerUser(), { partnerPercent: 10 }),
        (error: unknown) => {
          if (!(error instanceof ConflictException)) return false;
          assert.equal(error.message, "Можно создать не более 3 промокодов");
          assert.deepEqual(error.getResponse(), {
            message: "Можно создать не более 3 промокодов",
            code: "affiliate_code_limit",
          });
          return true;
        },
      );
      assert.equal(atLimit.createAttempts(), 0);
    }
  });

  it("counts inactive own codes", async () => {
    const fixture = createFixture({
      existingCodes: [
        { affiliatePartnerId: "partner-1", isActive: true },
        { affiliatePartnerId: "partner-1", isActive: true },
        { affiliatePartnerId: "partner-1", isActive: false },
      ],
    });
    await assert.rejects(
      fixture.service.createOwn(partnerUser(), { partnerPercent: 10 }),
      ConflictException,
    );
  });

  it("does not count another partner's codes", async () => {
    const fixture = createFixture({
      existingCodes: [
        { affiliatePartnerId: "partner-1", isActive: true },
        { affiliatePartnerId: "partner-1", isActive: false },
        { affiliatePartnerId: "partner-2", isActive: true },
        { affiliatePartnerId: "partner-2", isActive: true },
        { affiliatePartnerId: "partner-2", isActive: true },
        { affiliatePartnerId: "partner-2", isActive: false },
      ],
    });
    await fixture.service.createOwn(partnerUser(), { partnerPercent: 10 });

    assert.deepEqual(fixture.countFilters(), [
      { affiliatePartnerId: "partner-1", kind: "AFFILIATE" },
    ]);
  });

  it("allows updates when the partner is already at the code limit", async () => {
    const fixture = createFixture({ existingCodeCount: 3 });
    const result = await fixture.service.updateOwn(partnerUser(), "code-1", {
      isActive: false,
    });

    assert.equal(result.isActive, false);
    assert.deepEqual(fixture.countFilters(), []);
  });

  it("serializes concurrent creates before counting the partner's codes", async () => {
    const fixture = createFixture({
      existingCodeCount: 2,
      serializeTransactions: true,
    });
    const results = await Promise.allSettled([
      fixture.service.createOwn(partnerUser(), { code: "FIRST", partnerPercent: 10 }),
      fixture.service.createOwn(partnerUser(), { code: "SECOND", partnerPercent: 10 }),
    ]);

    assert.deepEqual(
      results.map((result) => result.status),
      ["fulfilled", "rejected"],
    );
    assert.equal(fixture.createAttempts(), 1);
    assert.deepEqual(fixture.createFlow(), [
      "lock:user",
      "count:2",
      "create",
      "lock:user",
      "count:3",
    ]);
  });

  it("keeps pagination skip within the signed Prisma Int range", async () => {
    const boundary = createFixture();
    await boundary.service.listOwn(partnerUser(), {
      page: 21_474_837,
      pageSize: 100,
    });
    assert.deepEqual(boundary.listWindow(), {
      skip: 2_147_483_600,
      take: 100,
    });

    await assert.rejects(
      createFixture().service.listOwn(partnerUser(), {
        page: 21_474_838,
        pageSize: 100,
      }),
    );
  });

  it("maps manual duplicates to conflict and retries generated collisions", async () => {
    const manual = createFixture({ collisions: 1 });
    await assert.rejects(
      manual.service.createOwn(partnerUser(), {
        code: "DUPLICATE",
        partnerPercent: 10,
      }),
      ConflictException,
    );

    const generated = createFixture({ collisions: 1 });
    const result = await generated.service.createOwn(partnerUser(), {
      partnerPercent: 10,
    });
    assert.match(result.code, /^ARTM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    assert.equal(generated.createAttempts(), 2);

    const unrelated = createFixture({
      collisions: 1,
      collisionTarget: ["affiliate_partner_id"],
    });
    await assert.rejects(
      unrelated.service.createOwn(partnerUser(), { partnerPercent: 10 }),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "P2002",
    );
    assert.equal(unrelated.createAttempts(), 1);

    const namedCodeConstraint = createFixture({
      collisions: 1,
      collisionTarget: "promo_codes_code_key",
    });
    await namedCodeConstraint.service.createOwn(partnerUser(), {
      partnerPercent: 10,
    });
    assert.equal(namedCodeConstraint.createAttempts(), 2);

    const primaryKey = createFixture({
      collisions: 1,
      collisionTarget: "promo_codes_pkey",
    });
    await assert.rejects(
      primaryKey.service.createOwn(partnerUser(), { partnerPercent: 10 }),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "P2002",
    );
    assert.equal(primaryKey.createAttempts(), 1);
  });

  it("recognizes exact PrismaPg driver metadata for code collisions", async () => {
    const manual = createFixture({
      collisionError: driverAdapterError("UniqueConstraintViolation", ["code"]),
      collisions: 1,
    });
    await assert.rejects(
      manual.service.createOwn(partnerUser(), {
        code: "DUPLICATE",
        partnerPercent: 10,
      }),
      ConflictException,
    );

    const generated = createFixture({
      collisionError: driverAdapterError("UniqueConstraintViolation", ["code"]),
      collisions: 1,
    });
    await generated.service.createOwn(partnerUser(), { partnerPercent: 10 });
    assert.equal(generated.createAttempts(), 2);

    for (const collisionError of [
      driverAdapterError("UniqueConstraintViolation", ["id"]),
      driverAdapterError("NullConstraintViolation", ["code"]),
      new Prisma.PrismaClientKnownRequestError("not unique", {
        clientVersion: "test",
        code: "P2003",
        meta: {
          driverAdapterError: {
            cause: {
              kind: "UniqueConstraintViolation",
              constraint: { fields: ["code"] },
            },
          },
        },
      }),
    ]) {
      const fixture = createFixture({ collisionError, collisions: 1 });
      await assert.rejects(
        fixture.service.createOwn(partnerUser(), { partnerPercent: 10 }),
        (error: unknown) => error === collisionError,
      );
      assert.equal(fixture.createAttempts(), 1);
    }
  });

  it("defensively rejects malformed direct service inputs", async () => {
    const fixture = createFixture();
    for (const partnerPercent of [null, true, "10", 1.5, 16]) {
      await assert.rejects(
        fixture.service.createOwn(partnerUser(), {
          partnerPercent,
        } as never),
      );
      await assert.rejects(
        fixture.service.updateOwn(partnerUser(), "code-1", {
          partnerPercent,
        } as never),
      );
    }
    await assert.rejects(
      fixture.service.updateOwn(partnerUser(), "code-1", {}),
    );
    await assert.rejects(
      fixture.service.updateOwn(partnerUser(), "code-1", {
        isActive: null,
      } as never),
    );
    await assert.rejects(
      fixture.service.listOwn(partnerUser(), {
        page: Number.MAX_SAFE_INTEGER,
        pageSize: 100,
      }),
    );
  });

  it("requires an active account, current role and active profile", async () => {
    for (const state of [
      { accountActive: false },
      { hasPartnerRole: false },
      { partnerActive: false },
    ]) {
      const fixture = createFixture(state);
      await assert.rejects(
        fixture.service.listOwn(partnerUser(), { page: 1, pageSize: 20 }),
        ForbiddenException,
      );
      await assert.rejects(
        fixture.service.createOwn(partnerUser(), { partnerPercent: 10 }),
        ForbiddenException,
      );
    }
  });

  it("enforces ownership and keeps code immutable", async () => {
    const fixture = createFixture({ codeOwnerId: "partner-2" });
    await assert.rejects(
      fixture.service.updateOwn(partnerUser(), "code-1", { isActive: false }),
      NotFoundException,
    );
    await assert.rejects(
      fixture.service.updateAdmin("user-1", "code-1", { isActive: false }),
      NotFoundException,
    );

    const own = createFixture();
    const updated = await own.service.updateOwn(partnerUser(), "code-1", {
      comment: " changed ",
      isActive: false,
      partnerPercent: 15,
    });
    assert.equal(updated.code, "OWNCODE");
    assert.equal(updated.comment, "changed");
    assert.equal(updated.partnerPercent, 15);
    assert.equal(updated.buyerPercent, 5);
  });

  it("locks the partner account before its promo row", async () => {
    const fixture = createFixture();
    await fixture.service.updateOwn(partnerUser(), "code-1", {
      partnerPercent: 9,
    });
    assert.deepEqual(fixture.locks(), ["user", "promo"]);
  });
});

function createFixture(
  options: {
    accountActive?: boolean;
    codeOwnerId?: string;
    collisionError?: Error;
    collisions?: number;
    collisionTarget?: unknown;
    existingCodeCount?: number;
    existingCodes?: Array<{
      affiliatePartnerId: string;
      isActive: boolean;
    }>;
    hasPartnerRole?: boolean;
    partnerActive?: boolean;
    serializeTransactions?: boolean;
  } = {},
) {
  let collisions = options.collisions ?? 0;
  let attempts = 0;
  let created: Record<string, unknown> | undefined;
  const locks: string[] = [];
  const countFilters: Array<Record<string, unknown>> = [];
  const createFlow: string[] = [];
  const existingCodes =
    options.existingCodes ??
    Array.from({ length: options.existingCodeCount ?? 1 }, () => ({
      affiliatePartnerId: "partner-1",
      isActive: true,
    }));
  let transactionQueue = Promise.resolve();
  let listWindow: { skip: number; take: number } | undefined;
  const storedCode = () => ({
    id: "code-1",
    code: "OWNCODE",
    kind: "AFFILIATE",
    name: "OWNCODE",
    description: null,
    type: "PERCENTAGE",
    basisPoints: 1_000,
    amountKopecks: null,
    maxDiscountKopecks: null,
    minSubtotalKopecks: 0n,
    startsAt: null,
    endsAt: null,
    maxUses: null,
    maxUsesPerUser: null,
    isActive: true,
    usedCount: 0,
    reservedCount: 0,
    affiliatePartnerId: options.codeOwnerId ?? "partner-1",
    affiliatePartnerPercent: 10,
    affiliateComment: "private",
    createdAt: new Date("2026-09-16T00:00:00.000Z"),
    updatedAt: new Date("2026-09-16T00:00:00.000Z"),
  });
  const partner = {
    id: "partner-1",
    userId: "user-1",
    status: options.partnerActive === false ? "SUSPENDED" : "ACTIVE",
    user: {
      id: "user-1",
      roles:
        options.hasPartnerRole === false
          ? ["CUSTOMER"]
          : ["CUSTOMER", "PARTNER"],
      status: options.accountActive === false ? "BLOCKED" : "ACTIVE",
    },
  };
  const tx = {
    $queryRaw: async (query: { strings?: readonly string[] }) => {
      const sql = query.strings?.join("") ?? String(query);
      if (sql.includes('FROM "users"')) {
        locks.push("user");
        createFlow.push("lock:user");
      }
      if (sql.includes('FROM "promo_codes"')) locks.push("promo");
      return [{ id: sql.includes('FROM "users"') ? "user-1" : "code-1" }];
    },
    affiliatePartner: {
      findUnique: async () => partner,
    },
    promoCode: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        countFilters.push(where);
        const existingCodeCount = existingCodes.filter(
          (code) => code.affiliatePartnerId === where.affiliatePartnerId,
        ).length;
        createFlow.push(`count:${existingCodeCount}`);
        return existingCodeCount;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        attempts += 1;
        createFlow.push("create");
        if (collisions > 0) {
          collisions -= 1;
          if (options.collisionError) throw options.collisionError;
          const error = new Error("duplicate") as Error & { code: string };
          error.code = "P2002";
          Object.assign(error, {
            meta: { target: options.collisionTarget ?? ["code"] },
          });
          throw error;
        }
        created = data;
        existingCodes.push({
          affiliatePartnerId: String(data.affiliatePartnerId),
          isActive: Boolean(data.isActive),
        });
        return { ...storedCode(), ...data, id: `code-${attempts}` };
      },
      findUnique: async () => storedCode(),
      update: async ({ data }: { data: Record<string, unknown> }) => ({
        ...storedCode(),
        ...data,
      }),
    },
  };
  const prisma = {
    $transaction: async (
      input: ((client: typeof tx) => unknown) | Promise<unknown>[],
    ) => {
      if (Array.isArray(input)) return Promise.all(input);
      if (!options.serializeTransactions) return input(tx);
      const result = transactionQueue.then(() => input(tx));
      transactionQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    affiliatePartner: {
      findUnique: async () => partner,
    },
    promoCode: {
      count: async () => 1,
      findMany: async ({ skip, take }: { skip: number; take: number }) => {
        listWindow = { skip, take };
        return [storedCode()];
      },
    },
  } as unknown as PrismaService;

  return {
    createAttempts: () => attempts,
    countFilters: () => countFilters,
    createFlow: () => createFlow,
    createdData: () => created,
    locks: () => locks,
    listWindow: () => listWindow,
    service: new AffiliateCodesService(prisma),
  };
}

function driverAdapterError(kind: string, fields: string[]) {
  return new Prisma.PrismaClientKnownRequestError("driver adapter error", {
    clientVersion: "test",
    code: "P2002",
    meta: {
      driverAdapterError: {
        cause: { kind, constraint: { fields } },
      },
    },
  });
}

function partnerUser(): AuthUser {
  return {
    id: "user-1",
    provider: "credentials",
    providerUserId: "partner@example.com",
    roles: ["partner"],
  };
}

function transform<T extends object>(
  dto: new () => T,
  value: unknown,
): Promise<T> {
  return pipe.transform(value, {
    metatype: dto,
    type: "body",
  } as ArgumentMetadata);
}
