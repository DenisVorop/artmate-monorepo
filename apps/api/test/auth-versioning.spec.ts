import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, it } from "node:test";

import { UnauthorizedException } from "@nestjs/common";
import { PGlite } from "@electric-sql/pglite";

import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { CredentialsAuthService } from "../src/auth/credentials-auth.service";
import type { AuthTokenPayload, AuthUser } from "../src/auth/auth.types";
import { YandexOAuthService } from "../src/auth/yandex-oauth.service";
import { UserStatus } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { UsersService } from "../src/users/users.service";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260907160000_add_user_auth_version/migration.sql",
);
const usersSchemaPath = resolve(__dirname, "../prisma/schema/users.prisma");

const payloadUser: AuthUser = {
  id: "user-1",
  provider: "credentials",
  providerUserId: "buyer@example.com",
  email: "buyer@example.com",
  roles: ["customer"],
};

const originalAuthEnv = {
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  AUTH_PASSWORD_EMAIL: process.env.AUTH_PASSWORD_EMAIL,
  AUTH_PASSWORD_HASH: process.env.AUTH_PASSWORD_HASH,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  restoreEnv("AUTH_JWT_SECRET", originalAuthEnv.AUTH_JWT_SECRET);
  restoreEnv("AUTH_PASSWORD", originalAuthEnv.AUTH_PASSWORD);
  restoreEnv("AUTH_PASSWORD_EMAIL", originalAuthEnv.AUTH_PASSWORD_EMAIL);
  restoreEnv("AUTH_PASSWORD_HASH", originalAuthEnv.AUTH_PASSWORD_HASH);
  restoreEnv("NODE_ENV", originalAuthEnv.NODE_ENV);
});

