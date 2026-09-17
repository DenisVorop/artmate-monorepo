import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ArgumentMetadata,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ValidationPipe,
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import {
  AdminAffiliateController,
  AffiliateController,
} from "../src/affiliate/affiliate.controller";
import { isAffiliateContractDateInFuture } from "../src/affiliate/affiliate-date";
import {
  ListAffiliatePartnersQueryDTO,
  PutAffiliatePartnerRequestDTO,
} from "../src/affiliate/dto";
import { AffiliateService } from "../src/affiliate/affiliate.service";
import { AuthGuard } from "../src/auth/auth.guard";
import {
  AffiliatePartnerStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { UsersService } from "../src/users/users.service";

const pipe = new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
});

describe("affiliate HTTP contract", () => {
  it("validates all PUT fields, payout limits and contract date", async () => {
    const dto = await transform(PutAffiliatePartnerRequestDTO, validInput());
    assert.equal(dto.contract.number, "A-1");

    for (const input of [
      { ...validInput(), minimumPayoutKopecks: 0 },
      { ...validInput(), minimumPayoutKopecks: Number.MAX_SAFE_INTEGER + 1 },
      { ...validInput(), partnerApplicationId: "" },
      { ...validInput(), contract: { ...validInput().contract, number: " " } },
      { ...validInput(), unexpected: true },
    ]) {
      await assert.rejects(transform(PutAffiliatePartnerRequestDTO, input));
    }
  });

  it("defaults and bounds partner search pagination", async () => {
    const defaults = await transform(ListAffiliatePartnersQueryDTO, {});
    assert.deepEqual(
      { page: defaults.page, pageSize: defaults.pageSize },
      { page: 1, pageSize: 25 },
    );

    const query = await transform(ListAffiliatePartnersQueryDTO, {
      page: "2",
      pageSize: "100",
      search: "  creator@example.com  ",
    });
    assert.deepEqual(
      { page: query.page, pageSize: query.pageSize, search: query.search },
      { page: 2, pageSize: 100, search: "creator@example.com" },
    );

    await assert.rejects(
      transform(ListAffiliatePartnersQueryDTO, { pageSize: 101 }),
    );
    await assert.rejects(
      transform(ListAffiliatePartnersQueryDTO, { search: "x".repeat(201) }),
    );
  });

  it("protects partner and admin controllers with the auth guard", () => {
    const partnerGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      AffiliateController,
    ) ?? []) as unknown[];
    const adminGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      AdminAffiliateController,
    ) ?? []) as unknown[];

    assert.equal(partnerGuards.includes(AuthGuard), true);
    assert.equal(adminGuards.includes(AuthGuard), true);
  });

  it("checks admin rights on the server", () => {
    const users = new UsersService({} as PrismaService);
    const controller = new AdminAffiliateController(
      {} as AffiliateService,
      users,
    );

    assert.throws(
      () =>
        controller.listPartners(
          { page: 1, pageSize: 25 },
          { user: authUser(["customer"]) },
        ),
      ForbiddenException,
    );
  });
});

