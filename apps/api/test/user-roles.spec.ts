import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import { CredentialsAuthService } from "../src/auth/credentials-auth.service";
import {
  AffiliatePartnerStatus,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { UsersService } from "../src/users/users.service";

const originalPasswordRoles = process.env.AUTH_PASSWORD_ROLES;

afterEach(() => {
  if (originalPasswordRoles === undefined) {
    delete process.env.AUTH_PASSWORD_ROLES;
  } else {
    process.env.AUTH_PASSWORD_ROLES = originalPasswordRoles;
  }
});

describe("partner user role", () => {
  it("maps partner between Prisma, API and normalized configuration roles", () => {
    const service = new UsersService({} as PrismaService);

    assert.deepEqual(service.mapPrismaRoles([PrismaUserRole.PARTNER]), [
      "partner",
    ]);
    assert.deepEqual(service.normalizeRoles([" PARTNER "]), ["partner"]);
    assert.deepEqual(service.getDefaultRoles(), ["customer"]);
  });

  it("maps AUTH_PASSWORD_ROLES partner to Prisma PARTNER", () => {
    process.env.AUTH_PASSWORD_ROLES = "partner";
    const usersService = new UsersService({} as PrismaService);
    const service = new CredentialsAuthService(
      {} as PrismaService,
      usersService,
    );

    const roles = (
      service as unknown as { getPrismaRoles(): PrismaUserRole[] }
    ).getPrismaRoles();

    assert.deepEqual(roles, [PrismaUserRole.PARTNER]);
  });

  it("preserves partner on env login only while the locked user has an active profile", async () => {
    process.env.AUTH_PASSWORD_ROLES = "admin";
    const fixture = createEnvLoginFixture(AffiliatePartnerStatus.ACTIVE);

    await fixture.upsert();

    assert.match(fixture.lockSql, /SELECT "id"[\s\S]*FOR UPDATE/u);
    assert.deepEqual(fixture.updatedRoles, [
      PrismaUserRole.ADMIN,
      PrismaUserRole.PARTNER,
    ]);
  });

  it("removes partner on env login when the locked user profile is suspended", async () => {
    process.env.AUTH_PASSWORD_ROLES = "admin,partner";
    const fixture = createEnvLoginFixture(AffiliatePartnerStatus.SUSPENDED);

    await fixture.upsert();

    assert.deepEqual(fixture.updatedRoles, [PrismaUserRole.ADMIN]);
  });

  it("rejects granting partner through the common role editor after locking the user", async () => {
    const fixture = createRoleUpdateFixture([PrismaUserRole.CUSTOMER]);

    await assert.rejects(
      fixture.service.updateAdminUserRoles(
        "user-1",
        ["customer", "partner"],
        fixture.actor,
      ),
      BadRequestException,
    );
    assert.equal(fixture.transactionCount, 1);
    assert.match(fixture.lockSql, /FROM "users"[\s\S]*FOR UPDATE/u);
    assert.equal(fixture.updatedRoles, undefined);
  });

  it("rejects revoking partner through the common role editor", async () => {
    const fixture = createRoleUpdateFixture([
      PrismaUserRole.CUSTOMER,
      PrismaUserRole.PARTNER,
    ]);

    await assert.rejects(
      fixture.service.updateAdminUserRoles(
        "user-1",
        ["customer"],
        fixture.actor,
      ),
      BadRequestException,
    );
    assert.equal(fixture.updatedRoles, undefined);
  });

  it("updates editable roles transactionally when partner membership is preserved", async () => {
    const fixture = createRoleUpdateFixture([
      PrismaUserRole.CUSTOMER,
      PrismaUserRole.PARTNER,
    ]);

    const user = await fixture.service.updateAdminUserRoles(
      "user-1",
      ["admin", "partner"],
      fixture.actor,
    );

    assert.deepEqual(fixture.updatedRoles, [
      PrismaUserRole.ADMIN,
      PrismaUserRole.PARTNER,
    ]);
    assert.deepEqual(user.roles, ["admin", "partner"]);
    assert.equal(fixture.transactionCount, 1);
  });
});

function createRoleUpdateFixture(currentRoles: PrismaUserRole[]) {
  let transactionCount = 0;
  let lockSql = "";
  let updatedRoles: PrismaUserRole[] | undefined;
  const storedUser = {
    authAccounts: [],
    createdAt: new Date("2026-09-16T00:00:00.000Z"),
    email: "user@example.com",
    emailVerifiedAt: new Date("2026-09-16T00:00:00.000Z"),
    id: "user-1",
    image: null,
    name: "User",
    phone: null,
    roles: currentRoles,
    status: PrismaUserStatus.ACTIVE,
    telegramAccount: null,
    updatedAt: new Date("2026-09-16T00:00:00.000Z"),
  };
  const transaction = {
    $queryRaw: async (query: { text: string }) => {
      lockSql = query.text;
      return [{ id: storedUser.id }];
    },
    user: {
      findUnique: async () => ({ roles: currentRoles }),
      update: async ({ data }: { data: { roles: PrismaUserRole[] } }) => {
        updatedRoles = data.roles;
        return { ...storedUser, roles: data.roles };
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
    actor: {
      id: "admin-1",
      provider: "credentials" as const,
      providerUserId: "admin@example.com",
      roles: ["admin" as const],
    },
    get lockSql() {
      return lockSql;
    },
    service: new UsersService(prisma),
    get transactionCount() {
      return transactionCount;
    },
    get updatedRoles() {
      return updatedRoles;
    },
  };
}

function createEnvLoginFixture(profileStatus: AffiliatePartnerStatus) {
  let lockSql = "";
  let updatedRoles: PrismaUserRole[] | undefined;
  const user = {
    authVersion: 1,
    email: "admin@example.com",
    id: "user-1",
    image: null,
    name: "Admin",
    phone: null,
    roles: [PrismaUserRole.ADMIN, PrismaUserRole.PARTNER],
  };
  const account = {
    id: "account-1",
    providerUserId: user.email,
    providerEmail: user.email,
    user,
  };
  const transaction = {
    $queryRaw: async (query: { text: string }) => {
      lockSql = query.text;
      return [{ id: user.id }];
    },
    authAccount: {
      findUnique: async () => account,
      update: async ({
        data,
      }: {
        data: { user: { update: { roles: PrismaUserRole[] } } };
      }) => {
        updatedRoles = data.user.update.roles;
        return { ...account, user: { ...user, roles: updatedRoles } };
      },
    },
    user: {
      findUnique: async () => ({
        affiliatePartner: { status: profileStatus },
      }),
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
  } as unknown as PrismaService;
  const service = new CredentialsAuthService(prisma, new UsersService(prisma));

  return {
    get lockSql() {
      return lockSql;
    },
    get updatedRoles() {
      return updatedRoles;
    },
    upsert: () =>
      (
        service as unknown as {
          upsertEnvCredentialsUser(email: string): Promise<unknown>;
        }
      ).upsertEnvCredentialsUser(user.email),
  };
}