describe("access JWT auth versioning", () => {
  it("adds a non-null auth version with a zero default and backfills existing users", async () => {
    const schema = await readFile(usersSchemaPath, "utf8");
    assert.match(
      schema,
      /authVersion\s+Int\s+@default\(0\)\s+@map\("auth_version"\)/u,
    );

    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE "users" ("id" TEXT PRIMARY KEY);`);
      await db.query(`INSERT INTO "users" ("id") VALUES ('existing-user')`);
      await db.exec(await readFile(migrationPath, "utf8"));

      const existing = await db.query<{ authVersion: number }>(
        `SELECT "auth_version" AS "authVersion" FROM "users" WHERE "id" = 'existing-user'`,
      );
      assert.equal(existing.rows[0]?.authVersion, 0);

      await db.query(`INSERT INTO "users" ("id") VALUES ('new-user')`);
      const created = await db.query<{ authVersion: number }>(
        `SELECT "auth_version" AS "authVersion" FROM "users" WHERE "id" = 'new-user'`,
      );
      assert.equal(created.rows[0]?.authVersion, 0);
      await assert.rejects(
        db.query(
          `INSERT INTO "users" ("id", "auth_version") VALUES ('invalid-user', -1)`,
        ),
      );
    } finally {
      await db.close();
    }
  });

  it("signs the authentication snapshot version without rereading the user", async () => {
    const signedPayloads: AuthTokenPayload[] = [];
    let userReads = 0;
    const service = createAuthService({
      onSign: (payload) => signedPayloads.push(payload),
      onUserRead: () => {
        userReads += 1;
        return null;
      },
    });

    await service.createAccessToken({ ...payloadUser, authVersion: 4 } as never);

    assert.equal(userReads, 0);
    assert.equal(
      (signedPayloads[0] as AuthTokenPayload & { authVersion?: number })
        ?.authVersion,
      4,
    );
  });

  it("refuses to issue JWTs with invalid auth versions", async () => {
    for (const authVersion of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      let signed = false;
      const service = createAuthService({
        onSign: () => {
          signed = true;
        },
      });

      await assert.rejects(
        service.createAccessToken({ ...payloadUser, authVersion } as never),
      );
      assert.equal(signed, false);
    }
  });

  it("rereads authVersion and requires an exact claim match", async () => {
    for (const [claim, stored, accepted] of [
      [3, 3, true],
      [2, 3, false],
      [4, 3, false],
    ] as const) {
      const service = createAuthService({
        payload: {
          ...toPayload(payloadUser),
          authVersion: claim,
        } as AuthTokenPayload,
        storedAuthVersion: stored,
      });

      if (accepted) {
        assert.equal((await service.verifyAccessToken("token")).id, "user-1");
      } else {
        await assert.rejects(
          service.verifyAccessToken("token"),
          UnauthorizedException,
        );
      }
    }
  });

  it("accepts legacy claim-less JWTs only while the stored version remains zero", async () => {
    const legacyPayload = toPayload(payloadUser);
    const accepted = createAuthService({
      payload: legacyPayload,
      storedAuthVersion: 0,
    });
    const revoked = createAuthService({
      payload: legacyPayload,
      storedAuthVersion: 1,
    });

    assert.equal((await accepted.verifyAccessToken("legacy")).id, "user-1");
    await assert.rejects(
      revoked.verifyAccessToken("legacy"),
      UnauthorizedException,
    );
  });

  it("rejects malformed authVersion claims", async () => {
    for (const authVersion of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "0", null]) {
      const service = createAuthService({
        payload: { ...toPayload(payloadUser), authVersion } as never,
        storedAuthVersion: 0,
      });

      await assert.rejects(
        service.verifyAccessToken("malformed"),
        UnauthorizedException,
      );
    }
  });

  it("applies version checks after resolving a legacy provider-based sub", async () => {
    const legacyPayload = {
      ...toPayload(payloadUser),
      sub: "credentials:buyer@example.com",
    };
    const accepted = createAuthService({
      legacyAuthVersion: 0,
      payload: legacyPayload,
      storedUserMissing: true,
    });
    const revoked = createAuthService({
      legacyAuthVersion: 1,
      payload: legacyPayload,
      storedUserMissing: true,
    });

    assert.equal((await accepted.verifyAccessToken("legacy-sub")).id, "user-1");
    await assert.rejects(
      revoked.verifyAccessToken("legacy-sub"),
      UnauthorizedException,
    );
  });

  it("rejects a claim-less legacy env JWT without writing to Prisma", async () => {
    const fixture = createLegacyEnvVerificationFixture({ omitBinding: true });

    await assert.rejects(
      fixture.service.verifyAccessToken("claim-less-legacy-env"),
      UnauthorizedException,
    );
    assert.deepEqual(fixture.writes, {
      creates: 0,
      transactions: 0,
      updates: 0,
    });
  });

  it("rejects a wrong-binding legacy env JWT without writing to Prisma", async () => {
    const fixture = createLegacyEnvVerificationFixture({
      envCredentialBinding: "wrong-binding",
    });

    await assert.rejects(
      fixture.service.verifyAccessToken("wrong-binding-legacy-env"),
      UnauthorizedException,
    );
    assert.deepEqual(fixture.writes, {
      creates: 0,
      transactions: 0,
      updates: 0,
    });
  });

  it("rejects a stale legacy env JWT without writing to Prisma", async () => {
    const fixture = createLegacyEnvVerificationFixture({
      authVersion: 1,
      storedAuthVersion: 2,
    });

    await assert.rejects(
      fixture.service.verifyAccessToken("stale-legacy-env"),
      UnauthorizedException,
    );
    assert.deepEqual(fixture.writes, {
      creates: 0,
      transactions: 0,
      updates: 0,
    });
  });

  it("rejects a blocked legacy env JWT without writing to Prisma", async () => {
    const fixture = createLegacyEnvVerificationFixture({
      status: UserStatus.BLOCKED,
    });

    await assert.rejects(
      fixture.service.verifyAccessToken("blocked-legacy-env"),
      UnauthorizedException,
    );
    assert.deepEqual(fixture.writes, {
      creates: 0,
      transactions: 0,
      updates: 0,
    });
  });

  it("accepts a valid legacy env JWT for an existing active passwordless account without writing", async () => {
    const fixture = createLegacyEnvVerificationFixture();

    assert.equal(
      (await fixture.service.verifyAccessToken("valid-legacy-env")).id,
      "user-1",
    );
    assert.deepEqual(fixture.writes, {
      creates: 0,
      transactions: 0,
      updates: 0,
    });
  });

  it("keeps authVersion internal while signing every cookie session with it", async () => {
    const signedUsers: Array<AuthUser & { authVersion: number }> = [];
    const controller = Object.assign(Object.create(AuthController.prototype), {
      authService: {
        createAccessToken: async (user: AuthUser & { authVersion: number }) => {
          signedUsers.push(user);
          return "access-token";
        },
      },
    }) as AuthController;
    const cookies: unknown[] = [];
    const response = {
      cookie: (...args: unknown[]) => cookies.push(args),
      clearCookie: () => undefined,
    };
    const principal = { ...payloadUser, authVersion: 7 };
    const createCookieSession = (
      controller as unknown as {
        createCookieSession(response: unknown, user: typeof principal): Promise<unknown>;
      }
    ).createCookieSession;

    const session = await createCookieSession.call(controller, response, principal);

    assert.equal(signedUsers[0]?.authVersion, 7);
    assert.deepEqual(session, { user: payloadUser });
    assert.equal(cookies.length, 1);
  });

  it("uses captured versions for user/admin login, email verification and Yandex OAuth", async () => {
    const signedVersions: number[] = [];
    let credentialsVersion = 4;
    const authService = {
      createAccessToken: async (principal: { authVersion: number }) => {
        signedVersions.push(principal.authVersion);
        return "access-token";
      },
      getCookieValue: () => "valid-state",
    };
    const controller = Object.assign(Object.create(AuthController.prototype), {
      authService,
      credentialsAuthService: {
        getCredentialsUserById: async () => ({
          ...payloadUser,
          authVersion: 99,
        }),
        validateUser: async () => ({
          ...payloadUser,
          authVersion: credentialsVersion,
          roles:
            credentialsVersion === 5
              ? (["admin"] as const)
              : payloadUser.roles,
        }),
      },
      emailVerificationService: {
        confirmCode: async () => ({ authVersion: 6, id: payloadUser.id }),
      },
      loginThrottleService: {
        assertLoginAllowed: async () => undefined,
        recordSuccessfulLogin: async () => undefined,
      },
      oauthProvidersService: {
        getProvider: () => ({
          getUserByCode: async () => ({
            ...payloadUser,
            authVersion: 7,
            provider: "yandex" as const,
          }),
        }),
      },
      usersService: {
        assertRole: () => undefined,
      },
    }) as AuthController;
    const response = {
      clearCookie: () => undefined,
      cookie: () => undefined,
    };

    const loginSession = await controller.login(
      { email: "buyer@example.com", password: "password" },
      undefined,
      undefined,
      "127.0.0.1",
      response,
    );
    credentialsVersion = 5;
    const adminSession = await controller.loginAdmin(
      { email: "admin@example.com", password: "password" },
      undefined,
      undefined,
      "127.0.0.1",
      response,
    );
    const verificationSession = await controller.confirmEmailVerification(
      { code: "123456", email: "buyer@example.com" },
      response,
    );
    await controller.handleOAuthCallback(
      "yandex",
      "code",
      "valid-state",
      "auth_oauth_state_yandex=valid-state",
      response,
    );

    assert.deepEqual(signedVersions, [4, 5, 6, 7]);
    assert.equal("authVersion" in loginSession.user, false);
    assert.equal("authVersion" in adminSession.user, false);
    assert.equal("authVersion" in verificationSession.user, false);
  });

  it("captures authVersion in credentials and Yandex authentication results", () => {
    const usersService = {
      mapPrismaRoles: () => ["customer"],
    } as unknown as UsersService;
    const storedAccount = {
      providerUserId: "provider-user",
      providerEmail: "buyer@example.com",
      user: {
        ...payloadUser,
        authVersion: 9,
        roles: ["CUSTOMER"],
      },
    };
    const credentials = Object.assign(
      Object.create(CredentialsAuthService.prototype),
      { usersService },
    ) as CredentialsAuthService;
    const yandex = Object.assign(Object.create(YandexOAuthService.prototype), {
      usersService,
    }) as YandexOAuthService;

    const credentialsPrincipal = (
      credentials as unknown as {
        mapStoredAccount(account: typeof storedAccount): { authVersion: number };
      }
    ).mapStoredAccount(storedAccount);
    const yandexPrincipal = (
      yandex as unknown as {
        mapStoredAccount(account: typeof storedAccount): { authVersion: number };
      }
    ).mapStoredAccount(storedAccount);

    assert.equal(credentialsPrincipal.authVersion, 9);
    assert.equal(yandexPrincipal.authVersion, 9);
  });

  it("accepts the current env-backed token without exposing raw credentials in its claim", async () => {
    process.env.AUTH_JWT_SECRET = "test-jwt-secret";
    process.env.AUTH_PASSWORD_EMAIL = " Admin@Example.com ";
    process.env.AUTH_PASSWORD = "dev-plain-password";
    delete process.env.AUTH_PASSWORD_HASH;
    process.env.NODE_ENV = "development";
    const credentials = createEnvCredentialsService();
    const principal = await credentials.validateUser(
      "admin@example.com",
      "dev-plain-password",
    );
    let signedPayload: AuthTokenPayload | undefined;
    await createAuthService({
      onSign: (payload) => {
        signedPayload = payload;
      },
    }).createAccessToken(principal);

    assert.equal(typeof getEnvCredentialBinding(principal), "string");
    assert.equal(typeof getEnvCredentialBinding(signedPayload), "string");
    assert.doesNotMatch(
      JSON.stringify(signedPayload),
      /dev-plain-password/u,
    );
    assert.notEqual(
      getEnvCredentialBinding(signedPayload),
      "dev-plain-password",
    );

    const verifier = createAuthService({
      authAccountHasCredential: false,
      credentialsAuthService: credentials,
      payload: signedPayload,
    });
    assert.equal((await verifier.verifyAccessToken("current-env-token")).id, "user-1");
  });

  it("revokes an env-backed token after AUTH_PASSWORD_HASH rotation", async () => {
    process.env.AUTH_JWT_SECRET = "test-jwt-secret";
    process.env.AUTH_PASSWORD_EMAIL = "admin@example.com";
    process.env.NODE_ENV = "production";
    const credentials = createEnvCredentialsService();
    const configuredHash = await credentials.createPasswordHash("old-password");
    process.env.AUTH_PASSWORD_HASH = configuredHash;
    const payload = await issueEnvToken(credentials, "old-password");
    assert.equal(JSON.stringify(payload).includes(configuredHash), false);

    process.env.AUTH_PASSWORD_HASH = "scrypt:rotated-salt:rotated-hash";

    await assert.rejects(
      createAuthService({
        authAccountHasCredential: false,
        credentialsAuthService: credentials,
        payload,
      }).verifyAccessToken("rotated-env-token"),
      UnauthorizedException,
    );
  });

  it("revokes an env-backed token after AUTH_PASSWORD_HASH removal", async () => {
    process.env.AUTH_JWT_SECRET = "test-jwt-secret";
    process.env.AUTH_PASSWORD_EMAIL = "admin@example.com";
    process.env.NODE_ENV = "production";
    const credentials = createEnvCredentialsService();
    process.env.AUTH_PASSWORD_HASH = await credentials.createPasswordHash(
      "old-password",
    );
    const payload = await issueEnvToken(credentials, "old-password");

    delete process.env.AUTH_PASSWORD_HASH;

    await assert.rejects(
      createAuthService({
        authAccountHasCredential: false,
        credentialsAuthService: credentials,
        payload,
      }).verifyAccessToken("removed-env-hash-token"),
      UnauthorizedException,
    );
  });

  it("revokes an env-backed token after env identity changes", async () => {
    process.env.AUTH_JWT_SECRET = "test-jwt-secret";
    process.env.AUTH_PASSWORD_EMAIL = "admin@example.com";
    process.env.AUTH_PASSWORD = "dev-password";
    delete process.env.AUTH_PASSWORD_HASH;
    process.env.NODE_ENV = "development";
    const credentials = createEnvCredentialsService();
    const payload = await issueEnvToken(credentials, "dev-password");

    process.env.AUTH_PASSWORD_EMAIL = "other-admin@example.com";

    await assert.rejects(
      createAuthService({
        authAccountHasCredential: false,
        credentialsAuthService: credentials,
        payload,
      }).verifyAccessToken("changed-env-identity-token"),
      UnauthorizedException,
    );
  });

  it("revokes an env-backed token after development plain password rotation", async () => {
    process.env.AUTH_JWT_SECRET = "test-jwt-secret";
    process.env.AUTH_PASSWORD_EMAIL = "admin@example.com";
    process.env.AUTH_PASSWORD = "old-dev-password";
    delete process.env.AUTH_PASSWORD_HASH;
    process.env.NODE_ENV = "development";
    const credentials = createEnvCredentialsService();
    const payload = await issueEnvToken(credentials, "old-dev-password");

    process.env.AUTH_PASSWORD = "new-dev-password";

    await assert.rejects(
      createAuthService({
        authAccountHasCredential: false,
        credentialsAuthService: credentials,
        payload,
      }).verifyAccessToken("rotated-dev-token"),
      UnauthorizedException,
    );
  });

  it("rejects claim-less legacy JWTs for credentials accounts without a credential", async () => {
    process.env.AUTH_JWT_SECRET = "test-jwt-secret";
    process.env.AUTH_PASSWORD_EMAIL = "buyer@example.com";
    process.env.AUTH_PASSWORD = "dev-password";
    delete process.env.AUTH_PASSWORD_HASH;
    process.env.NODE_ENV = "development";

    await assert.rejects(
      createAuthService({
        authAccountHasCredential: false,
        credentialsAuthService: createEnvCredentialsService(),
        payload: { ...toPayload(payloadUser), authVersion: 0 },
      }).verifyAccessToken("claim-less-env-token"),
      UnauthorizedException,
    );
  });

  it("keeps stored credentials and Yandex tokens on authVersion checks only", async () => {
    delete process.env.AUTH_PASSWORD_EMAIL;
    delete process.env.AUTH_PASSWORD_HASH;
    delete process.env.AUTH_PASSWORD;
    const storedCredentials = createAuthService({
      authAccountHasCredential: true,
      payload: { ...toPayload(payloadUser), authVersion: 2 },
      storedAuthVersion: 2,
    });
    const yandexUser = {
      ...payloadUser,
      provider: "yandex" as const,
      providerUserId: "yandex-user",
    };
    const yandex = createAuthService({
      payload: { ...toPayload(yandexUser), authVersion: 2 },
      storedAuthVersion: 2,
    });

    assert.equal((await storedCredentials.verifyAccessToken("db-token")).id, "user-1");
    assert.equal((await yandex.verifyAccessToken("oauth-token")).id, "user-1");
  });

  it("maps exact public AuthUser fields from principals with internal claims", async () => {
    const controller = Object.assign(Object.create(AuthController.prototype), {
      authService: { createAccessToken: async () => "access-token" },
    }) as AuthController;
    const principal = {
      ...payloadUser,
      authVersion: 7,
      envCredentialBinding: "internal-binding",
      unexpectedInternalField: "must-not-leak",
    };
    const createCookieSession = (
      controller as unknown as {
        createCookieSession(response: unknown, user: typeof principal): Promise<unknown>;
      }
    ).createCookieSession;

    const session = await createCookieSession.call(
      controller,
      { cookie: () => undefined, clearCookie: () => undefined },
      principal,
    );

    assert.deepEqual(session, { user: payloadUser });
  });
});

function createAuthService(options: {
  authAccountHasCredential?: boolean;
  credentialsAuthService?: CredentialsAuthService;
  legacyAuthVersion?: number;
  onSign?: (payload: AuthTokenPayload) => void;
  onUserRead?: () => unknown;
  payload?: AuthTokenPayload;
  storedAuthVersion?: number;
  storedUserMissing?: boolean;
} = {}) {
  process.env.AUTH_JWT_SECRET = "test-jwt-secret";
  const jwtService = {
    signAsync: async (payload: AuthTokenPayload) => {
      options.onSign?.(payload);
      return "signed-token";
    },
    verifyAsync: async () => options.payload ?? toPayload(payloadUser),
  };
  const storedUser = {
    authVersion: options.storedAuthVersion ?? 0,
    email: "buyer@example.com",
    image: null,
    name: "Buyer",
    phone: null,
    roles: ["CUSTOMER"],
    status: UserStatus.ACTIVE,
  };
  const prisma = {
    authAccount: {
      findUnique: async () => ({
        credential: options.authAccountHasCredential === false ? null : { id: "credential-1" },
        providerEmail: "buyer@example.com",
        providerUserId: "buyer@example.com",
        userId: "user-1",
        user: {
          ...storedUser,
          authVersion: options.legacyAuthVersion ?? 0,
          id: "user-1",
        },
      }),
    },
    user: {
      findUnique: async () => {
        if (options.onUserRead) return options.onUserRead();
        return options.storedUserMissing ? null : storedUser;
      },
    },
  } as unknown as PrismaService;
  const usersService = {
    mapPrismaRoles: () => ["customer"],
  } as unknown as UsersService;

  return new AuthService(
    jwtService as never,
    options.credentialsAuthService ??
      ({ getEnvCredentialBinding: () => undefined } as never),
    prisma,
    usersService,
  );
}

function createEnvCredentialsService() {
  const account = {
    providerEmail: "admin@example.com",
    providerUserId: "admin@example.com",
    user: {
      authVersion: 0,
      email: "admin@example.com",
      id: "user-1",
      image: null,
      name: "Admin",
      phone: null,
      roles: ["ADMIN"],
      status: UserStatus.ACTIVE,
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        authAccount: {
          findUnique: async () => account,
          update: async () => account,
        },
      }),
    authAccount: { findFirst: async () => null },
  } as unknown as PrismaService;
  const usersService = {
    getDefaultRoles: () => ["customer"],
    mapPrismaRoles: () => ["admin"],
    normalizeRoles: () => ["admin"],
  } as unknown as UsersService;

  return new CredentialsAuthService(prisma, usersService);
}

function createLegacyEnvVerificationFixture(options: {
  authVersion?: number;
  envCredentialBinding?: string;
  omitBinding?: boolean;
  status?: UserStatus;
  storedAuthVersion?: number;
} = {}) {
  process.env.AUTH_JWT_SECRET = "test-jwt-secret";
  process.env.AUTH_PASSWORD_EMAIL = "buyer@example.com";
  process.env.AUTH_PASSWORD = "dev-password";
  delete process.env.AUTH_PASSWORD_HASH;
  process.env.NODE_ENV = "development";

  const writes = { creates: 0, transactions: 0, updates: 0 };
  const storedAccount = {
    credential: null,
    id: "account-1",
    providerEmail: "buyer@example.com",
    providerUserId: "buyer@example.com",
    userId: "user-1",
    user: {
      authVersion: options.storedAuthVersion ?? 0,
      email: "buyer@example.com",
      id: "user-1",
      image: null,
      name: "Buyer",
      phone: null,
      roles: ["CUSTOMER"],
      status: options.status ?? UserStatus.ACTIVE,
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => unknown) => {
      writes.transactions += 1;
      return callback({
        authAccount: {
          create: async () => {
            writes.creates += 1;
            return storedAccount;
          },
          findUnique: async () => storedAccount,
          update: async () => {
            writes.updates += 1;
            return {
              ...storedAccount,
              user: { ...storedAccount.user, status: UserStatus.ACTIVE },
            };
          },
        },
        user: {
          findUnique: async () => ({ id: "user-1" }),
          update: async () => {
            writes.updates += 1;
            return storedAccount.user;
          },
        },
      });
    },
    authAccount: {
      findFirst: async () => null,
      findUnique: async () => storedAccount,
    },
    user: { findUnique: async () => null },
  } as unknown as PrismaService;
  const usersService = {
    getDefaultRoles: () => ["customer"],
    mapPrismaRoles: () => ["customer"],
    normalizeRoles: () => ["admin"],
  } as unknown as UsersService;
  const credentials = new CredentialsAuthService(prisma, usersService);
  const currentBinding = credentials.getEnvCredentialBinding(
    "buyer@example.com",
  );
  assert.ok(currentBinding);
  const payload: AuthTokenPayload = {
    ...toPayload(payloadUser),
    sub: "credentials:buyer@example.com",
    authVersion: options.authVersion ?? 0,
    ...(!options.omitBinding && {
      envCredentialBinding:
        options.envCredentialBinding ?? currentBinding,
    }),
  };
  const jwtService = {
    signAsync: async () => "signed-token",
    verifyAsync: async () => payload,
  };

  return {
    service: new AuthService(jwtService as never, credentials, prisma, usersService),
    writes,
  };
}

async function issueEnvToken(
  credentials: CredentialsAuthService,
  password: string,
) {
  const principal = await credentials.validateUser(
    process.env.AUTH_PASSWORD_EMAIL ?? "",
    password,
  );
  let payload: AuthTokenPayload | undefined;
  await createAuthService({
    onSign: (signedPayload) => {
      payload = signedPayload;
    },
  }).createAccessToken(principal);
  assert.ok(payload);
  return payload;
}

function getEnvCredentialBinding(value: unknown) {
  if (typeof value !== "object" || value === null) return undefined;
  return (value as { envCredentialBinding?: unknown }).envCredentialBinding;
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function toPayload(user: AuthUser): AuthTokenPayload {
  return {
    sub: user.id,
    provider: user.provider,
    providerUserId: user.providerUserId,
    email: user.email,
    name: user.name,
    phone: user.phone,
    image: user.image,
    roles: user.roles,
  };
}