describe("AffiliateService", () => {
  it("compares the UTC contract date with the current Moscow calendar date", () => {
    const firstMoscowHours = new Date("2026-09-16T21:30:00.000Z");

    assert.equal(
      isAffiliateContractDateInFuture(
        new Date("2026-09-17T00:00:00.000Z"),
        firstMoscowHours,
      ),
      false,
    );
    assert.equal(
      isAffiliateContractDateInFuture(
        new Date("2026-09-18T00:00:00.000Z"),
        firstMoscowHours,
      ),
      true,
    );
  });

  it("does not return payment details in the paginated list", async () => {
    let findManyArgs: unknown;
    const prisma = {
      affiliatePartner: {
        findMany: (args: unknown) => {
          findManyArgs = args;
          return Promise.resolve([storedPartner()]);
        },
        count: async () => 1,
      },
      $transaction: async (queries: Promise<unknown>[]) => Promise.all(queries),
    } as unknown as PrismaService;
    const result = await new AffiliateService(prisma).listPartners({
      page: 1,
      pageSize: 25,
      search: " creator@example.com ",
    });

    assert.equal("contract" in result.items[0]!, false);
    assert.equal("paymentDetails" in result.items[0]!, false);
    assert.equal(
      JSON.stringify(findManyArgs).includes("contractPaymentDetails"),
      false,
    );
    assert.equal(result.total, 1);
  });

  it("denies /me without both a current partner role and active profile", async () => {
    const suspendedPrisma = {
      affiliatePartner: {
        findUnique: async () =>
          storedPartner({ status: AffiliatePartnerStatus.SUSPENDED }),
      },
    } as unknown as PrismaService;
    const service = new AffiliateService(suspendedPrisma);

    await assert.rejects(
      service.getCurrentPartner(authUser(["partner"])),
      ForbiddenException,
    );
    await assert.rejects(
      service.getCurrentPartner(authUser(["customer"])),
      ForbiddenException,
    );
  });

  it("atomically creates an active profile, grants partner and writes revision 1", async () => {
    const fixture = createPutFixture();

    const result = await fixture.service.putPartner(
      "user-1",
      validInput(),
      authUser(["admin"]),
    );

    assert.equal(fixture.transactionCount, 1);
    assert.deepEqual(fixture.updatedRoles, [
      UserRole.CUSTOMER,
      UserRole.PARTNER,
    ]);
    assert.equal(fixture.createdRevision?.version, 1);
    assert.equal(result.contractVersion, 1);
  });

  it("allows an active Yandex account without credentials email verification", async () => {
    const fixture = createPutFixture({
      emailVerified: false,
      hasYandexAccount: true,
    });

    await assert.doesNotReject(
      fixture.service.putPartner("user-1", validInput(), authUser(["admin"])),
    );
    assert.deepEqual(fixture.updatedRoles, [
      UserRole.CUSTOMER,
      UserRole.PARTNER,
    ]);
  });

  it("rejects an unverified credentials-only account", async () => {
    const fixture = createPutFixture({ emailVerified: false });

    await assert.rejects(
      fixture.service.putPartner("user-1", validInput(), authUser(["admin"])),
      BadRequestException,
    );
  });

  it("suspends a profile and revokes partner without creating a contract revision", async () => {
    const fixture = createPutFixture({ existingPartner: storedPartner() });

    await fixture.service.putPartner(
      "user-1",
      validInput({ status: "suspended" }),
      authUser(["admin"]),
    );

    assert.deepEqual(fixture.updatedRoles, [UserRole.CUSTOMER]);
    assert.equal(fixture.createdRevision, undefined);
  });

  it("creates a new immutable revision only when contract fields change", async () => {
    const fixture = createPutFixture({ existingPartner: storedPartner() });

    const result = await fixture.service.putPartner(
      "user-1",
      validInput({
        contract: { ...validInput().contract, paymentDetails: "New details" },
      }),
      authUser(["admin"]),
    );

    assert.equal(fixture.createdRevision?.version, 2);
    assert.equal(fixture.createdRevision?.changedByUserId, "admin-1");
    assert.equal(result.contractVersion, 2);
  });

  it("rejects future contracts and application collisions", async () => {
    const fixture = createPutFixture({ applicationOwnerId: "user-2" });

    await assert.rejects(
      fixture.service.putPartner(
        "user-1",
        validInput({
          contract: {
            ...validInput().contract,
            signedAt: nextMoscowCalendarDay(),
          },
        }),
        authUser(["admin"]),
      ),
      BadRequestException,
    );
    await assert.rejects(
      fixture.service.putPartner("user-1", validInput(), authUser(["admin"])),
      ConflictException,
    );
  });

  it("maps a database application uniqueness race to conflict", async () => {
    const fixture = createPutFixture({ collisionOnCreate: true });

    await assert.rejects(
      fixture.service.putPartner("user-1", validInput(), authUser(["admin"])),
      ConflictException,
    );
  });
});

