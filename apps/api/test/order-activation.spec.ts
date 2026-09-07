import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import {
  BadRequestException,
  HttpException,
  Logger,
  RequestMethod,
} from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { AUTH_ACCESS_TOKEN_COOKIE_NAME } from "../src/auth/auth.constants";
import { AuthController } from "../src/auth/auth.controller";
import type { AuthService } from "../src/auth/auth.service";
import { OrderActivationService } from "../src/auth/order-activation.service";
import {
  createOrderActivationToken,
  createOrderActivationTokenHash,
  verifyOrderActivationToken,
} from "../src/auth/order-activation-token";
import type { CredentialsAuthService } from "../src/auth/credentials-auth.service";
import {
  AuthProvider as PrismaAuthProvider,
  NotificationJobChannel,
  Prisma,
  UserStatus,
} from "../src/generated/prisma/client";
import type { MailerService } from "../src/mailer/mailer.service";
import { MailerService as RuntimeMailerService } from "../src/mailer/mailer.service";
import { NotificationQueueService } from "../src/notifications/notification-queue.service";
import type { PasswordResetService } from "../src/auth/password-reset.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { UsersService } from "../src/users/users.service";

describe("paid guest order attachment", () => {
  it("attaches an existing active user by normalized email without overwriting profile", async () => {
    const fixture = createFixture({
      user: {
        id: "existing-user",
        email: "buyer@example.com",
        emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
        name: "Existing Name",
        phone: "+70000000000",
        roles: ["CUSTOMER"],
        status: UserStatus.ACTIVE,
      },
      credential: { id: "credential-1" },
    });
    const order = createGuestOrder({ customerEmail: " Buyer@Example.COM " });

    const userId = await fixture.service.attachPaidGuestOrderInTransaction(
      fixture.tx,
      order,
    );

    assert.equal(userId, "existing-user");
    assert.equal(fixture.orderUserId(), "existing-user");
    assert.equal(fixture.userCreateCount(), 0);
    assert.equal(fixture.userUpdateCount(), 0);
    assert.equal(fixture.activationTokens.length, 0);
    assert.equal(fixture.emails.length, 1);
    assert.match(fixture.emails[0]!.subject, /заказ/i);
    assert.doesNotMatch(fixture.emails[0]!.text, /token=/i);
  });

  it("reuses the active activation for a repeat paid order on an active passwordless credentials account", async () => {
    const oldToken = createTestActivationToken("old-active-token");
    const fixture = createFixture({ activationToken: oldToken });

    const userId = await fixture.service.attachPaidGuestOrderInTransaction(
      fixture.tx,
      createGuestOrder({ id: "repeat-order" }),
    );

    assert.equal(userId, "new-user");
    assert.equal(fixture.orderUserId(), "new-user");
    assert.equal(fixture.activationTokens.length, 1);
    assert.equal(fixture.activeActivationTokens(), 1);
    assert.equal(fixture.activationTokens[0]?.consumedAt, null);
    assert.equal(
      fixture.notificationPayloads.filter((payload) => payload.kind === "order_activation").length,
      1,
    );
    assert.equal(fixture.emails.length, 0, "ordinary login email must not be queued");
  });

  it("keeps the ordinary login and recovery email for active credentials and OAuth users", async () => {
    for (const account of [
      { provider: PrismaAuthProvider.CREDENTIALS, credential: { id: "credential-1" } },
      { provider: PrismaAuthProvider.YANDEX, credential: undefined },
    ]) {
      const fixture = createFixture({
        accountProvider: account.provider,
        credential: account.credential,
      });

      await fixture.service.attachPaidGuestOrderInTransaction(fixture.tx, createGuestOrder());

      assert.equal(fixture.emails.length, 1);
      assert.match(fixture.emails[0]!.text, /войдите|войти/i);
      assert.match(fixture.emails[0]!.text, /восстанов/i);
      assert.equal(fixture.activationTokens.length, 0);
    }
  });

  it("does not automatically reactivate blocked or deleted users after payment", async () => {
    for (const status of [UserStatus.BLOCKED, UserStatus.DELETED]) {
      const fixture = createFixture({
        user: {
          id: `inactive-${status.toLowerCase()}`,
          email: "buyer@example.com",
          emailVerifiedAt: null,
          name: "Buyer",
          phone: null,
          roles: ["CUSTOMER"],
          status,
        },
      });

      const userId = await fixture.service.attachPaidGuestOrderInTransaction(
        fixture.tx,
        createGuestOrder(),
      );

      assert.equal(userId, undefined);
      assert.equal(fixture.orderUserId(), undefined);
      assert.equal(fixture.userUpdateCount(), 0);
      assert.equal(fixture.activationTokens.length, 0);
      assert.equal(fixture.emails.length, 0);
    }
  });

  it("rechecks user status after locking before attaching a paid order", async () => {
    for (const status of [UserStatus.BLOCKED, UserStatus.DELETED]) {
      const fixture = createFixture({ userStatusAfterLock: status });

      const userId = await fixture.service.attachPaidGuestOrderInTransaction(
        fixture.tx,
        createGuestOrder(),
      );

      assert.equal(userId, undefined);
      assert.equal(fixture.orderUserId(), undefined);
      assert.equal(fixture.activationTokens.length, 0);
      assert.equal(fixture.emails.length, 0);
    }
  });

  it("links existing users to the canonical login and recovery pages", () => {
    const previousSiteUrl = process.env.SITE_URL;
    process.env.SITE_URL = "https://artmate.example";

    try {
      const email = new RuntimeMailerService().createPaidOrderLoginEmail(
        "buyer@example.com",
      );
      const content = `${email.text}\n${email.html}`;

      assert.match(email.text, /Войти: https:\/\/artmate\.example\/auth\n/);
      assert.match(content, /https:\/\/artmate\.example\/auth\/recovery/);
      assert.doesNotMatch(content, /\/auth\/login/);
    } finally {
      if (previousSiteUrl === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = previousSiteUrl;
    }
  });

  it("creates one passwordless credentials account for concurrent paid orders", async () => {
    const fixture = createFixture({ userStatus: "missing" });
    const first = createGuestOrder({ id: "order-1" });
    const second = createGuestOrder({ id: "order-2" });

    const [firstUserId, secondUserId] = await Promise.all([
      fixture.transaction((tx) =>
        fixture.service.attachPaidGuestOrderInTransaction(tx, first),
      ),
      fixture.transaction((tx) =>
        fixture.service.attachPaidGuestOrderInTransaction(tx, second),
      ),
    ]);

    const activationPayloads = fixture.notificationPayloads.filter(
      (payload) => payload.kind === "order_activation",
    );
    assert.equal(firstUserId, secondUserId);
    assert.equal(fixture.userCreateCount(), 1);
    assert.equal(fixture.accountCreateCount(), 1);
    assert.equal(fixture.credentialCreateCount(), 0);
    assert.equal(fixture.activationTokens.length, 1);
    assert.equal(fixture.activeActivationTokens(), 1);
    assert.equal(activationPayloads.length, 2);
    assert.ok(
      activationPayloads.every(
        (payload) =>
          payload.activationTokenId === fixture.activationTokens[0]?.id,
      ),
    );
  });

  it("provisions paid guest credentials for a valid email longer than 191 characters", async () => {
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    const fixture = createFixture({ userStatus: "missing" });

    assert.equal(email.length, 254);

    const userId = await fixture.service.attachPaidGuestOrderInTransaction(
      fixture.tx,
      createGuestOrder({ customerEmail: email }),
    );

    assert.equal(userId, "new-user");
    assert.deepEqual(fixture.accountProviderUserIds, [email]);
    assert.equal(fixture.orderUserId(), "new-user");
  });

  it("does not attach a user that becomes inactive after the missing-user upsert", async () => {
    for (const status of [UserStatus.BLOCKED, UserStatus.DELETED]) {
      const fixture = createFixture({
        postUpsertEligibility: status === UserStatus.BLOCKED ? "blocked" : "deleted",
        userStatus: "missing",
      });

      const userId = await fixture.service.attachPaidGuestOrderInTransaction(
        fixture.tx,
        createGuestOrder(),
      );

      assert.equal(userId, undefined);
      assert.equal(fixture.orderUserId(), undefined);
      assert.equal(fixture.activationTokens.length, 0);
      assert.equal(fixture.emails.length, 0);
    }
  });

  it("uses login email when credentials or OAuth appears after the missing-user upsert", async () => {
    for (const postUpsertEligibility of ["credential", "oauth"] as const) {
      const fixture = createFixture({
        postUpsertEligibility,
        userStatus: "missing",
      });

      const userId = await fixture.service.attachPaidGuestOrderInTransaction(
        fixture.tx,
        createGuestOrder(),
      );

      assert.equal(userId, "new-user");
      assert.equal(fixture.orderUserId(), "new-user");
      assert.equal(fixture.activationTokens.length, 0);
      assert.equal(fixture.emails.length, 1);
    }
  });
});

describe("order activation and recovery", () => {
  it("does not expose the legacy password reset request endpoint", () => {
    assert.equal("requestPasswordReset" in AuthController.prototype, false);

    const routes = Object.getOwnPropertyNames(AuthController.prototype).flatMap(
      (property) => {
        const handler = Object.getOwnPropertyDescriptor(
          AuthController.prototype,
          property,
        )?.value as unknown;

        return typeof handler === "function"
          ? [Reflect.getMetadata(PATH_METADATA, handler) as unknown]
          : [];
      },
    );

    assert.equal(routes.includes("password-reset/request"), false);
  });

  it("validates activation tokens before showing the form without disclosing PII", async () => {
    const validToken = createTestActivationToken("preflight-valid-token");
    const unknownToken = createTestActivationToken("preflight-unknown-token");
    const cases = [
      { expected: true, fixture: createFixture({ activationToken: validToken }), token: validToken },
      { expected: false, fixture: createFixture(), token: "malformed" },
      { expected: false, fixture: createFixture(), token: unknownToken },
      {
        expected: false,
        fixture: createFixture({ activationToken: createTestActivationToken("preflight-expired"), tokenState: "expired" }),
        token: createTestActivationToken("preflight-expired"),
      },
      {
        expected: false,
        fixture: createFixture({ activationToken: createTestActivationToken("preflight-consumed"), tokenState: "consumed" }),
        token: createTestActivationToken("preflight-consumed"),
      },
    ];

    for (const testCase of cases) {
      const validateActivation = (
        testCase.fixture.service as unknown as {
          validateActivation?: (_token: string) => Promise<unknown>;
        }
      ).validateActivation;
      assert.equal(typeof validateActivation, "function", "activation preflight service is missing");
      const validateActivationFunction = validateActivation as (
        _token: string,
      ) => Promise<unknown>;

      const result = await validateActivationFunction.call(
        testCase.fixture.service,
        testCase.token,
      );
      assert.deepEqual(result, { valid: testCase.expected });
      assert.deepEqual(Object.keys(result as object), ["valid"]);
      assert.doesNotMatch(JSON.stringify(result), /buyer@|new-user|order-/i);
    }
  });

  it("exposes activation preflight as a PII-free POST controller contract", async () => {
    const controller = Object.assign(Object.create(AuthController.prototype), {
      orderActivationService: {
        validateActivation: async () => ({ valid: false }),
      },
    }) as AuthController;
    const handler = (
      controller as unknown as {
        validateOrderActivation?: (_request: { token: string }) => Promise<unknown>;
      }
    ).validateOrderActivation;

    assert.equal(typeof handler, "function", "activation preflight controller endpoint is missing");
    const handlerFunction = handler as (_request: { token: string }) => Promise<unknown>;
    assert.equal(Reflect.getMetadata(PATH_METADATA, handlerFunction), "order-activation/validate");
    assert.equal(Reflect.getMetadata(METHOD_METADATA, handlerFunction), RequestMethod.POST);
    assert.deepEqual(await handlerFunction.call(controller, { token: "opaque-token" }), {
      valid: false,
    });
  });

  it("atomically sets the password, verifies email, consumes tokens and returns the user", async () => {
    const token = createTestActivationToken("valid-token");
    const fixture = createFixture({ activationToken: token });

    const user = await fixture.service.confirmActivation({
      password: "new-password",
      token,
    });

    assert.equal(user.id, "new-user");
    assert.equal(
      (user as unknown as { authVersion: number }).authVersion,
      1,
    );
    assert.equal(fixture.authVersion(), 1);
    assert.equal(fixture.passwordHash(), "hashed:new-password");
    assert.ok(fixture.emailVerifiedAt());
    assert.equal(fixture.activeActivationTokens(), 0);
    assert.equal(fixture.activeResetTokens(), 0);
  });

  it("locks the user before the activation token during confirmation", async () => {
    const token = createTestActivationToken("lock-order-token");
    const fixture = createFixture({ activationToken: token });

    await fixture.service.confirmActivation({
      password: "new-password",
      token,
    });

    assert.deepEqual(fixture.lockEvents(), ["user", "activation-token"]);
  });

  it("rejects expired and consumed activation links without granting access", async () => {
    for (const state of ["expired", "consumed"] as const) {
      const token = createTestActivationToken(`invalid-token-${state}`);
      const fixture = createFixture({ activationToken: token, tokenState: state });
      await assert.rejects(
        fixture.service.confirmActivation({
          password: "new-password",
          token,
        }),
        BadRequestException,
      );
      assert.equal(fixture.passwordHash(), undefined);
    }
  });

  it("never overwrites a password that was set after activation was issued", async () => {
    const token = createTestActivationToken("stale-valid-token");
    const fixture = createFixture({
      activationToken: token,
      credential: { id: "credential-1" },
    });

    await assert.rejects(
      fixture.service.confirmActivation({
        password: "attacker-password",
        token,
      }),
      BadRequestException,
    );
    assert.equal(fixture.passwordHash(), "existing-hash");
  });

  it("rejects confirmation when OAuth appears after a successful preflight", async () => {
    const token = createTestActivationToken("oauth-after-preflight-token");
    const fixture = createFixture({ activationToken: token, oauthAfterUserLock: true });

    assert.deepEqual(await fixture.service.validateActivation(token), { valid: true });
    await assert.rejects(
      fixture.service.confirmActivation({
        password: "new-password",
        token,
      }),
      (error) =>
        error instanceof BadRequestException &&
        error.message === "Order activation link is invalid or expired",
    );
    assert.equal(fixture.credentialCreateCount(), 0);
    assert.equal(fixture.sessionUserLookupCount(), 0);
  });

  it("uses activation for passwordless users and reset for password users with one generic response", async () => {
    const passwordless = createFixture({
      activationToken: createTestActivationToken("old-token"),
      tokenState: "expired",
    });
    const passwordUser = createFixture({ credential: { id: "credential-1" } });
    const unknown = createFixture({ userStatus: "missing" });

    assert.deepEqual(
      await passwordless.service.requestRecovery({
        email: "buyer@example.com",
        ipAddress: "203.0.113.1",
      }),
      { ok: true },
    );
    assert.equal(passwordless.activationTokens.length, 2);
    assert.equal(passwordless.activeActivationTokens(), 1);

    assert.deepEqual(
      await passwordUser.service.requestRecovery({
        email: "buyer@example.com",
        ipAddress: "203.0.113.1",
      }),
      { ok: true },
    );
    assert.equal(passwordUser.resetRequests.length, 1);

    assert.deepEqual(
      await unknown.service.requestRecovery({
        email: "unknown@example.com",
        ipAddress: "203.0.113.1",
      }),
      { ok: true },
    );
    assert.equal(unknown.emails.length, 0);
  });

  it("rechecks credentials under lock before choosing activation or password reset", async () => {
    const fixture = createFixture({ credentialAfterAccountLock: true });

    assert.deepEqual(
      await fixture.service.requestRecovery({ email: "buyer@example.com" }),
      { ok: true },
    );

    assert.equal(fixture.activationTokens.length, 0);
    assert.equal(fixture.resetRequests.length, 1);
    assert.equal(fixture.passwordResetInsideTransaction(), false);
  });

  it("enforces activation resend cooldown and hashed IP hourly limits", async () => {
    const cooldown = createFixture();
    assert.deepEqual(
      await cooldown.service.requestRecovery({
        email: "buyer@example.com",
        ipAddress: "203.0.113.1",
      }),
      { ok: true },
    );
    await assert.rejects(
      cooldown.service.requestRecovery({
        email: "buyer@example.com",
        ipAddress: "203.0.113.1",
      }),
      (error) => error instanceof HttpException && error.getStatus() === 429,
    );

    const limited = createFixture({ userStatus: "missing" });
    for (let index = 0; index < 20; index += 1) {
      assert.deepEqual(
        await limited.service.requestRecovery({
          email: `buyer-${index}@example.com`,
          ipAddress: "203.0.113.1",
        }),
        { ok: true },
      );
    }
    await assert.rejects(
      limited.service.requestRecovery({
        email: "buyer-blocked@example.com",
        ipAddress: "203.0.113.1",
      }),
      (error) => error instanceof HttpException && error.getStatus() === 429,
    );
    assert.equal(limited.lastRecoveryIpHash()?.length, 64);
    assert.notEqual(limited.lastRecoveryIpHash(), "203.0.113.1");
  });

  it("does not disclose whether generic recovery selected password reset", async () => {
    const fixture = createFixture({
      credential: { id: "credential-1" },
      resetError: new HttpException(
        { message: "Password reset email hourly limit exceeded", retryAfterSeconds: 42 },
        429,
      ),
    });

    assert.deepEqual(
      await fixture.service.requestRecovery({ email: "buyer@example.com" }),
      { ok: true },
    );
    assert.equal(fixture.resetRequests.length, 1);
  });

  it("masks credential recovery delivery failures like an unknown account", async () => {
    for (const resetError of [
      new Error("SMTP unavailable"),
      new HttpException("Password reset unavailable", 503),
    ]) {
      const known = createFixture({
        credential: { id: "credential-1" },
        resetError,
      });
      const unknown = createFixture({ userStatus: "missing" });

      const knownResponse = await known.service.requestRecovery({
        email: "buyer@example.com",
      });
      const unknownResponse = await unknown.service.requestRecovery({
        email: "unknown@example.com",
      });

      assert.deepEqual(knownResponse, { ok: true });
      assert.deepEqual(knownResponse, unknownResponse);
    }
  });

  for (const failure of ["issuance", "queue"] as const) {
    it(`masks passwordless activation ${failure} failures and logs them without email PII`, async (t) => {
      const logs: unknown[][] = [];
      t.mock.method(Logger.prototype, "warn", (...args: unknown[]) => logs.push(args));
      t.mock.method(Logger.prototype, "error", (...args: unknown[]) => logs.push(args));
      const activationError = new Error(`activation ${failure} unavailable`);
      const known = createFixture({
        activationCreateError: failure === "issuance" ? activationError : undefined,
        activationEnqueueError: failure === "queue" ? activationError : undefined,
      });
      const unknown = createFixture({ userStatus: "missing" });
      const input = { email: "buyer@example.com", ipAddress: "203.0.113.1" };

      const knownResponse = await known.service.requestRecovery(input);
      const unknownResponse = await unknown.service.requestRecovery({
        ...input,
        email: "unknown@example.com",
      });

      assert.deepEqual(knownResponse, { ok: true });
      assert.deepEqual(knownResponse, unknownResponse);
      assert.equal(await getRecoveryStatus(known.service, input), 429);

      assert.equal(logs.length, 1);
      assert.doesNotMatch(JSON.stringify(logs), /buyer@example\.com|203\.0\.113\.1/i);
    });
  }

  it("applies the same outward recovery response and throttle status to known and unknown emails", async () => {
    const known = createFixture();
    const unknown = createFixture({ userStatus: "missing" });
    const input = { email: "buyer@example.com", ipAddress: "203.0.113.1" };

    assert.deepEqual(await known.service.requestRecovery(input), { ok: true });
    assert.deepEqual(await unknown.service.requestRecovery(input), { ok: true });

    const knownStatus = await getRecoveryStatus(known.service, input);
    const unknownStatus = await getRecoveryStatus(unknown.service, input);
    assert.equal(knownStatus, 429);
    assert.equal(unknownStatus, 429);
  });

  it("serializes concurrent recovery limits so only one request can send", async () => {
    const fixture = createFixture({ userStatus: "missing" });
    const input = { email: "buyer@example.com", ipAddress: "203.0.113.1" };

    const statuses = await Promise.all([
      getRecoveryStatus(fixture.service, input),
      getRecoveryStatus(fixture.service, input),
    ]);

    assert.deepEqual(statuses.sort(), [200, 429]);
    assert.equal(fixture.recoveryBucketCount(), 2);
  });

  it("reuses one active activation token across repeat recovery requests", async () => {
    const fixture = createFixture();

    await fixture.service.requestRecovery({ email: "buyer@example.com" });
    fixture.allowNextRecovery();
    await fixture.service.requestRecovery({ email: "buyer@example.com" });

    const activationPayloads = fixture.notificationPayloads.filter(
      (payload) => payload.kind === "order_activation",
    );
    assert.equal(fixture.activationTokens.length, 1);
    assert.equal(fixture.activeActivationTokens(), 1);
    assert.equal(activationPayloads.length, 2);
    assert.deepEqual(
      activationPayloads.map((payload) => payload.activationTokenId),
      [fixture.activationTokens[0]?.id, fixture.activationTokens[0]?.id],
    );
  });

  it("reuses one active activation token across repeat paid purchases", async () => {
    const fixture = createFixture();

    await fixture.service.attachPaidGuestOrderInTransaction(
      fixture.tx,
      createGuestOrder({ id: "repeat-order-1" }),
    );
    await fixture.service.attachPaidGuestOrderInTransaction(
      fixture.tx,
      createGuestOrder({ id: "repeat-order-2" }),
    );

    const activationPayloads = fixture.notificationPayloads.filter(
      (payload) => payload.kind === "order_activation",
    );
    assert.equal(fixture.activationTokens.length, 1);
    assert.equal(fixture.activeActivationTokens(), 1);
    assert.deepEqual(
      activationPayloads.map((payload) => payload.activationTokenId),
      [fixture.activationTokens[0]?.id, fixture.activationTokens[0]?.id],
    );
  });

  for (const source of ["recovery", "repeat paid purchase"] as const) {
    it(`replaces an active activation with a hash from another JWT secret during ${source}`, async () => {
      const currentToken = createTestActivationToken(`rotated-secret-${source}`);
      const tokenId = verifyOrderActivationToken(currentToken, "test-jwt-secret");
      assert.ok(tokenId);
      const previousToken = createOrderActivationToken(
        tokenId,
        "previous-test-jwt-secret",
      );
      const fixture = createFixture({
        activationToken: currentToken,
        activationTokenHash: createOrderActivationTokenHash(
          previousToken,
          "previous-test-jwt-secret",
        ),
      });
      const existingTokenId = fixture.activationTokens[0]?.id;

      if (source === "recovery") {
        await fixture.service.requestRecovery({ email: "buyer@example.com" });
      } else {
        await fixture.service.attachPaidGuestOrderInTransaction(
          fixture.tx,
          createGuestOrder({ id: "rotated-secret-repeat-order" }),
        );
      }

      const activationPayloads = fixture.notificationPayloads.filter(
        (payload) => payload.kind === "order_activation",
      );
      const newToken = fixture.activationTokens.at(-1);
      assert.equal(fixture.activationTokens.length, 2);
      assert.equal(fixture.activeActivationTokens(), 1);
      assert.ok(newToken);
      assert.notEqual(newToken.id, existingTokenId);
      assert.deepEqual(
        activationPayloads.map((payload) => payload.activationTokenId),
        [newToken.id],
      );
    });
  }

  it("does not enqueue a stale activation link during concurrent recovery and paid purchase", async () => {
    let releaseFirstEnqueue: (() => void) | undefined;
    let markFirstEnqueued: (() => void) | undefined;
    const firstEnqueued = new Promise<void>((resolve) => {
      markFirstEnqueued = resolve;
    });
    const holdFirstEnqueue = new Promise<void>((resolve) => {
      releaseFirstEnqueue = resolve;
    });
    const fixture = createFixture({
      afterActivationEnqueue: async (enqueueCount) => {
        if (enqueueCount === 1) {
          markFirstEnqueued?.();
          await holdFirstEnqueue;
        } else {
          releaseFirstEnqueue?.();
        }
      },
    });

    const paidPurchase = fixture.service.attachPaidGuestOrderInTransaction(
      fixture.tx,
      createGuestOrder({ id: "concurrent-paid-order" }),
    );
    await firstEnqueued;
    const recovery = fixture.service.requestRecovery({ email: "buyer@example.com" });
    await Promise.all([paidPurchase, recovery]);

    const activationPayloads = fixture.notificationPayloads.filter(
      (payload) => payload.kind === "order_activation",
    );
    const activeToken = fixture.activationTokens.find(
      (token) => !token.consumedAt && token.expiresAt > new Date(),
    );
    assert.ok(activeToken);
    assert.equal(fixture.activationTokens.length, 1);
    assert.equal(fixture.activeActivationTokens(), 1);
    assert.equal(activationPayloads.length, 2);
    assert.ok(
      activationPayloads.every(
        (payload) => payload.activationTokenId === activeToken.id,
      ),
      "every enqueued activation must reference the reusable active token",
    );
  });

  it("returns the standard session and access-token cookie after activation", async () => {
    const user = {
      id: "new-user",
      provider: "credentials" as const,
      providerUserId: "buyer@example.com",
      email: "buyer@example.com",
      roles: ["customer" as const],
      authVersion: 3,
    };
    const signedVersions: number[] = [];
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const controller = Object.assign(Object.create(AuthController.prototype), {
      authService: {
        createAccessToken: async (principal: { authVersion: number }) => {
          signedVersions.push(principal.authVersion);
          return "standard-jwt";
        },
      } as unknown as AuthService,
      orderActivationService: {
        confirmActivation: async () => user,
      },
    }) as AuthController;

    const session = await controller.confirmOrderActivation(
      { password: "new-password", token: "x".repeat(32) },
      {
        cookie: (name, value, options) => cookies.push({ name, value, options }),
        clearCookie: () => undefined,
      },
    );

    const publicUser = { ...user };
    delete (publicUser as Partial<typeof user>).authVersion;
    assert.deepEqual(session, { user: publicUser });
    assert.deepEqual(signedVersions, [3]);
    assert.equal(cookies[0]?.name, AUTH_ACCESS_TOKEN_COOKIE_NAME);
    assert.equal(cookies[0]?.value, "standard-jwt");
    assert.equal(cookies[0]?.options.httpOnly, true);
    assert.equal(cookies[0]?.options.path, "/");
  });

  it("persists only a nonsecret activation reference and reconstructs a confirmable link in the worker", async () => {
    const fixture = createFixture();
    await fixture.service.requestRecovery({ email: "buyer@example.com" });
    const payload = fixture.notificationPayloads[0];
    const serialized = JSON.stringify(payload);

    assert.ok(payload);
    assert.deepEqual(Object.keys(payload).sort(), [
      "activationTokenId",
      "email",
      "kind",
    ]);
    assert.equal(payload?.kind, "order_activation");
    assert.doesNotMatch(serialized, /token=|https?:\/\/|activate-order/i);

    let sentText = "";
    const mailer = Object.assign(new RuntimeMailerService(), {
      sendMail: async (mail: { text: string }) => {
        sentText = mail.text;
      },
    });
    const workerTx = {
      $queryRaw: async () => [],
      authOrderActivationToken: {
         findUnique: async () => ({
           consumedAt: null,
           expiresAt: new Date(Date.now() + 60_000),
           tokenHash: fixture.activationTokens[0]?.tokenHash,
           userId: "new-user",
         }),
      },
      authAccount: {
        findFirst: async ({ where }: { where: { provider: unknown } }) =>
          typeof where.provider === "object" ? null : { credential: null },
      },
      user: {
        findUnique: async () => ({ status: UserStatus.ACTIVE }),
      },
    };
    const worker = new NotificationQueueService(
      mailer,
      {
        ...workerTx,
        $transaction: async <T>(
          callback: (transaction: typeof workerTx) => Promise<T>,
        ) => callback(workerTx),
      } as unknown as PrismaService,
    ) as unknown as {
      dispatchJob(job: unknown): Promise<void>;
    };
    await worker.dispatchJob({
      channel: NotificationJobChannel.EMAIL,
      payload,
    });
    const activationUrl = sentText
      .split("\n")
      .find((line) => line.includes("/auth/activate-order?"))
      ?.split(": ")
      .at(-1);
    assert.ok(activationUrl);
    const token = new URL(activationUrl).searchParams.get("token");
    assert.ok(token);

    const user = await fixture.service.confirmActivation({
      password: "new-password",
      token,
    });
    assert.equal(user.id, "new-user");
  });

  it("does not send consumed or expired activation notification jobs", async () => {
    for (const tokenState of ["consumed", "expired"] as const) {
      const activationTokenId = "a".repeat(24);
      const activationToken = createOrderActivationToken(
        activationTokenId,
        "test-jwt-secret",
      );
      let sends = 0;
      const worker = new NotificationQueueService(
        {
          createOrderActivationEmail: () => ({
            subject: "activation",
            text: "activation",
            to: "buyer@example.com",
          }),
          sendMail: async () => {
            sends += 1;
          },
        } as unknown as MailerService,
        {
          authOrderActivationToken: {
            findUnique: async () => ({
              consumedAt: tokenState === "consumed" ? new Date() : null,
              expiresAt:
                tokenState === "expired"
                  ? new Date(Date.now() - 1_000)
                  : new Date(Date.now() + 60_000),
              tokenHash: createOrderActivationTokenHash(
                activationToken,
                "test-jwt-secret",
              ),
              userId: "new-user",
            }),
          },
        } as unknown as PrismaService,
      ) as unknown as {
        dispatchJob(job: unknown): Promise<void>;
      };

      await worker.dispatchJob({
        channel: NotificationJobChannel.EMAIL,
        payload: {
          activationTokenId,
          email: "buyer@example.com",
          kind: "order_activation",
        },
      });

      assert.equal(sends, 0, `${tokenState} activation must not be sent`);
    }
  });

  it("does not send an activation job when the locked token hash does not match the current JWT secret", async () => {
    const previousSecret = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET = "test-jwt-secret";
    const activationTokenId = "a".repeat(24);
    const previousToken = createOrderActivationToken(
      activationTokenId,
      "previous-test-jwt-secret",
    );
    const activationToken = {
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      id: activationTokenId,
      tokenHash: createOrderActivationTokenHash(
        previousToken,
        "previous-test-jwt-secret",
      ),
      userId: "new-user",
    };
    let sends = 0;
    const tx = {
      $queryRaw: async () => [],
      authOrderActivationToken: {
        findUnique: async () => activationToken,
      },
      authAccount: {
        findFirst: async ({ where }: { where: { provider: unknown } }) =>
          typeof where.provider === "object" ? null : { credential: null },
      },
      user: {
        findUnique: async () => ({ status: UserStatus.ACTIVE }),
      },
    };
    const worker = new NotificationQueueService(
      {
        createOrderActivationEmail: () => ({
          subject: "activation",
          text: "activation",
          to: "buyer@example.com",
        }),
        sendMail: async () => {
          sends += 1;
        },
      } as unknown as MailerService,
      {
        ...tx,
        $transaction: async <T>(
          callback: (transaction: typeof tx) => Promise<T>,
        ) => callback(tx),
      } as unknown as PrismaService,
    ) as unknown as { dispatchJob(job: unknown): Promise<void> };

    try {
      await worker.dispatchJob({
        channel: NotificationJobChannel.EMAIL,
        payload: {
          activationTokenId,
          email: "buyer@example.com",
          kind: "order_activation",
        },
      });
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET;
      else process.env.AUTH_JWT_SECRET = previousSecret;
    }

    assert.equal(sends, 0);
  });

  it("does not send activation jobs after user or account loses eligibility", async () => {
    const activationTokenId = "a".repeat(24);
    const activationToken = createOrderActivationToken(
      activationTokenId,
      "test-jwt-secret",
    );
    const cases = [
      { credential: false, oauth: false, status: UserStatus.BLOCKED },
      { credential: false, oauth: false, status: UserStatus.DELETED },
      { credential: true, oauth: false, status: UserStatus.ACTIVE },
      { credential: false, oauth: true, status: UserStatus.ACTIVE },
    ];

    for (const testCase of cases) {
      let sends = 0;
      const workerTx = {
        $queryRaw: async () => [],
        authOrderActivationToken: {
          findUnique: async () => ({
            consumedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            tokenHash: createOrderActivationTokenHash(
              activationToken,
              "test-jwt-secret",
            ),
            userId: "new-user",
          }),
        },
        authAccount: {
          findFirst: async ({ where }: { where: { provider: unknown } }) =>
            typeof where.provider === "object"
              ? testCase.oauth
                ? { id: "oauth-account" }
                : null
              : { credential: testCase.credential ? { id: "credential" } : null },
        },
        user: {
          findUnique: async () => ({ status: testCase.status }),
        },
      };
      const worker = new NotificationQueueService(
        {
          createOrderActivationEmail: () => ({
            subject: "activation",
            text: "activation",
            to: "buyer@example.com",
          }),
          sendMail: async () => {
            sends += 1;
          },
        } as unknown as MailerService,
        {
          ...workerTx,
          $transaction: async <T>(
            callback: (transaction: typeof workerTx) => Promise<T>,
          ) => callback(workerTx),
        } as unknown as PrismaService,
      ) as unknown as {
        dispatchJob(job: unknown): Promise<void>;
      };

      await worker.dispatchJob({
        channel: NotificationJobChannel.EMAIL,
        payload: {
          activationTokenId,
          email: "buyer@example.com",
          kind: "order_activation",
        },
      });

      assert.equal(sends, 0);
    }
  });

  it("propagates activation reference lookup failures for worker retry", async () => {
    const lookupError = new Error("activation lookup unavailable");
    let sends = 0;
    const worker = new NotificationQueueService(
      {
        createOrderActivationEmail: () => ({
          subject: "activation",
          text: "activation",
          to: "buyer@example.com",
        }),
        sendMail: async () => {
          sends += 1;
        },
      } as unknown as MailerService,
      {
        authOrderActivationToken: {
          findUnique: async () => {
            throw lookupError;
          },
        },
      } as unknown as PrismaService,
    ) as unknown as {
      dispatchJob(job: unknown): Promise<void>;
    };

    await assert.rejects(
      worker.dispatchJob({
        channel: NotificationJobChannel.EMAIL,
        payload: {
          activationTokenId: "a".repeat(24),
          email: "buyer@example.com",
          kind: "order_activation",
        },
      }),
      (error) => error === lookupError,
    );
    assert.equal(sends, 0);
  });

  it("rechecks activation eligibility in a short locked transaction before SMTP", async () => {
    const activationTokenId = "a".repeat(24);
    const token = createOrderActivationToken(
      activationTokenId,
      "test-jwt-secret",
    );
    const lockEvents: string[] = [];
    let transactionCalls = 0;
    let transactionDepth = 0;
    let smtpInsideTransaction: boolean | undefined;
    const activationToken = {
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: createOrderActivationTokenHash(token, "test-jwt-secret"),
      userId: "new-user",
    };
    const tx = {
      $queryRaw: async (query: unknown) => {
        const sql = Array.isArray(query) ? String(query[0]) : String(query);
        if (/FROM\s+"?users"?/i.test(sql)) lockEvents.push("user");
        if (/FROM\s+"?auth_order_activation_tokens"?/i.test(sql)) {
          lockEvents.push("activation-token");
        }
        return [];
      },
      authOrderActivationToken: {
        findUnique: async () => activationToken,
      },
      authAccount: {
        findFirst: async ({ where }: { where: { provider: unknown } }) =>
          typeof where.provider === "object" ? null : { credential: null },
      },
      user: {
        findUnique: async () => ({ status: UserStatus.ACTIVE }),
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
        transactionCalls += 1;
        transactionDepth += 1;
        try {
          return await callback(tx);
        } finally {
          transactionDepth -= 1;
        }
      },
      authOrderActivationToken: tx.authOrderActivationToken,
      authAccount: tx.authAccount,
      user: tx.user,
    } as unknown as PrismaService;
    const worker = new NotificationQueueService(
      {
        createOrderActivationEmail: () => ({
          subject: "activation",
          text: "activation",
          to: "buyer@example.com",
        }),
        sendMail: async () => {
          smtpInsideTransaction = transactionDepth > 0;
        },
      } as unknown as MailerService,
      prisma,
    ) as unknown as { dispatchJob(job: unknown): Promise<void> };

    await worker.dispatchJob({
      channel: NotificationJobChannel.EMAIL,
      payload: {
        activationTokenId,
        email: "buyer@example.com",
        kind: "order_activation",
      },
    });

    assert.equal(transactionCalls, 1, "eligibility recheck must use one short transaction");
    assert.deepEqual(lockEvents, ["user", "activation-token"]);
    assert.equal(smtpInsideTransaction, false, "SMTP must run after the transaction commits");
  });

  it("uses the exact activation email subject, payment copy and CTA", () => {
    const email = new RuntimeMailerService().createOrderActivationEmail(
      "buyer@example.com",
      "https://artmate.example/auth/activate-order?token=opaque",
    );
    const content = `${email.text}\n${email.html}`;

    assert.equal(email.subject, "Завершите регистрацию в Artmate");
    assert.match(
      content,
      /Оплата подтверждена\. Завершите регистрацию, чтобы войти и посмотреть заказ/u,
    );
    assert.match(content, />\s*Завершить регистрацию\s*</u);
  });

  it("uses the exact registration completion label in plaintext activation email", () => {
    const email = new RuntimeMailerService().createOrderActivationEmail(
      "buyer@example.com",
      "https://artmate.example/auth/activate-order?token=opaque",
    );

    assert.match(
      email.text,
      /^Ссылка для завершения регистрации: https:\/\/artmate\.example\/auth\/activate-order\?token=opaque$/mu,
    );
    assert.doesNotMatch(email.text, /^Ссылка для активации:/mu);
  });
});

type FixtureOptions = {
  accountProvider?: PrismaAuthProvider;
  activationCreateError?: Error;
  activationEnqueueError?: Error;
  activationToken?: string;
  activationTokenHash?: string;
  afterActivationEnqueue?: (enqueueCount: number) => Promise<void>;
  credential?: { id: string };
  credentialAfterAccountLock?: boolean;
  oauthAfterUserLock?: boolean;
  postUpsertEligibility?: "blocked" | "credential" | "deleted" | "oauth";
  resetError?: Error;
  tokenState?: "active" | "consumed" | "expired";
  user?: Record<string, unknown>;
  userStatus?: "active" | "missing";
  userStatusAfterLock?: UserStatus;
};

function createFixture(options: FixtureOptions = {}) {
  const emails: Array<{ subject: string; text: string }> = [];
  const resetRequests: unknown[] = [];
  const notificationPayloads: Array<Record<string, unknown>> = [];
  const accountProviderUserIds: string[] = [];
  const activationTokens: Array<{
    consumedAt: Date | null;
    expiresAt: Date;
    id: string;
    ipHash?: string;
    sentAt: Date;
    tokenHash: string;
    userId: string;
  }> = [];
  let storedUser =
    options.userStatus === "missing"
      ? undefined
      : options.user ?? {
          id: "new-user",
          email: "buyer@example.com",
          emailVerifiedAt: null,
          name: "Buyer",
          phone: null,
          roles: ["CUSTOMER"],
          status: UserStatus.ACTIVE,
          authVersion: 0,
        };
  let credential = options.credential;
  let passwordHash = options.credential ? "existing-hash" : undefined;
  let orderUserId: string | undefined;
  let userCreates = 0;
  let userUpdates = 0;
  let accountCreates = 0;
  let accountExists = options.userStatus !== "missing";
  let credentialCreates = 0;
  let lastRecoveryIpHash: string | undefined;
  const lockEvents: string[] = [];
  let passwordResetInsideTransaction = false;
  let transactionDepth = 0;
  let userWasUpserted = false;
  let oauthAccountExists = false;
  let sessionUserLookups = 0;
  let activationEnqueues = 0;
  const recoveryBuckets = new Map<
    string,
    {
      blockedUntil: Date | null;
      id: string;
      lastRequestAt: Date;
      requestCount: number;
      scope: string;
      subjectHash: string;
      windowStartedAt: Date;
    }
  >();

  if (options.activationToken) {
    const id = verifyOrderActivationToken(
      options.activationToken,
      "test-jwt-secret",
    );
    if (!id) throw new Error("Test activation token is invalid");
    activationTokens.push({
      consumedAt: options.tokenState === "consumed" ? new Date() : null,
      expiresAt:
        options.tokenState === "expired"
          ? new Date(Date.now() - 1000)
          : new Date(Date.now() + 60_000),
      sentAt:
        options.tokenState === "expired"
          ? new Date(Date.now() - 120_000)
          : new Date(),
      id,
      tokenHash:
        options.activationTokenHash ??
        createOrderActivationTokenHash(
          options.activationToken,
          "test-jwt-secret",
        ),
      userId: "new-user",
    });
  }

  const tx = {
    $queryRaw: async (query: unknown) => {
      const sql = Array.isArray(query) ? String(query[0]) : "";
      if (sql.includes("FROM users")) lockEvents.push("user");
      if (sql.includes("FROM auth_order_activation_tokens")) {
        lockEvents.push("activation-token");
      }
      if (
        sql.includes("FROM users") &&
        storedUser &&
        options.userStatusAfterLock
      ) {
        storedUser.status = options.userStatusAfterLock;
      }
      if (sql.includes("FROM users") && options.oauthAfterUserLock) {
        oauthAccountExists = true;
      }
      if (sql.includes("FROM users") && storedUser && userWasUpserted) {
        if (options.postUpsertEligibility === "blocked") {
          storedUser.status = UserStatus.BLOCKED;
        } else if (options.postUpsertEligibility === "deleted") {
          storedUser.status = UserStatus.DELETED;
        } else if (options.postUpsertEligibility === "credential") {
          credential = { id: "credential-concurrent" };
          passwordHash = "concurrent-hash";
        } else if (options.postUpsertEligibility === "oauth") {
          oauthAccountExists = true;
        }
      }
      if (
        sql.includes("FROM auth_accounts") &&
        options.credentialAfterAccountLock
      ) {
        credential = { id: "credential-concurrent" };
        passwordHash = "concurrent-hash";
      }
      return [];
    },
    authAccount: {
      findFirst: async ({ where }: { where?: { provider?: PrismaAuthProvider | { not: PrismaAuthProvider } } } = {}) =>
        storedUser &&
        (typeof where?.provider === "object"
          ? oauthAccountExists
          : accountExists &&
            (!where?.provider ||
              where.provider ===
                (options.accountProvider ?? PrismaAuthProvider.CREDENTIALS)))
          ? {
              id:
                typeof where?.provider === "object"
                  ? "oauth-account"
                  : "account-1",
              credential:
                typeof where?.provider === "object" ? null : credential ?? null,
              provider:
                typeof where?.provider === "object"
                  ? PrismaAuthProvider.YANDEX
                  : options.accountProvider ?? PrismaAuthProvider.CREDENTIALS,
              user: storedUser,
              userId: storedUser.id,
            }
          : null,
      upsert: async ({ create }: { create: { providerUserId: string } }) => {
        accountProviderUserIds.push(create.providerUserId);
        if (!accountExists) {
          accountCreates += 1;
          accountExists = true;
        }
        return {
          credential: credential ?? null,
          id: "account-1",
          provider: PrismaAuthProvider.CREDENTIALS,
          user: storedUser,
          userId: storedUser?.id,
        };
      },
    },
    authCredential: {
      create: async ({ data }: { data: { passwordHash: string } }) => {
        credentialCreates += 1;
        credential = { id: "credential-created" };
        passwordHash = data.passwordHash;
      },
      upsert: async ({ create, update }: { create: { passwordHash: string }; update: { passwordHash: string } }) => {
        if (!credential) credentialCreates += 1;
        credential = { id: "credential-created" };
        passwordHash = create.passwordHash ?? update.passwordHash;
      },
    },
    authEmailVerificationCode: { updateMany: async () => ({ count: 0 }) },
    authOrderActivationToken: {
      create: async ({ data }: { data: (typeof activationTokens)[number] }) => {
        if (options.activationCreateError) throw options.activationCreateError;
        const token = { ...data, consumedAt: data.consumedAt ?? null };
        activationTokens.push(token);
        return token;
      },
      findFirst: async ({ where }: { where?: { consumedAt?: null; expiresAt?: { gt: Date }; userId?: string } } = {}) =>
        [...activationTokens]
          .reverse()
          .find(
            (token) =>
              (where?.userId === undefined || token.userId === where.userId) &&
              (where?.consumedAt === undefined || token.consumedAt === null) &&
              (where?.expiresAt?.gt === undefined ||
                token.expiresAt > where.expiresAt.gt),
          ) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => {
        const token = activationTokens.find((item) => item.id === where.id);
        return token && storedUser ? { ...token, user: storedUser } : null;
      },
      updateMany: async ({ data }: { data: { consumedAt: Date } }) => {
        for (const token of activationTokens) {
          if (!token.consumedAt) token.consumedAt = data.consumedAt;
        }
        return { count: 1 };
      },
    },
    authPasswordResetToken: {
      updateMany: async () => ({ count: 1 }),
    },
    authRecoveryThrottle: {
      findUnique: async ({ where }: { where: { scope_subjectHash: { scope: string; subjectHash: string } } }) =>
        recoveryBuckets.get(
          `${where.scope_subjectHash.scope}:${where.scope_subjectHash.subjectHash}`,
        ) ?? null,
      update: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>;
        where: { id: string };
      }) => {
        const bucket = [...recoveryBuckets.values()].find(
          (item) => item.id === where.id,
        );
        if (!bucket) throw new Error("Recovery bucket not found");
        Object.assign(bucket, data);
        return bucket;
      },
      upsert: async ({
        create,
      }: {
        create: {
          lastRequestAt: Date;
          requestCount: number;
          scope: string;
          subjectHash: string;
          windowStartedAt: Date;
        };
      }) => {
        if (create.scope === "IP") lastRecoveryIpHash = create.subjectHash;
        const key = `${create.scope}:${create.subjectHash}`;
        let bucket = recoveryBuckets.get(key);
        if (!bucket) {
          bucket = {
            ...create,
            blockedUntil: null,
            id: `recovery-${recoveryBuckets.size + 1}`,
          };
          recoveryBuckets.set(key, bucket);
        }
        return bucket;
      },
    },
    order: {
      updateMany: async ({ data }: { data: { userId: string } }) => {
        orderUserId = data.userId;
        return { count: 1 };
      },
    },
    user: {
      findUnique: async () => storedUser ?? null,
      update: async ({ data }: { data: { authVersion?: { increment: number }; emailVerifiedAt: Date } }) => {
        userUpdates += 1;
        if (storedUser) storedUser.emailVerifiedAt = data.emailVerifiedAt;
        if (storedUser && data.authVersion) {
          storedUser.authVersion = Number(storedUser.authVersion ?? 0) + data.authVersion.increment;
        }
        return storedUser;
      },
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        if (!storedUser) {
          userCreates += 1;
          storedUser = { ...create, id: "new-user", status: UserStatus.ACTIVE };
        }
        userWasUpserted = true;
        return storedUser;
      },
    },
  };
  let transactionTail = Promise.resolve();
  const prisma = {
    $transaction: <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      const result = transactionTail.then(async () => {
        transactionDepth += 1;
        try {
          return await callback(tx);
        } finally {
          transactionDepth -= 1;
        }
      });
      transactionTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    authAccount: tx.authAccount,
    authOrderActivationToken: tx.authOrderActivationToken,
    user: tx.user,
  } as unknown as PrismaService;
  const credentials = {
    createPasswordHash: async (password: string) => `hashed:${password}`,
    getCredentialsUserById: async () => {
      sessionUserLookups += 1;
      return {
        id: "new-user",
        provider: "credentials" as const,
        providerUserId: "buyer@example.com",
        email: "buyer@example.com",
        roles: ["customer" as const],
        authVersion: Number(storedUser?.authVersion ?? 0),
      };
    },
  } as unknown as CredentialsAuthService;
  const mailer = {
    createOrderActivationEmail: (_email: string, url: string) => ({
      to: "buyer@example.com",
      subject: "Активируйте аккаунт для заказа",
      text: url,
    }),
    createPaidOrderLoginEmail: () => ({
      to: "buyer@example.com",
      subject: "Заказ добавлен в аккаунт",
      text: "Войдите в аккаунт или восстановите пароль",
    }),
  } as unknown as MailerService;
  const notifications = {
    enqueueEmail: async (email: { subject: string; text: string }) => {
      emails.push(email);
      notificationPayloads.push(email);
    },
    enqueueOrderActivation: async (payload: Record<string, unknown>) => {
      if (options.activationEnqueueError) throw options.activationEnqueueError;
      notificationPayloads.push({ kind: "order_activation", ...payload });
      activationEnqueues += 1;
      await options.afterActivationEnqueue?.(activationEnqueues);
    },
  } as unknown as NotificationQueueService;
  const passwordReset = {
    requestReset: async (input: unknown) => {
      passwordResetInsideTransaction = transactionDepth > 0;
      resetRequests.push(input);
      if (options.resetError) throw options.resetError;
      return { ok: true as const };
    },
  } as unknown as PasswordResetService;
  const users = {
    getDefaultPrismaRoles: () => ["CUSTOMER"],
  } as unknown as UsersService;
  process.env.AUTH_JWT_SECRET = "test-jwt-secret";
  const service = new OrderActivationService(
    credentials,
    mailer,
    notifications,
    passwordReset,
    prisma,
    users,
  );
  return {
    authVersion: () => Number(storedUser?.authVersion ?? 0),
    accountCreateCount: () => accountCreates,
    accountProviderUserIds,
    allowNextRecovery: () => {
      for (const bucket of recoveryBuckets.values()) {
        bucket.blockedUntil = null;
        bucket.lastRequestAt = new Date(Date.now() - 61_000);
      }
    },
    activationTokens,
    activeActivationTokens: () => activationTokens.filter((token) => !token.consumedAt).length,
    activeResetTokens: () => (passwordHash ? 0 : 1),
    credentialCreateCount: () => credentialCreates,
    emailVerifiedAt: () => storedUser?.emailVerifiedAt,
    emails,
    lastRecoveryIpHash: () => lastRecoveryIpHash,
    lockEvents: () => lockEvents,
    orderUserId: () => orderUserId,
    notificationPayloads,
    passwordHash: () => passwordHash,
    passwordResetInsideTransaction: () => passwordResetInsideTransaction,
    resetRequests,
    recoveryBucketCount: () => recoveryBuckets.size,
    service,
    sessionUserLookupCount: () => sessionUserLookups,
    transaction: <T>(
      callback: (transaction: Prisma.TransactionClient) => Promise<T>,
    ) => prisma.$transaction(callback),
    tx: tx as unknown as Prisma.TransactionClient,
    userCreateCount: () => userCreates,
    userUpdateCount: () => userUpdates,
  };
}

function createGuestOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    userId: null,
    customerEmail: "buyer@example.com",
    customerName: "Buyer",
    customerPhone: null,
    ...overrides,
  };
}

async function getRecoveryStatus(
  service: OrderActivationService,
  input: { email: string; ipAddress?: string },
) {
  try {
    await service.requestRecovery(input);
    return 200;
  } catch (error) {
    return error instanceof HttpException ? error.getStatus() : 500;
  }
}

function createTestActivationToken(seed: string) {
  const tokenId = crypto
    .createHash("sha256")
    .update(seed)
    .digest("base64url")
    .slice(0, 24);
  return createOrderActivationToken(tokenId, "test-jwt-secret");
}