function createPutFixture(
  options: {
    existingPartner?: ReturnType<typeof storedPartner>;
    applicationOwnerId?: string;
    collisionOnCreate?: boolean;
    emailVerified?: boolean;
    hasYandexAccount?: boolean;
  } = {},
) {
  let transactionCount = 0;
  let updatedRoles: UserRole[] | undefined;
  let createdRevision: { version: number; changedByUserId: string } | undefined;
  let currentPartner = options.existingPartner;
  const transaction = {
    $queryRaw: async () => [{ id: "user-1" }],
    user: {
      findUnique: async () => ({
        email: "creator@example.com",
        emailVerifiedAt:
          options.emailVerified === false
            ? null
            : new Date("2026-01-01T00:00:00.000Z"),
        id: "user-1",
        name: "Creator",
        roles: [
          UserRole.CUSTOMER,
          ...(currentPartner ? [UserRole.PARTNER] : []),
        ],
        status: UserStatus.ACTIVE,
        authAccounts: options.hasYandexAccount ? [{ id: "yandex-1" }] : [],
        affiliatePartner: currentPartner ?? null,
      }),
      update: async ({ data }: { data: { roles: UserRole[] } }) => {
        updatedRoles = data.roles;
        return { id: "user-1" };
      },
    },
    partnerApplication: {
      findUnique: async () => ({
        affiliatePartner: options.applicationOwnerId
          ? { userId: options.applicationOwnerId }
          : null,
        id: "application-1",
      }),
    },
    affiliatePartner: {
      findUnique: async () => currentPartner ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options.collisionOnCreate) {
          throw new Prisma.PrismaClientKnownRequestError("collision", {
            clientVersion: "test",
            code: "P2002",
            meta: { target: ["partner_application_id"] },
          });
        }
        currentPartner = storedPartner(data);
        return currentPartner;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        currentPartner = storedPartner({ ...currentPartner, ...data });
        return currentPartner;
      },
    },
    affiliateContractRevision: {
      create: async ({
        data,
      }: {
        data: { version: number; changedByUserId: string };
      }) => {
        createdRevision = data;
        return data;
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transaction) => unknown) => {
      transactionCount += 1;
      return callback(transaction);
    },
  } as unknown as PrismaService;

  return {
    get createdRevision() {
      return createdRevision;
    },
    service: new AffiliateService(prisma),
    get transactionCount() {
      return transactionCount;
    },
    get updatedRoles() {
      return updatedRoles;
    },
  };
}

function storedPartner(overrides: Record<string, unknown> = {}) {
  return {
    id: "partner-1",
    userId: "user-1",
    user: { email: "creator@example.com", name: "Creator" },
    status: AffiliatePartnerStatus.ACTIVE,
    partnerApplicationId: "application-1",
    minimumPayoutKopecks: 500_000n,
    contractNumber: "A-1",
    contractSignedAt: new Date("2026-09-01T00:00:00.000Z"),
    contractPaymentDetails: "Payment details",
    contractVersion: 1,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    status: "active",
    partnerApplicationId: "application-1",
    minimumPayoutKopecks: null,
    contract: {
      number: " A-1 ",
      signedAt: "2026-09-01T00:00:00.000Z",
      paymentDetails: " Payment details ",
    },
    ...overrides,
  } as PutAffiliatePartnerRequestDTO;
}

function authUser(roles: Array<"admin" | "customer" | "partner">) {
  return {
    id: roles.includes("admin") ? "admin-1" : "user-1",
    provider: "credentials" as const,
    providerUserId: "user@example.com",
    roles,
  };
}

function nextMoscowCalendarDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Moscow",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + 1,
    ),
  ).toISOString();
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
