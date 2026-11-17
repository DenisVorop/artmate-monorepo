import "reflect-metadata";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { EmailAdvertisingController } from "../src/consents/email-advertising.controller";
import { EmailAdvertisingSettingsGrantService } from "../src/consents/email-advertising-settings-grant.service";
import { EmailAdvertisingService } from "../src/consents/email-advertising.service";
import { UnsubscribeTokenIssuer } from "../src/consents/unsubscribe-token-issuer.service";
import { SecurityHeadersMiddleware } from "../src/common/security-headers.middleware";
import { AuthController } from "../src/auth/auth.controller";
import { AuthGuard } from "../src/auth/auth.guard";
import { SiteActionGuard } from "../src/auth/site-action.guard";
import { OAuthProvidersService } from "../src/auth/oauth-providers.service";
import { TelegramLinkService } from "../src/auth/telegram-link.service";
import { ContactsController } from "../src/contacts/contacts.controller";
import { ContactsService } from "../src/contacts/contacts.service";
import { PublicPartnerApplicationsController } from "../src/partner-applications/partner-applications.controller";
import { PartnerApplicationsService } from "../src/partner-applications/partner-applications.service";
import { PartnerApplicationsThrottleService } from "../src/partner-applications/partner-applications-throttle.service";
import { AuthCompletionController } from "../src/auth/completion.controller";
import { AuthCompletionService } from "../src/auth/completion.service";
import { AuthService } from "../src/auth/auth.service";
import { CompletionSessionCheck } from "../src/auth/completion-session-check";
import { AuthSessionFlowController } from "../src/auth/session-flow.controller";
import { AuthYandexFlowController } from "../src/auth/yandex-flow.controller";
import { YandexFlowService } from "../src/auth/yandex-flow.service";
import { YandexOAuthService } from "../src/auth/yandex-oauth.service";
import type { YandexFlowResultV1 } from "../src/auth/contracts/yandex-flow.contract";
import { SessionFlowService } from "../src/auth/session-flow.service";
import { ConsentDecisionCommandHandler } from "../src/consents/consent-decision-command.handler";
import { ConsentReadModel } from "../src/consents/contracts/consent-read-model";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthLinkFlowController } from "../src/auth/link-flow.controller";
import { ActivationFlowService } from "../src/auth/activation-flow.service";
import { RecoveryFlowService } from "../src/auth/recovery-flow.service";
import { OrderActivationService } from "../src/auth/order-activation.service";
import { PasswordResetService } from "../src/auth/password-reset.service";
import { MailerService } from "../src/mailer/mailer.service";
import { UsersService } from "../src/users/users.service";
import {
  createOrderActivationToken,
  createOrderActivationTokenId,
  createOrderActivationTokenHash,
} from "../src/auth/order-activation-token";
import { createPasswordResetToken } from "../src/auth/password-reset-token";
import { ProfileDraftService } from "../src/auth/profile-draft.service";
import { CustomerProfileCommandHandler } from "../src/users/customer-profile-command.handler";
import { CustomerProfileCommandWorker } from "../src/users/customer-profile-command.worker";
import { ProfileCommandPayload } from "../src/users/contracts/profile-command-payload";
import { CustomerProfileValues } from "../src/users/contracts/customer-profile-values";
import type { RequestEvidenceV1 } from "../src/common/request-evidence";
import { FlowCredentials } from "../src/auth/flow-credentials";
import { AuthFlowController } from "../src/auth/flow.controller";
import { FlowLifecycleService } from "../src/auth/flow-lifecycle.service";
import { AuthFlowStore } from "../src/auth/flow.store";
import { CustomerDirectoryReader } from "../src/auth/customer-directory.reader";
import { PasswordFlowService } from "../src/auth/password-flow.service";
import { RegistrationCodeService } from "../src/auth/registration-code.service";
import { RegistrationDraftService } from "../src/auth/registration-draft.service";
import { LoginThrottleService } from "../src/auth/login-throttle.service";
import { CredentialsAuthService } from "../src/auth/credentials-auth.service";
import { PasswordHasher } from "../src/auth/password-hasher";
import { PendingCleanupService } from "../src/auth/pending-cleanup.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { NotificationQueueService } from "../src/notifications/notification-queue.service";
import { RegistrationEmailAdapter } from "../src/notifications/integrations/registration-email.adapter";
import type { AuthFlowStateDTO } from "../../site/src/shared/actions/auth/flow.types";
import type { AuthFlowCredentials } from "../src/auth/contracts/flow-response.contract";

const url = process.env.ARTMATE_AUTH_TEST_DATABASE_URL;

describe("auth pipeline isolated PostgreSQL + HTTP", { skip: !url }, () => {
  let db: PrismaClient;
  let admin: Pool;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let baseUrl: string;
  let yandexIdentity: { providerUserId: string; contactEmail: string | null };
  let yandexExchanges = 0;
  const businessNotifications: string[] = [];
  let yandexFail = false;
  let yandexGate: (() => Promise<void>) | undefined;
  const yandexTransport = new YandexOAuthService();
  const schema = `auth_flow_${crypto.randomUUID().replace(/-/g, "")}`;
  const originalEnv = {
    code: process.env.AUTH_EMAIL_VERIFICATION_SECRET,
    proxy: process.env.AUTH_FLOW_PROXY_SECRET,
    cooldown: process.env.AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    node: process.env.NODE_ENV,
    jwt: process.env.AUTH_JWT_SECRET,
    envEmail: process.env.AUTH_PASSWORD_EMAIL,
    envPassword: process.env.AUTH_PASSWORD,
    envHash: process.env.AUTH_PASSWORD_HASH,
    resetSecret: process.env.AUTH_PASSWORD_RESET_SECRET,
    recipientSecret: process.env.ADVERTISING_RECIPIENT_HMAC_SECRET,
    recipientVersion: process.env.ADVERTISING_RECIPIENT_KEY_VERSION,
    yandexClient: process.env.YANDEX_OAUTH_CLIENT_ID,
    siteUrl: process.env.SITE_URL,
  };

  before(async () => {
    const parsed = new URL(url!);
    assert.ok(
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname),
      "Only a dedicated local PostgreSQL is allowed",
    );
    process.env.AUTH_EMAIL_VERIFICATION_SECRET = "isolated-email-code-secret";
    process.env.AUTH_FLOW_PROXY_SECRET = "isolated-auth-proxy-secret";
    process.env.NODE_ENV = "test";
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const pool = new Pool({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    const root = resolve(__dirname, "../prisma/migrations");
    const client = await pool.connect();
    try {
      for (const entry of (await readdir(root, { withFileTypes: true }))
        .filter((item) => item.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))) {
        await client.query(
          await readFile(resolve(root, entry.name, "migration.sql"), "utf8"),
        );
      }
    } finally {
      client.release();
    }
    db = new PrismaClient({
      adapter: new PrismaPg(pool, { schema, disposeExternalPool: true }),
    });
    @Module({
      controllers: [
        AuthController,
        EmailAdvertisingController,
        ContactsController,
        PublicPartnerApplicationsController,
        AuthFlowController,
        AuthLinkFlowController,
        AuthCompletionController,
        AuthSessionFlowController,
        AuthYandexFlowController,
      ],
      providers: [
        { provide: PrismaService, useValue: db },
        {
          provide: CredentialsAuthService,
          useFactory: () =>
            new CredentialsAuthService(
              db as never,
              new UsersService(db as never),
            ),
        },
        ActivationFlowService,
        RecoveryFlowService,
        {
          provide: PasswordResetService,
          inject: [CredentialsAuthService],
          useFactory: (credentials: CredentialsAuthService) =>
            new PasswordResetService(credentials, _queue(), db as never),
        },
        {
          provide: OrderActivationService,
          inject: [PasswordResetService],
          useFactory: (reset: PasswordResetService) =>
            new OrderActivationService(
              _mailer(),
              _queue(),
              reset,
              db as never,
              new UsersService(db as never),
            ),
        },
        AuthFlowStore,
        FlowLifecycleService,
        CustomerDirectoryReader,
        AuthGuard,
        SiteActionGuard,
        EmailAdvertisingService,
        EmailAdvertisingSettingsGrantService,
        UnsubscribeTokenIssuer,
        PartnerApplicationsService,
        PartnerApplicationsThrottleService,
        {
          provide: UsersService,
          useFactory: () => new UsersService(db as never),
        },
        {
          provide: OAuthProvidersService,
          useValue: { getProviders: () => [] },
        },
        { provide: TelegramLinkService, useValue: {} },
        {
          provide: ContactsService,
          useFactory: () => {
            const contacts = new ContactsService({} as never);
            contacts.sendTelegramNotification = async (text: string) => {
              businessNotifications.push(text);
            };
            contacts.enqueueTelegramNotification = async (text: string) => {
              businessNotifications.push(text);
            };
            return contacts;
          },
        },
        PasswordFlowService,
        RegistrationCodeService,
        RegistrationDraftService,
        ProfileDraftService,
        LoginThrottleService,
        AuthCompletionService,
        CompletionSessionCheck,
        SessionFlowService,
        YandexFlowService,
        {
          provide: YandexOAuthService,
          useValue: {
            getAuthorizationUrl:
              yandexTransport.getAuthorizationUrl.bind(yandexTransport),
            getRedirectUri:
              yandexTransport.getRedirectUri.bind(yandexTransport),
            getIdentityByCode: async () => {
              yandexExchanges++;
              await yandexGate?.();
              if (yandexFail) throw new Error("isolated provider failure");
              return yandexIdentity;
            },
          },
        },
        JwtService,
        {
          provide: AuthService,
          inject: [CredentialsAuthService],
          useFactory: (credentials: CredentialsAuthService) =>
            new AuthService(
              new JwtService(),
              credentials,
              db as never,
              new UsersService(db as never),
            ),
        },
      ],
    })
    class TestModule {}
    app = await NestFactory.create(TestModule, { logger: ["error"] });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    );
    const security = new SecurityHeadersMiddleware();
    app.use(
      (
        req: { originalUrl?: string; url?: string },
        res: { setHeader(name: string, value: string): void },
        next: () => void,
      ) => security.use(req, res, next),
    );
    const csrf = new CsrfMiddleware();
    app.use(
      (
        req: Parameters<CsrfMiddleware["use"]>[0],
        res: unknown,
        next: (error?: unknown) => void,
      ) => {
        try {
          csrf.use(req, res, next);
        } catch (error) {
          next(error);
        }
      },
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });
  after(async () => {
    await app?.close();
    await db?.$disconnect();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
    for (const [name, value] of Object.entries({
      AUTH_EMAIL_VERIFICATION_SECRET: originalEnv.code,
      AUTH_FLOW_PROXY_SECRET: originalEnv.proxy,
      AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: originalEnv.cooldown,
      NODE_ENV: originalEnv.node,
      AUTH_JWT_SECRET: originalEnv.jwt,
      AUTH_PASSWORD_EMAIL: originalEnv.envEmail,
      AUTH_PASSWORD: originalEnv.envPassword,
      AUTH_PASSWORD_HASH: originalEnv.envHash,
      AUTH_PASSWORD_RESET_SECRET: originalEnv.resetSecret,
      ADVERTISING_RECIPIENT_HMAC_SECRET: originalEnv.recipientSecret,
      ADVERTISING_RECIPIENT_KEY_VERSION: originalEnv.recipientVersion,
      YANDEX_OAUTH_CLIENT_ID: originalEnv.yandexClient,
      SITE_URL: originalEnv.siteUrl,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      "TRUNCATE partner_applications, user_consent_states, email_advertising_subscriptions, consent_revisions, users, auth_email_challenges, verified_identity_facts, auth_authentication_facts, auth_pending_flows, auth_completion_operations, notification_jobs, auth_login_throttles, auth_recovery_throttles, oauth_states CASCADE",
    );
    process.env.YANDEX_OAUTH_CLIENT_ID = "isolated-yandex-client";
    process.env.SITE_URL = "http://localhost:3000";
    yandexIdentity = {
      providerUserId: "provider@example.test",
      contactEmail: "provider@example.test",
    };
    businessNotifications.length = 0;
    yandexExchanges = 0;
    yandexFail = false;
    yandexGate = undefined;
    delete process.env.AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS;
    delete process.env.AUTH_PASSWORD_EMAIL;
    delete process.env.AUTH_PASSWORD;
    delete process.env.AUTH_PASSWORD_HASH;
    process.env.AUTH_JWT_SECRET = "isolated-existing-env-auth-secret";
    process.env.AUTH_PASSWORD_RESET_SECRET = "isolated-password-reset-secret";
    process.env.ADVERTISING_RECIPIENT_HMAC_SECRET =
      "isolated-recipient-key-secret-for-fixture-only";
    process.env.ADVERTISING_RECIPIENT_KEY_VERSION = "fixture-v1";
  });

  it("reuses an existing email confirmation on password login without another code or ordinary session", async () => {
    const user = await _user("ready");
    const result = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.state.status, "PENDING");
    assert.equal(result.state.nextStep, "preparing");
    if (
      result.state.status === "PENDING" &&
      result.state.nextStep === "preparing"
    )
      assert.equal(result.state.emailVerified, true);
    assert.equal(result.cookie.includes("artmate_access_token"), false);
    assert.equal(await db.authEmailChallenge.count(), 0);
    assert.equal(await db.notificationJob.count(), 0);
    const proof = await db.verifiedIdentityFact.findFirstOrThrow();
    assert.equal(proof.method, "RECORDED_EMAIL_VERIFICATION");
    assert.equal(proof.userIdSnapshot, user.id);
    assert.equal(proof.email, user.email);
    assert.deepEqual(proof.verifiedAt, user.emailVerifiedAt);
    assert.equal(await db.verifiedIdentityFact.count(), 1);
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    const auth = await db.authAuthenticationFact.findFirstOrThrow();
    assert.equal(auth.method, "PASSWORD");
    assert.equal(auth.identityFactId, proof.id);
    assert.ok(auth.credentialUpdatedAt);
    const persisted = JSON.stringify(await db.authPendingFlow.findMany());
    assert.equal(
      persisted.includes(_credentials(result.cookie).pending),
      false,
    );
    const read = await _get(result.cookie);
    assert.deepEqual(read.state, result.state);
    const repeated = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    assert.equal(repeated.response.status, 201);
    assert.equal(await db.verifiedIdentityFact.count(), 1);
    assert.equal(await db.notificationJob.count(), 0);
    assert.equal(await db.authEmailChallenge.count(), 0);
  });

  it("reuses existing environment credentials without provisioning or changing the User", async () => {
    const guest = await _user("guest");
    const user = await db.user.update({
      where: { id: guest.id },
      data: { emailVerifiedAt: new Date() },
    });
    process.env.AUTH_PASSWORD_EMAIL = "guest@example.test";
    process.env.AUTH_PASSWORD_HASH = await PasswordHasher.create(
      "configured-password",
    );
    const result = await _post("/auth/flow/password", {
      email: "guest@example.test",
      password: "configured-password",
    });
    assert.equal(result.response.status, 201);
    const auth = await db.authAuthenticationFact.findFirstOrThrow();
    assert.equal(auth.method, "ENV_PASSWORD");
    assert.equal(auth.credentialUpdatedAt, null);
    assert.match(auth.envCredentialBindingSnapshot!, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.equal(await db.authCredential.count(), 0);
    process.env.AUTH_PASSWORD_HASH = await PasswordHasher.create(
      "changed-configured-password",
    );
    assert.equal((await _get(result.cookie)).response.status, 401);
    const registration = await _confirm(await _request("guest@example.test"));
    assert.deepEqual(registration.state, {
      status: "LOGIN_REQUIRED",
      nextStep: "login",
    });
    assert.equal(await db.authCredential.count(), 0);
  });

  it("starts a new verified password attempt after cancellation and invalidates an old credential version", async () => {
    const user = await _user("ready");
    const first = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    await _post("/auth/flow/cancel", {}, first.cookie);
    const second = await _post(
      "/auth/flow/password",
      { email: "ready@example.test", password: "existing-password" },
      first.cookie,
    );
    assert.equal(second.response.status, 201);
    assert.notDeepEqual(second.state, first.state);
    const account = await db.authAccount.findFirstOrThrow({
      where: { userId: user.id },
    });
    await db.authCredential.update({
      where: { accountId: account.id },
      data: {
        passwordHash: await PasswordHasher.create("changed-password"),
        passwordUpdatedAt: new Date(Date.now() + 1),
      },
    });
    assert.equal((await _get(second.cookie)).response.status, 401);
    const third = await _post(
      "/auth/flow/password",
      { email: "ready@example.test", password: "changed-password" },
      second.cookie,
    );
    assert.equal(third.response.status, 201);
  });

  it("publishes a live read-only Users directory instead of reading or modifying private user rows", async () => {
    const user = await _user("ready");
    const before = await db.$queryRaw<
      { email: string }[]
    >`SELECT email FROM customer_auth_directory_v1 WHERE user_id = ${user.id}`;
    assert.deepEqual(before, [{ email: "ready@example.test" }]);
    await assert.rejects(
      db.$executeRaw`UPDATE customer_auth_directory_v1 SET name = 'forged' WHERE user_id = ${user.id}`,
    );
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).name,
      user.name,
    );
  });

  it("gives the same credential error for unknown, wrong, blocked, deleted and provider-only accounts", async () => {
    for (const kind of ["ready", "blocked", "deleted", "provider"] as const)
      await _user(kind);
    for (const email of [
      "unknown@example.test",
      "ready@example.test",
      "blocked@example.test",
      "deleted@example.test",
      "provider@example.test",
    ]) {
      const result = await _post("/auth/flow/password", {
        email,
        password: email.startsWith("ready") ? "wrong" : "existing-password",
      });
      assert.equal(result.response.status, 401);
      assert.equal(
        (result.state as unknown as { message: string }).message,
        "Invalid email or password",
      );
    }
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.authAuthenticationFact.count(), 0);
  });

  it("retains parallel failed password attempts in the existing login throttle", async () => {
    await _user("ready");
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        _post("/auth/flow/password", {
          email: "ready@example.test",
          password: "wrong-password",
        }),
      ),
    );
    assert.equal(
      attempts.every((result) => [401, 429].includes(result.response.status)),
      true,
    );
    const denied = attempts.filter(
      (result) => result.response.status === 401,
    ).length;
    const counter = await db.authLoginThrottle.findFirstOrThrow({
      where: { scope: "LOGIN" },
    });
    assert.equal(counter.failedAttempts, denied);
    assert.ok(counter.lockedUntil);
    assert.equal(
      (
        await _post("/auth/flow/password", {
          email: "ready@example.test",
          password: "existing-password",
        })
      ).response.status,
      429,
    );
  });

  it("confirms an existing account by code and signs in with its original password", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("unfinished");
    const credential = await db.authCredential.findFirstOrThrow();
    const input = { email: user.email!, password: "existing-password" };
    const denied = await _post("/auth/flow/password", {
      ...input,
      password: "wrong-password",
    });
    assert.equal(denied.response.status, 401);
    const needsCode = await _post("/auth/flow/password", input);
    assert.equal(needsCode.response.status, 201);
    assert.deepEqual(needsCode.state, {
      status: "EMAIL_CONFIRMATION_REQUIRED",
      nextStep: "email",
    });
    assert.equal(needsCode.cookie, "");
    assert.equal(await db.notificationJob.count(), 0);

    const confirmed = await _confirm(await _request(input.email));
    assert.deepEqual(confirmed.state, {
      status: "LOGIN_REQUIRED",
      nextStep: "login",
    });
    assert.equal(confirmed.cookie.includes("artmate_access_token="), false);
    const proof = await db.verifiedIdentityFact.findFirstOrThrow();
    assert.equal(proof.userIdSnapshot, user.id);
    assert.equal(proof.email, input.email);
    assert.equal(proof.method, "EMAIL_CODE");
    assert.equal(await db.authAuthenticationFact.count(), 0);
    assert.equal(
      (await _post("/auth/flow/password", { ...input, password: "wrong-password" }))
        .response.status,
      401,
    );

    // The site's next password attempt cancels the code continuation.
    assert.equal((await _post("/auth/flow/cancel", {}, confirmed.cookie)).response.status, 201);
    const signedIn = await _post("/auth/flow/password", input);
    assert.equal(signedIn.response.status, 201);
    const flow = await _pendingRecord(signedIn.cookie);
    assert.equal(flow.identityFactId, proof.id);
    const submitted = await _completionPost(
      await _consentInput(signedIn.cookie, revisions, false),
      signedIn.cookie,
    );
    assert.equal(submitted.state.status, "PENDING");
    const completed = await _finishCompletion(signedIn.cookie);
    await _assertSession(completed.cookie, user.id);
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt?.getTime(),
      proof.verifiedAt.getTime(),
    );
    assert.deepEqual(await db.authCredential.findMany(), [credential]);
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.notificationJob.count(), 1);
  });

  it("requires a new code when the existing account has no proof bound to it", async () => {
    const email = "unfinished@example.test";
    const confirmed = await _confirm(await _request(email));
    assert.equal(confirmed.state.nextStep, "registration");
    const user = await _user("unfinished");
    const login = await _post("/auth/flow/password", {
      email,
      password: "existing-password",
    });
    assert.deepEqual(login.state, {
      status: "EMAIL_CONFIRMATION_REQUIRED",
      nextStep: "email",
    });
    assert.equal(login.cookie, "");
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt,
      null,
    );
  });

  it("verifies the code before creating a registration draft, leaving User and active credentials absent", async () => {
    const requested = await _request("new@example.test");
    assert.equal(requested.state.nextStep, "code");
    assert.equal(await db.user.count(), 0);
    const confirmed = await _confirm(requested);
    assert.equal(confirmed.state.nextStep, "registration");
    const saved = await _post(
      "/auth/flow/registration",
      _draft(),
      confirmed.cookie || requested.cookie,
    );
    assert.equal(saved.response.status, 201);
    assert.equal(saved.state.nextStep, "preparing");
    const flow = await db.authPendingFlow.findFirstOrThrow();
    assert.match(flow.credentialPasswordHash!, /^scrypt:/);
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.user.count(), 0);
    assert.equal(await db.authSession.count(), 0);
    assert.equal(JSON.stringify(flow).includes("new-password"), false);
  });

  it("reuses a provisional guest and prefilled contacts without creating a second User", async () => {
    const guest = await _user("guest");
    const result = await _confirm(await _request("guest@example.test"));
    assert.equal(result.state.nextStep, "registration");
    if (
      result.state.status === "PENDING" &&
      result.state.nextStep === "registration"
    ) {
      assert.equal(result.state.name, "Existing name");
      assert.equal(result.state.phone, "+79990000000");
    }
    assert.equal(
      (await db.authPendingFlow.findFirstOrThrow()).userIdSnapshot,
      guest.id,
    );
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.authCredential.count(), 0);
  });

  it("never turns registration codes into passwordless login or password replacement", async () => {
    for (const kind of ["ready", "provider"] as const) {
      await _user(kind);
      const before = await db.authCredential.findMany();
      const result = await _confirm(await _request(`${kind}@example.test`));
      assert.deepEqual(result.state, {
        status: "LOGIN_REQUIRED",
        nextStep: "login",
      });
      assert.deepEqual(await db.authCredential.findMany(), before);
    }
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.authAuthenticationFact.count(), 0);
    assert.equal(await db.authSession.count(), 0);
  });

  it("reuses real earlier email proof on password login without sending another code", async () => {
    await _user("ready");
    const requested = await _request("ready@example.test");
    const code = await _confirm(requested);
    assert.equal(code.state.status, "LOGIN_REQUIRED");
    const password = await _post(
      "/auth/flow/password",
      { email: "ready@example.test", password: "existing-password" },
      code.cookie,
    );
    assert.equal(password.response.status, 201);
    if (
      password.state.status === "PENDING" &&
      password.state.nextStep === "preparing"
    )
      assert.equal(password.state.emailVerified, true);
    else assert.fail("Expected a password continuation");
    assert.equal(await db.authEmailChallenge.count(), 1);
    assert.equal(await db.notificationJob.count(), 1);
    assert.equal(
      (await db.authAuthenticationFact.findFirstOrThrow()).method,
      "PASSWORD",
    );
  });

  it("reading status during confirmation cannot misclassify a new registration as an existing login", async () => {
    const requested = await _request("status-race@example.test");
    const [confirm, read] = await Promise.all([
      _confirm(requested),
      _get(requested.cookie),
    ]);
    assert.equal(confirm.response.status, 201);
    assert.equal(read.response.status, 200);
    assert.equal(read.state.status, "PENDING");
    assert.ok(["code", "registration"].includes(read.state.nextStep));
    assert.equal((await _get(requested.cookie)).state.nextStep, "registration");
  });

  it("cancelling during code confirmation leaves no active continuation", async () => {
    const requested = await _request("confirm-cancel@example.test");
    const [confirm, cancel] = await Promise.all([
      _confirm(requested),
      _post("/auth/flow/cancel", {}, requested.cookie),
    ]);
    assert.equal(cancel.response.status, 201);
    assert.ok([201, 400, 401].includes(confirm.response.status));
    assert.equal(
      await db.authPendingFlow.count({ where: { status: "OPEN" } }),
      0,
    );
    assert.notEqual((await _get(requested.cookie)).response.status, 200);
  });

  it("consumes one code exactly once under simultaneous confirms and recovers a lost response", async () => {
    const requested = await _request("parallel@example.test");
    const results = await Promise.all([
      _confirm(requested),
      _confirm(requested),
    ]);
    assert.equal(
      results.every((item) => item.response.status === 201),
      true,
    );
    assert.deepEqual(results[0]!.state, results[1]!.state);
    const replay = await _confirm(requested);
    assert.deepEqual(replay.state, results[0]!.state);
    assert.equal(await db.verifiedIdentityFact.count(), 1);
    assert.equal(await db.authAuthenticationFact.count(), 1);
    assert.equal(await db.authPendingFlow.count(), 1);
  });

  it("binds code verification and flow status to both browser and opaque capability", async () => {
    const requested = await _request("browser@example.test");
    const wrongBrowser = requested.cookie.replace(
      /artmate_auth_browser=[^;]+/,
      `artmate_auth_browser=${"f".repeat(64)}`,
    );
    assert.equal(
      (
        await _post(
          "/auth/email-code/confirm",
          { code: requested.code, generation: 1 },
          wrongBrowser,
        )
      ).response.status,
      401,
    );
    await _confirm(requested);
    assert.equal((await _get(wrongBrowser)).response.status, 401);
    assert.equal(
      (await _get("artmate_access_token=not-a-pending-capability")).response
        .status,
      401,
    );
  });

  it("persists a bounded attempt budget even when invalid confirms arrive concurrently", async () => {
    const requested = await _request("attempts@example.test");
    await db.authEmailChallenge.updateMany({ data: { maxAttempts: 3 } });
    const bad = requested.code === "000000" ? "111111" : "000000";
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        _post(
          "/auth/email-code/confirm",
          { code: bad, generation: 1 },
          requested.cookie,
        ),
      ),
    );
    assert.equal(
      results.every((item) => item.response.status === 400),
      true,
    );
    const row = await db.authEmailChallenge.findFirstOrThrow();
    assert.equal(row.failedAttempts, 3);
    assert.ok(row.consumedAt);
    assert.equal((await _confirm(requested)).response.status, 400);
    assert.equal(await db.verifiedIdentityFact.count(), 0);
  });

  it("serializes send cooldowns across parallel requests and never stores plaintext in the outbox", async () => {
    const results = await Promise.all([
      _post("/auth/email-code/request", { email: "same@example.test" }),
      _post("/auth/email-code/request", { email: "same@example.test" }),
    ]);
    assert.deepEqual(
      results.map((item) => item.response.status).sort(),
      [201, 429],
    );
    const job = await db.notificationJob.findFirstOrThrow();
    assert.deepEqual(Object.keys(job.payload as object).sort(), [
      "challengeId",
      "contractVersion",
      "generation",
      "kind",
    ]);
    assert.equal(await db.authEmailChallenge.count(), 1);
  });

  it("resends under the same challenge, invalidates the old generation and drops obsolete email jobs", async () => {
    const requested = await _request("resend@example.test");
    await db.authEmailChallenge.updateMany({
      data: { resendAvailableAt: new Date(Date.now() - 1) },
    });
    const resend = await _post("/auth/email-code/resend", {}, requested.cookie);
    assert.equal(resend.response.status, 201);
    assert.equal(resend.state.nextStep, "code");
    if (resend.state.status === "PENDING" && resend.state.nextStep === "code")
      assert.equal(resend.state.generation, 2);
    const jobs = await db.notificationJob.findMany({
      orderBy: { createdAt: "asc" },
    });
    assert.equal(
      await RegistrationEmailAdapter.prepare(
        db as never,
        jobs[0]!.payload as Record<string, unknown>,
      ),
      null,
    );
    const mail = await RegistrationEmailAdapter.prepare(
      db as never,
      jobs[1]!.payload as Record<string, unknown>,
    );
    assert.ok(mail);
    assert.equal((await _confirm(requested)).response.status, 400);
    const newCode = /Код подтверждения: (\d{6})/.exec(mail.text!)![1]!;
    const confirmed = await _post(
      "/auth/email-code/confirm",
      { code: newCode, generation: 2 },
      requested.cookie,
    );
    assert.equal(confirmed.response.status, 201);
    assert.equal(confirmed.state.nextStep, "registration");
    assert.equal(
      (await db.authEmailChallenge.findFirstOrThrow()).failedAttempts,
      1,
    );
  });

  it("processes the committed registration job once across two workers using the existing mailer contract", async () => {
    const requested = await _request("worker@example.test");
    const delivered: { text?: string }[] = [];
    const mailer = {
      sendMail: async (input: { text?: string }) => {
        delivered.push(input);
      },
    };
    const a = new NotificationQueueService(mailer as never, db as never);
    const b = new NotificationQueueService(mailer as never, db as never);
    await Promise.all([a.processDueJobs(), b.processDueJobs()]);
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0]!.text?.includes(requested.code), true);
    assert.equal((await db.notificationJob.findFirstOrThrow()).status, "SENT");
  });

  it("binds password completion and advertising consent to the existing email confirmation", async () => {
    const user = await _user("ready");
    await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    const flow = await db.authPendingFlow.findFirstOrThrow();
    assert.ok(flow.identityFactId);
    const op = await db.authCompletionOperation.create({
      data: {
        flowId: flow.id,
        identityFactId: flow.identityFactId,
        authenticationFactId: flow.authenticationFactId,
        purpose: "site_auth",
        operationKey: crypto.randomUUID(),
        payloadHash: "a".repeat(64),
      },
    });
    await db.authPendingFlow.update({
      where: { id: flow.id },
      data: { currentOperationId: op.id, status: "COMPLETING" },
    });
    await _confirm(await _request("other@example.test"));
    const otherProof = await db.verifiedIdentityFact.findFirstOrThrow({
      where: { email: "other@example.test" },
    });
    const bytes = Buffer.from("document and form snapshot");
    const publishedAt = new Date();
    const revision = await db.consentRevision.create({
      data: {
        kind: "EMAIL_ADVERTISING",
        purpose: "site_auth",
        version: "1",
        documentTitle: "Consent",
        documentBytes: bytes,
        documentSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        formSnapshotBytes: bytes,
        formSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        createdAt: publishedAt,
        publishedAt,
      },
    });
    const subscription = await db.emailAdvertisingSubscription.create({
      data: {
        email: user.email,
        recipientKey: "b".repeat(64),
        keyVersion: "v1",
      },
    });
    await assert.rejects(
      db.emailAdvertisingConsentEvent.create({
        data: {
          subscriptionId: subscription.id,
          version: 1,
          operationKey: crypto.randomUUID(),
          payloadHash: "c".repeat(64),
          action: "GRANTED",
          authOperationId: op.id,
          identityFactId: otherProof.id,
          actorUserIdSnapshot: user.id,
          email: user.email!,
          revisionId: revision.id,
          requestId: "request",
          requestContext: otherProof.requestContext!,
        },
      }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("Advertising grant revision/identity mismatch"),
    );
    assert.equal(
      (
        await db.emailAdvertisingSubscription.findUniqueOrThrow({
          where: { id: subscription.id },
        })
      ).state,
      "REVOKED",
    );
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    const proof = await db.verifiedIdentityFact.findUniqueOrThrow({
      where: { id: flow.identityFactId },
    });
    await db.$transaction(async (tx) => {
      const event = await tx.emailAdvertisingConsentEvent.create({
        data: {
          subscriptionId: subscription.id,
          version: 1,
          operationKey: crypto.randomUUID(),
          payloadHash: "c".repeat(64),
          action: "GRANTED",
          authOperationId: op.id,
          identityFactId: proof.id,
          actorUserIdSnapshot: user.id,
          email: user.email!,
          revisionId: revision.id,
          requestId: "request",
          requestContext: proof.requestContext!,
        },
      });
      await tx.emailAdvertisingSubscription.update({
        where: { id: subscription.id },
        data: { state: "ACTIVE", version: 1, activeGrantId: event.id },
      });
    });
    assert.equal(
      (
        await db.emailAdvertisingSubscription.findUniqueOrThrow({
          where: { id: subscription.id },
        })
      ).state,
      "ACTIVE",
    );
    // The only code in this test belongs to the other user; ready@example.test
    // subscribes with the confirmation it already had before password login.
    assert.equal(
      await db.authEmailChallenge.count({ where: { email: user.email! } }),
      0,
    );
    assert.deepEqual(proof.verifiedAt, user.emailVerifiedAt);
  });

  it("serializes resend against confirmation without accepting an obsolete generation", async () => {
    const requested = await _request("resend-race@example.test");
    await db.authEmailChallenge.updateMany({
      data: { resendAvailableAt: new Date(Date.now() - 1) },
    });
    const result = await Promise.all([
      _confirm(requested),
      _post("/auth/email-code/resend", {}, requested.cookie),
    ]);
    assert.deepEqual(
      result.map((item) => item.response.status).sort(),
      [201, 400],
    );
    assert.ok((await db.verifiedIdentityFact.count()) <= 1);
    assert.ok((await db.authPendingFlow.count()) <= 1);
    assert.equal(await db.authSession.count(), 0);
  });

  it("a cancellation racing password draft save cannot retain or activate the draft", async () => {
    const requested = await _request("cancel-race@example.test");
    await _confirm(requested);
    const result = await Promise.all([
      _post("/auth/flow/registration", _draft(), requested.cookie),
      _post("/auth/flow/cancel", {}, requested.cookie),
    ]);
    assert.equal(result[1]!.response.status, 201);
    assert.ok([201, 401].includes(result[0]!.response.status));
    const flow = await db.authPendingFlow.findFirstOrThrow();
    assert.equal(flow.status, "CANCELLED");
    assert.equal(flow.credentialPasswordHash, null);
    assert.equal(await db.authCredential.count(), 0);
  });

  it("rejects expired codes, prevents resend after attempt exhaustion and does not resurrect a cancelled flow", async () => {
    const requested = await _request("expired@example.test");
    const row = await db.authEmailChallenge.findFirstOrThrow();
    await db.authEmailChallenge.update({
      where: { id: row.id },
      data: { expiresAt: new Date(row.createdAt.getTime() + 1) },
    });
    assert.equal((await _confirm(requested)).response.status, 400);
    assert.equal(
      (await _post("/auth/email-code/resend", {}, requested.cookie)).response
        .status,
      400,
    );
    const active = await _request("cancelled@example.test");
    await _confirm(active);
    await _post("/auth/flow/registration", _draft(), active.cookie);
    assert.equal(
      (await _post("/auth/flow/cancel", {}, active.cookie)).response.status,
      201,
    );
    const flow = await db.authPendingFlow.findFirstOrThrow();
    assert.equal(flow.status, "CANCELLED");
    assert.equal(flow.credentialPasswordHash, null);
    assert.equal((await _confirm(active)).response.status, 401);
  });

  it("requires matching passwords and immutable registration payloads on retries", async () => {
    const requested = await _request("draft@example.test");
    await _confirm(requested);
    const draft = _draft();
    assert.equal(
      (
        await _post(
          "/auth/flow/registration",
          { ...draft, passwordConfirm: "different-password" },
          requested.cookie,
        )
      ).response.status,
      400,
    );
    const first = await _post(
      "/auth/flow/registration",
      draft,
      requested.cookie,
    );
    assert.equal(first.response.status, 201);
    const retry = await _post(
      "/auth/flow/registration",
      draft,
      requested.cookie,
    );
    assert.equal(retry.response.status, 201);
    assert.deepEqual(retry.state, first.state);
    assert.equal(
      (
        await _post(
          "/auth/flow/registration",
          { ...draft, phone: "+79991111111" },
          requested.cookie,
        )
      ).response.status,
      409,
    );
    assert.equal(
      (
        await _post(
          "/auth/flow/registration",
          { ...draft, operationKey: crypto.randomUUID() },
          requested.cookie,
        )
      ).response.status,
      409,
    );
  });

  it("does not overwrite an account that acquired a credential after its code was confirmed", async () => {
    const guest = await _user("guest");
    const requested = await _request("guest@example.test");
    await _confirm(requested);
    const account = await db.authAccount.findFirstOrThrow({
      where: { userId: guest.id },
    });
    const hash = await PasswordHasher.create("another-registration-password");
    await db.authCredential.create({
      data: { accountId: account.id, passwordHash: hash },
    });
    assert.equal(
      (await _post("/auth/flow/registration", _draft(), requested.cookie))
        .response.status,
      409,
    );
    assert.equal(
      (
        await db.authCredential.findUniqueOrThrow({
          where: { accountId: account.id },
        })
      ).passwordHash,
      hash,
    );
    assert.equal(
      (await db.authPendingFlow.findFirstOrThrow()).credentialPasswordHash,
      null,
    );
  });

  it("refreshes Users-owned status/authVersion without a stale profile projection", async () => {
    const user = await _user("ready");
    const result = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    await db.user.update({
      where: { id: user.id },
      data: { status: "BLOCKED", authVersion: { increment: 1 } },
    });
    assert.equal((await _get(result.cookie)).response.status, 401);
    assert.equal(await db.authSession.count(), 0);
  });

  it("rejects forged actor/recipient fields and missing CSRF before producing any state", async () => {
    assert.equal(
      (
        await _post("/auth/email-code/request", {
          email: "x@example.test",
          userId: "forged",
        })
      ).response.status,
      400,
    );
    const response = await fetch(`${baseUrl}/auth/email-code/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@example.test" }),
    });
    assert.equal(response.status, 403);
    assert.equal(await db.authEmailChallenge.count(), 0);
  });

  it("expires secret drafts without deleting immutable identity evidence", async () => {
    const requested = await _request("cleanup@example.test");
    await _confirm(requested);
    // Use a test clock at the public cleanup boundary, preserving the immutable TTL.
    const cleanup = new PendingCleanupService(db as never);
    const realDate = Date;
    const flow = await db.authPendingFlow.findFirstOrThrow();
    const expiredNow = flow.expiresAt.getTime() + 1;
    const { mock } = await import("node:test");
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    mock.timers.enable({ apis: ["Date"], now: expiredNow });
    try {
      await cleanup.expire();
    } finally {
      mock.timers.reset();
    }
    assert.equal(Date, realDate);
    const expired = await db.authPendingFlow.findFirstOrThrow();
    assert.equal(expired.status, "EXPIRED");
    assert.equal(expired.credentialPasswordHash, null);
    assert.equal(await db.verifiedIdentityFact.count(), 1);
    assert.equal(await db.authAuthenticationFact.count(), 1);
  });

  it("exchanges the existing purchase link into one pending activation and preserves both orders and profile", async () => {
    const purchase = await _purchase(2);
    const user = await db.user.findUniqueOrThrow({
      where: { id: purchase.userId },
    });
    const orders = await db.order.findMany({ orderBy: { id: "asc" } });
    const prepared = await _prepare();
    assert.equal(await db.authPendingFlow.count(), 0);
    const result = await _exchange(purchase.token, prepared.cookie);
    assert.equal(result.response.status, 201);
    assert.equal(result.state.nextStep, "activation");
    assert.equal(result.cookie.includes("artmate_access_token"), false);
    const flow = await db.authPendingFlow.findFirstOrThrow();
    assert.equal(flow.userIdSnapshot, user.id);
    assert.equal(flow.activationTokenIdSnapshot, purchase.tokenId);
    const auth = await db.authAuthenticationFact.findFirstOrThrow();
    const proof = await db.verifiedIdentityFact.findFirstOrThrow();
    const link = await db.authOrderActivationToken.findUniqueOrThrow({
      where: { id: purchase.tokenId },
    });
    assert.equal(auth.method, "ORDER_ACTIVATION");
    assert.equal(proof.method, "ORDER_ACTIVATION_LINK");
    assert.equal(proof.email, user.email);
    assert.deepEqual(link.consumedAt, auth.authenticatedAt);
    const saved = await _post(
      "/auth/flow/order-activation/password",
      _activationPassword(),
      prepared.cookie,
    );
    assert.equal(saved.response.status, 201);
    assert.equal(saved.state.nextStep, "preparing");
    assert.match(
      (await db.authPendingFlow.findFirstOrThrow()).credentialPasswordHash!,
      /^scrypt:/,
    );
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.authSession.count(), 0);
    assert.equal(await db.authEmailChallenge.count(), 0);
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.deepEqual(
      await db.order.findMany({ orderBy: { id: "asc" } }),
      orders,
    );
    assert.equal(await db.user.count(), 1);
    assert.equal(
      JSON.stringify({ proof, auth }).includes(purchase.token),
      false,
    );
  });

  it("does not consume the link until browser preparation is complete", async () => {
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    assert.equal((await _exchange(link.token, "")).response.status, 401);
    assert.equal(
      (
        await db.authOrderActivationToken.findUniqueOrThrow({
          where: { id: link.tokenId },
        })
      ).consumedAt,
      null,
    );
    assert.equal(await db.authPendingFlow.count(), 0);
    const prepared = await _prepare();
    assert.equal(
      (await _exchange(link.token, prepared.cookie)).response.status,
      201,
    );
  });

  it("prepares a fresh activation after a completed password flow without changing the earlier result", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(login.cookie, revisions, false),
      login.cookie,
    );
    assert.equal(
      (await _finishCompletion(login.cookie)).state.status,
      "COMPLETED",
    );
    const old = await _pendingRecord(login.cookie);
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const prepared = await _post("/auth/flow/prepare", {}, login.cookie);
    assert.equal(prepared.response.status, 201);
    assert.notEqual(prepared.cookie, login.cookie);
    assert.equal(
      (await _exchange(link.token, prepared.cookie)).state.nextStep,
      "activation",
    );
    assert.equal((await _pendingRecord(login.cookie)).status, old.status);
    assert.equal(await db.authCredential.count(), 1);
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.authEmailChallenge.count(), 0);
  });

  it("preserves preparation while completion is pending and recovers the original result", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const submitted = await _completionPost(
      await _consentInput(login.cookie, revisions, false),
      login.cookie,
    );
    assert.equal(submitted.state.status, "PENDING");
    assert.equal((await _pendingRecord(login.cookie)).status, "COMPLETING");
    const prepared = await _post("/auth/flow/prepare", {}, login.cookie);
    assert.equal(prepared.cookie, login.cookie);
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    assert.equal(
      (await _exchange(link.token, prepared.cookie)).response.status,
      401,
    );
    assert.equal(
      (await _finishCompletion(prepared.cookie)).state.status,
      "COMPLETED",
    );
    assert.equal(
      (
        await db.authOrderActivationToken.findUniqueOrThrow({
          where: { id: link.tokenId },
        })
      ).consumedAt,
      null,
    );
  });

  it("prepares a fresh activation after cancellation even if the cookie-clear response was lost", async () => {
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    assert.equal(
      (await _post("/auth/flow/cancel", {}, login.cookie)).response.status,
      201,
    );
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const prepared = await _post("/auth/flow/prepare", {}, login.cookie);
    assert.notEqual(prepared.cookie, login.cookie);
    assert.equal(
      (await _exchange(link.token, prepared.cookie)).state.nextStep,
      "activation",
    );
    assert.equal((await _pendingRecord(login.cookie)).status, "CANCELLED");
    assert.equal(await db.authSession.count(), 0);
  });

  it("recovers a lost exchange response with the prepared cookie and serializes duplicate exchanges", async () => {
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const prepared = await _prepare();
    const results = await Promise.all([
      _exchange(link.token, prepared.cookie),
      _exchange(link.token, prepared.cookie),
    ]);
    assert.deepEqual(
      results.map((item) => item.response.status),
      [201, 201],
    );
    assert.deepEqual(results[0]!.state, results[1]!.state);
    const rePrepared = await _post("/auth/flow/prepare", {}, prepared.cookie);
    assert.equal(rePrepared.cookie, prepared.cookie);
    const retry = await _exchange(link.token, rePrepared.cookie);
    assert.deepEqual(retry.state, results[0]!.state);
    assert.equal(await db.authPendingFlow.count(), 1);
    assert.equal(await db.authAuthenticationFact.count(), 1);
    assert.equal(await db.verifiedIdentityFact.count(), 1);
  });

  it("allows only one browser to claim an activation and rejects a modified browser binding", async () => {
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const a = await _prepare();
    const b = await _prepare();
    const results = await Promise.all([
      _exchange(link.token, a.cookie),
      _exchange(link.token, b.cookie),
    ]);
    assert.deepEqual(
      results.map((item) => item.response.status).sort(),
      [201, 400],
    );
    const own = results[0]!.response.status === 201 ? a : b;
    const forged = own.cookie.replace(
      /artmate_auth_browser=[^;]+/,
      `artmate_auth_browser=${"b".repeat(64)}`,
    );
    assert.equal((await _exchange(link.token, forged)).response.status, 401);
    assert.equal(await db.authPendingFlow.count(), 1);
  });

  it("rejects forged, wrong-purpose and expired activation links without creating facts", async () => {
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const prepared = await _prepare();
    for (const token of [
      "x".repeat(80),
      link.token + "x",
      createPasswordResetToken(link.tokenId, process.env.AUTH_JWT_SECRET!),
    ]) {
      assert.equal(
        (await _exchange(token, prepared.cookie)).response.status,
        400,
      );
    }
    await db.authOrderActivationToken.update({
      where: { id: link.tokenId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    assert.equal(
      (await _exchange(link.token, prepared.cookie)).response.status,
      400,
    );
    assert.equal(await db.verifiedIdentityFact.count(), 0);
    assert.equal(await db.authPendingFlow.count(), 0);
  });

  it("keeps activation password drafts idempotent, validates confirmation and rejects hidden profile fields", async () => {
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const prepared = await _prepare();
    await _exchange(link.token, prepared.cookie);
    const values = _activationPassword();
    assert.equal(
      (
        await _post(
          "/auth/flow/order-activation/password",
          { ...values, passwordConfirm: "different-password" },
          prepared.cookie,
        )
      ).response.status,
      400,
    );
    assert.equal(
      (
        await _post(
          "/auth/flow/order-activation/password",
          { ...values, email: "other@example.test" },
          prepared.cookie,
        )
      ).response.status,
      400,
    );
    assert.equal(
      (await db.authPendingFlow.findFirstOrThrow()).credentialPasswordHash,
      null,
    );
    const saved = await _post(
      "/auth/flow/order-activation/password",
      values,
      prepared.cookie,
    );
    assert.equal(saved.response.status, 201);
    assert.deepEqual(
      (
        await _post(
          "/auth/flow/order-activation/password",
          values,
          prepared.cookie,
        )
      ).state,
      saved.state,
    );
    assert.equal(
      (
        await _post(
          "/auth/flow/order-activation/password",
          { ...values, operationKey: crypto.randomUUID() },
          prepared.cookie,
        )
      ).response.status,
      409,
    );
    assert.equal(await db.authCredential.count(), 0);
  });

  it("asks for missing activation contacts after the password without overwriting known profile values", async () => {
    const guest = await _user("guest");
    await db.user.update({ where: { id: guest.id }, data: { phone: null } });
    const link = await _activationLink(guest.id);
    const prepared = await _prepare();
    await _exchange(link.token, prepared.cookie);
    const saved = await _post(
      "/auth/flow/order-activation/password",
      _activationPassword(),
      prepared.cookie,
    );
    assert.equal(saved.state.nextStep, "profile");
    const user = await db.user.findUniqueOrThrow({ where: { id: guest.id } });
    assert.equal(user.name, guest.name);
    assert.equal(user.phone, null);
  });

  it("cancels activation, clears the draft and allows recovery through a new link", async () => {
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const prepared = await _prepare();
    await _exchange(link.token, prepared.cookie);
    await _post(
      "/auth/flow/order-activation/password",
      _activationPassword(),
      prepared.cookie,
    );
    assert.equal(
      (await _post("/auth/flow/cancel", {}, prepared.cookie)).response.status,
      201,
    );
    assert.equal(
      (await _exchange(link.token, prepared.cookie)).response.status,
      401,
    );
    assert.equal((await _get(prepared.cookie)).response.status, 401);
    const flow = await db.authPendingFlow.findFirstOrThrow();
    assert.equal(flow.credentialPasswordHash, null);
    assert.equal(await db.verifiedIdentityFact.count(), 1);
    assert.equal(await db.authCredential.count(), 0);
    const recovery = await _post("/auth/flow/recovery/request", {
      email: guest.email,
    });
    assert.equal(recovery.response.status, 201);
    const fresh = await db.authOrderActivationToken.findFirstOrThrow({
      where: { userId: guest.id, consumedAt: null },
    });
    assert.notEqual(fresh.id, link.tokenId);
    const freshToken = createOrderActivationToken(
      fresh.id,
      process.env.AUTH_JWT_SECRET!,
    );
    const preparedAgain = await _prepare();
    assert.equal(
      (await _exchange(freshToken, preparedAgain.cookie)).state.nextStep,
      "activation",
    );
    assert.equal(await db.authPendingFlow.count(), 2);
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.user.count(), 1);
  });

  it("never replaces a credential acquired after activation exchange", async () => {
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const prepared = await _prepare();
    await _exchange(link.token, prepared.cookie);
    const account = await db.authAccount.findFirstOrThrow({
      where: { userId: guest.id },
    });
    const credential = await db.authCredential.create({
      data: {
        accountId: account.id,
        passwordHash: await PasswordHasher.create("concurrent-password"),
      },
    });
    assert.equal(
      (
        await _post(
          "/auth/flow/order-activation/password",
          _activationPassword(),
          prepared.cookie,
        )
      ).response.status,
      409,
    );
    assert.equal((await _get(prepared.cookie)).response.status, 409);
    assert.deepEqual(
      await db.authCredential.findUniqueOrThrow({
        where: { id: credential.id },
      }),
      credential,
    );
  });

  it("rejects activation of complete, provider-only, blocked and deleted accounts", async () => {
    for (const kind of ["ready", "provider", "blocked", "deleted"] as const) {
      const user = await _user(kind);
      const link = await _activationLink(user.id);
      const prepared = await _prepare();
      assert.equal(
        (await _exchange(link.token, prepared.cookie)).response.status,
        400,
      );
      assert.equal(
        (
          await db.authOrderActivationToken.findUniqueOrThrow({
            where: { id: link.tokenId },
          })
        ).consumedAt,
        null,
      );
    }
    assert.equal(await db.authPendingFlow.count(), 0);
  });

  it("bounds the continuation by link expiry and invalidates a changed user version", async () => {
    const guest = await _user("guest");
    const link = await _activationLink(guest.id, new Date(Date.now() + 30_000));
    const prepared = await _prepare();
    await _exchange(link.token, prepared.cookie);
    const flow = await db.authPendingFlow.findFirstOrThrow();
    assert.deepEqual(flow.expiresAt, link.expiresAt);
    await db.user.update({
      where: { id: guest.id },
      data: { authVersion: { increment: 1 } },
    });
    assert.equal((await _get(prepared.cookie)).response.status, 401);
    assert.equal(
      (
        await _post(
          "/auth/flow/order-activation/password",
          _activationPassword(),
          prepared.cookie,
        )
      ).response.status,
      409,
    );
  });

  it("does not replace another active authentication with an activation link", async () => {
    await _user("ready");
    const password = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    assert.equal(
      (await _exchange(link.token, password.cookie)).response.status,
      409,
    );
    assert.equal(
      (
        await db.authOrderActivationToken.findUniqueOrThrow({
          where: { id: link.tokenId },
        })
      ).consumedAt,
      null,
    );
  });

  it("uses one neutral recovery response for unknown, guest, credential, blocked and provider-only emails", async () => {
    for (const kind of ["guest", "ready", "blocked", "provider"] as const)
      await _user(kind);
    for (const kind of ["unknown", "guest", "ready", "blocked", "provider"]) {
      const result = await _post("/auth/flow/recovery/request", {
        email: `${kind}@example.test`,
      });
      assert.equal(result.response.status, 201);
      assert.deepEqual(result.state, { ok: true });
      assert.equal(result.cookie, "");
    }
    const jobs = await db.notificationJob.findMany();
    assert.deepEqual(
      jobs.map((job) => (job.payload as { kind: string }).kind).sort(),
      ["order_activation", "password_reset"],
    );
    assert.equal(await db.authSession.count(), 0);
  });

  it("serializes concurrent recovery requests without sending duplicate links", async () => {
    await _user("guest");
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        _post("/auth/flow/recovery/request", { email: "guest@example.test" }),
      ),
    );
    assert.equal(
      results.filter((item) => item.response.status === 201).length,
      1,
    );
    assert.equal(
      results.filter((item) => item.response.status === 429).length,
      4,
    );
    assert.equal(await db.notificationJob.count(), 1);
  });

  it("reuses password reset with password confirmation and revokes old sessions without signing in", async () => {
    const user = await _user("ready");
    await _post("/auth/flow/recovery/request", { email: user.email });
    const link = await db.authPasswordResetToken.findFirstOrThrow();
    const token = createPasswordResetToken(
      link.id,
      process.env.AUTH_PASSWORD_RESET_SECRET!,
    );
    const before = await db.authCredential.findFirstOrThrow();
    assert.equal(
      (
        await _post("/auth/flow/password-reset/confirm", {
          token,
          password: "new-password",
          passwordConfirm: "different-password",
        })
      ).response.status,
      400,
    );
    assert.deepEqual(await db.authCredential.findFirstOrThrow(), before);
    const result = await _post("/auth/flow/password-reset/confirm", {
      token,
      password: "new-password",
      passwordConfirm: "new-password",
    });
    assert.equal(result.response.status, 201);
    assert.deepEqual(result.state, { ok: true });
    assert.equal(result.cookie, "");
    assert.equal(
      await PasswordHasher.verify(
        "new-password",
        (await db.authCredential.findFirstOrThrow()).passwordHash,
      ),
      true,
    );
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).authVersion,
      user.authVersion + 1,
    );
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(
      (
        await _post("/auth/flow/password-reset/confirm", {
          token,
          password: "another-password",
          passwordConfirm: "another-password",
        })
      ).response.status,
      400,
    );
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "new-password",
    });
    assert.equal(login.response.status, 201);
    assert.equal(await db.authEmailChallenge.count(), 0);
    assert.equal(
      JSON.stringify(await db.notificationJob.findMany()).includes(token),
      false,
    );
  });

  it("accepts a password reset link once under concurrent confirmation and rejects activation tokens", async () => {
    const user = await _user("ready");
    await _post("/auth/flow/recovery/request", { email: user.email });
    const link = await db.authPasswordResetToken.findFirstOrThrow();
    const token = createPasswordResetToken(
      link.id,
      process.env.AUTH_PASSWORD_RESET_SECRET!,
    );
    const values = {
      token,
      password: "new-password",
      passwordConfirm: "new-password",
    };
    const results = await Promise.all([
      _post("/auth/flow/password-reset/confirm", values),
      _post("/auth/flow/password-reset/confirm", values),
    ]);
    assert.deepEqual(
      results.map((item) => item.response.status).sort(),
      [201, 400],
    );
    const wrong = createOrderActivationToken(
      createOrderActivationTokenId(),
      process.env.AUTH_PASSWORD_RESET_SECRET!,
    );
    assert.equal(
      (
        await _post("/auth/flow/password-reset/confirm", {
          ...values,
          token: wrong,
        })
      ).response.status,
      400,
    );
    assert.equal(await db.authSession.count(), 0);
  });

  it("prefills a partial profile and saves only an expiring draft without changing Users or dispatching a command", async () => {
    const user = await _user("ready");
    const current = await db.user.update({
      where: { id: user.id },
      data: { phone: null },
    });
    const result = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    assert.equal(result.state.nextStep, "profile");
    if (
      result.state.status !== "PENDING" ||
      result.state.nextStep !== "profile"
    )
      assert.fail("Expected contact step");
    assert.equal(result.state.name, "Existing name");
    assert.equal(result.state.phone, null);
    assert.deepEqual(result.state.missingFields, ["phone"]);
    assert.equal(result.state.profileRevision, 2);
    const saved = await _post(
      "/auth/flow/profile",
      { name: "Forged replacement", phone: "+7 (999) 123-45-67" },
      result.cookie,
    );
    assert.equal(saved.response.status, 201);
    assert.equal(saved.state.nextStep, "preparing");
    const flow = await db.authPendingFlow.findFirstOrThrow();
    assert.equal(flow.draftName, "Existing name");
    assert.equal(flow.draftPhone, "+79991234567");
    assert.equal(flow.profileRevision, 2);
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      current,
    );
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
    assert.equal(await db.authSession.count(), 0);
    assert.deepEqual(
      (
        await _post(
          "/auth/flow/profile",
          { name: "Forged replacement", phone: "+79991234567" },
          result.cookie,
        )
      ).state,
      saved.state,
    );
  });

  it("checks actual contact validity and accepts a single name without a three-word requirement", async () => {
    const user = await _user("ready");
    await db.user.update({
      where: { id: user.id },
      data: { name: "  ", phone: "123" },
    });
    const result = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    if (
      result.state.status !== "PENDING" ||
      result.state.nextStep !== "profile"
    )
      assert.fail("Expected contact step");
    assert.deepEqual(result.state.missingFields, ["name", "phone"]);
    assert.equal(
      (
        await _post(
          "/auth/flow/profile",
          { name: "Анна", phone: "+7 999 123-45-67" },
          result.cookie,
        )
      ).state.nextStep,
      "preparing",
    );
    const draft = await db.authPendingFlow.findFirstOrThrow();
    assert.equal(draft.draftName, "Анна");
    assert.equal(draft.draftPhone, "+79991234567");
    assert.deepEqual(
      CustomerProfileValues.select(null, {
        name: "Анна",
        phone: "+79991234567",
      }).missingFields,
      [],
    );
  });

  it("rejects invalid profile values, recipient overrides and contact submission before activation password", async () => {
    const user = await _user("ready");
    await db.user.update({
      where: { id: user.id },
      data: { name: null, phone: null },
    });
    const result = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    for (const body of [
      { name: " ", phone: "+79991234567" },
      { name: "Анна", phone: "call +79991234567" },
      { name: "Анна", phone: "123456789" },
      { name: "Анна", phone: "+79991234567", userId: user.id },
      { name: "Анна", phone: "+79991234567", email: "other@example.test" },
    ])
      assert.equal(
        (await _post("/auth/flow/profile", body, result.cookie)).response
          .status,
        400,
      );
    assert.equal((await db.authPendingFlow.findFirstOrThrow()).draftName, null);
    const guest = await _user("guest");
    const link = await _activationLink(guest.id);
    const prepared = await _prepare();
    await _exchange(link.token, prepared.cookie);
    assert.equal(
      (
        await _post(
          "/auth/flow/profile",
          { name: "Анна", phone: "+79991234567" },
          prepared.cookie,
        )
      ).response.status,
      409,
    );
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
  });

  it("does not regard an unavailable Users projection as ready", async () => {
    const user = await _user("ready");
    await db.customerProfileState.delete({ where: { userId: user.id } });
    const result = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    assert.equal(result.response.status, 503);
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.authAuthenticationFact.count(), 0);
  });

  it("publishes profile revisions atomically for changes made by existing Users paths", async () => {
    const user = await _user("ready");
    assert.equal(
      (
        await db.customerProfileState.findUniqueOrThrow({
          where: { userId: user.id },
        })
      ).revision,
      1,
    );
    await db.user.update({ where: { id: user.id }, data: { name: user.name } });
    assert.equal(
      (
        await db.customerProfileState.findUniqueOrThrow({
          where: { userId: user.id },
        })
      ).revision,
      1,
    );
    await db.user.update({
      where: { id: user.id },
      data: { name: "Анна", phone: "+7 (999) 123-45-67" },
    });
    const state = await db.customerProfileState.findUniqueOrThrow({
      where: { userId: user.id },
    });
    assert.equal(state.revision, 2);
    assert.equal(state.name, "Анна");
    const result = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    assert.equal(result.state.nextStep, "preparing");
    await assert.rejects(
      db.$executeRaw`UPDATE customer_auth_directory_v1 SET name = 'forged' WHERE user_id = ${user.id}`,
    );
  });

  it("cancels and expires contact drafts without changing Users or losing their previous values", async () => {
    const user = await _user("ready");
    const before = await db.user.update({
      where: { id: user.id },
      data: { phone: null },
    });
    const result = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    await _post(
      "/auth/flow/profile",
      { name: before.name, phone: "+79991234567" },
      result.cookie,
    );
    await _post("/auth/flow/cancel", {}, result.cookie);
    assert.equal(
      (await db.authPendingFlow.findFirstOrThrow()).draftPhone,
      null,
    );
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      before,
    );
    const again = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    await _post(
      "/auth/flow/profile",
      { name: before.name, phone: "+79991234567" },
      again.cookie,
    );
    const flow = await db.authPendingFlow.findFirstOrThrow({
      where: { status: "OPEN" },
    });
    const { mock } = await import("node:test");
    mock.timers.enable({ apis: ["Date"], now: flow.expiresAt.getTime() + 1 });
    try {
      await new PendingCleanupService(db as never).expire();
    } finally {
      mock.timers.reset();
    }
    assert.equal(
      (await db.authPendingFlow.findUniqueOrThrow({ where: { id: flow.id } }))
        .draftPhone,
      null,
    );
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      before,
    );
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
  });

  it("lets Users fill only missing fields and returns a durable profile receipt", async () => {
    const user = await _user("ready");
    const before = await db.user.update({
      where: { id: user.id },
      data: { phone: null },
    });
    await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const flow = await db.authPendingFlow.findFirstOrThrow();
    const command = await _profileCommand(flow.id, {
      name: "Untrusted replacement",
      phone: "+7 (999) 123-45-67",
    });
    assert.equal(await _profileHandler().process(command.id), true);
    const receipt = await db.ensureCustomerProfileCommand.findUniqueOrThrow({
      where: { id: command.id },
    });
    assert.equal(receipt.status, "COMPLETED");
    assert.equal(receipt.resultUserId, user.id);
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(after.name, before.name);
    assert.equal(after.phone, "+79991234567");
    assert.deepEqual(after.emailVerifiedAt, before.emailVerifiedAt);
    const publication = await db.customerProfileState.findUniqueOrThrow({
      where: { userId: user.id },
    });
    assert.equal(publication.revision, receipt.resultProfileRevision);
    assert.equal(publication.phone, after.phone);
    assert.equal(await db.authSession.count(), 0);
  });

  it("creates a new profile only in Users, with its original email proof and no active credential", async () => {
    const requested = await _request("new-profile@example.test");
    await _confirm(requested);
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    const flow = await db.authPendingFlow.findFirstOrThrow();
    const proof = await db.verifiedIdentityFact.findUniqueOrThrow({
      where: { id: flow.identityFactId },
    });
    const command = await _profileCommand(flow.id, {
      name: " Анна ",
      phone: "+7 (999) 123-45-67",
    });
    await _profileHandler().process(command.id);
    const receipt = await db.ensureCustomerProfileCommand.findUniqueOrThrow({
      where: { id: command.id },
    });
    const user = await db.user.findUniqueOrThrow({
      where: { id: receipt.resultUserId! },
    });
    assert.equal(user.email, proof.email);
    assert.deepEqual(user.emailVerifiedAt, proof.verifiedAt);
    assert.equal(user.name, "Анна");
    assert.equal(user.phone, "+79991234567");
    assert.deepEqual(user.roles, ["CUSTOMER"]);
    assert.equal(receipt.resultProfileRevision, 1);
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.authAccount.count(), 0);
    assert.equal(await db.authSession.count(), 0);
  });

  it("preserves valid existing contacts and both orders when processing a guest activation profile", async () => {
    const purchase = await _purchase(2);
    const before = await db.user.findUniqueOrThrow({
      where: { id: purchase.userId },
    });
    const orders = await db.order.findMany({ orderBy: { id: "asc" } });
    const prepared = await _prepare();
    await _exchange(purchase.token, prepared.cookie);
    await _post(
      "/auth/flow/order-activation/password",
      _activationPassword(),
      prepared.cookie,
    );
    const flow = await db.authPendingFlow.findFirstOrThrow();
    const command = await _profileCommand(flow.id, {
      name: "Other name",
      phone: "+70000000000",
    });
    await _profileHandler().process(command.id);
    const user = await db.user.findUniqueOrThrow({
      where: { id: purchase.userId },
    });
    assert.equal(user.name, before.name);
    assert.equal(user.phone, before.phone);
    assert.equal(await db.user.count(), 1);
    assert.deepEqual(
      await db.order.findMany({ orderBy: { id: "asc" } }),
      orders,
    );
    assert.equal(
      (
        await db.ensureCustomerProfileCommand.findUniqueOrThrow({
          where: { id: command.id },
        })
      ).status,
      "COMPLETED",
    );
  });

  it("claims a Users command once across two workers and recovers a lost result without changing its receipt", async () => {
    await _user("ready");
    await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    const flow = await db.authPendingFlow.findFirstOrThrow();
    const command = await _profileCommand(flow.id, {
      name: "Other",
      phone: "+70000000000",
    });
    const results = await Promise.all([
      _profileHandler().process(command.id),
      _profileHandler().process(command.id),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
    const before = await db.ensureCustomerProfileCommand.findUniqueOrThrow({
      where: { id: command.id },
    });
    assert.equal(await _profileHandler().process(command.id), false);
    assert.deepEqual(
      await db.ensureCustomerProfileCommand.findUniqueOrThrow({
        where: { id: command.id },
      }),
      before,
    );
    assert.equal(
      (await db.customerProfileState.findFirstOrThrow()).revision,
      1,
    );
  });

  it("rejects stale profile revisions, inactive users and changed Auth provenance without overwriting Users", async () => {
    const user = await _user("ready");
    await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const flow = await db.authPendingFlow.findFirstOrThrow();
    const command = await _profileCommand(flow.id, {
      name: "Other",
      phone: "+70000000000",
    });
    const current = await db.user.update({
      where: { id: user.id },
      data: { name: "Fresh name" },
    });
    await _profileHandler().process(command.id);
    assert.equal(
      (
        await db.ensureCustomerProfileCommand.findUniqueOrThrow({
          where: { id: command.id },
        })
      ).errorCode,
      "PROFILE_CHANGED",
    );
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      current,
    );
    // A fresh operation with a blocked user is rejected independently of revision.
    const next = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    assert.equal(next.response.status, 201);
    const nextFlow = await db.authPendingFlow.findFirstOrThrow({
      where: { id: { not: flow.id } },
    });
    const blocked = await _profileCommand(nextFlow.id, {
      name: "Other",
      phone: "+70000000000",
    });
    await db.user.update({
      where: { id: user.id },
      data: { status: "BLOCKED", authVersion: { increment: 1 } },
    });
    await _profileHandler().process(blocked.id);
    assert.equal(
      (
        await db.ensureCustomerProfileCommand.findUniqueOrThrow({
          where: { id: blocked.id },
        })
      ).errorCode,
      "ACCOUNT_UNAVAILABLE",
    );
  });

  it("rejects forged recipients, invalid command values and changed payload hashes", async () => {
    const user = await _user("ready");
    for (const variant of ["actor", "values", "hash"] as const) {
      await _post("/auth/flow/password", {
        email: user.email,
        password: "existing-password",
      });
      const flow = await db.authPendingFlow.findFirstOrThrow({
        where: { status: "OPEN" },
      });
      const command = await _profileCommand(
        flow.id,
        {
          name: "Other",
          phone: variant === "values" ? "not a phone" : "+70000000000",
        },
        {
          ...(variant === "actor"
            ? { expectedUserId: "another-user", expectedProfileRevision: 1 }
            : {}),
          ...(variant === "hash" ? { payloadHash: "0".repeat(64) } : {}),
        },
      );
      await _profileHandler().process(command.id);
      assert.equal(
        (
          await db.ensureCustomerProfileCommand.findUniqueOrThrow({
            where: { id: command.id },
          })
        ).errorCode,
        variant === "actor"
          ? "INVALID_OPERATION"
          : variant === "values"
            ? "INVALID_PROFILE"
            : "INVALID_PAYLOAD",
      );
    }
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
  });

  it("rolls back Users when receipt persistence fails, then retries the same command", async () => {
    const requested = await _request("rollback-profile@example.test");
    await _confirm(requested);
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    const flow = await db.authPendingFlow.findFirstOrThrow();
    const command = await _profileCommand(flow.id, {
      name: "Анна",
      phone: "+79991234567",
    });
    await db.$executeRawUnsafe(
      `CREATE FUNCTION _test_profile_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'completed' THEN RAISE EXCEPTION 'test receipt failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER test_profile_receipt_failure BEFORE UPDATE ON ensure_customer_profile_commands FOR EACH ROW EXECUTE FUNCTION _test_profile_receipt_failure()`,
    );
    try {
      await new CustomerProfileCommandWorker(
        db as never,
        _profileHandler(),
      ).processAvailable();
      assert.equal(await db.user.count(), 0);
      assert.equal(await db.customerProfileState.count(), 0);
      const pending = await db.ensureCustomerProfileCommand.findUniqueOrThrow({
        where: { id: command.id },
      });
      assert.equal(pending.status, "PENDING");
      assert.equal(pending.attempts, 1);
    } finally {
      await db.$executeRawUnsafe(
        "DROP TRIGGER test_profile_receipt_failure ON ensure_customer_profile_commands",
      );
      await db.$executeRawUnsafe(
        "DROP FUNCTION _test_profile_receipt_failure()",
      );
    }
    await db.ensureCustomerProfileCommand.update({
      where: { id: command.id },
      data: { availableAt: new Date(Date.now() - 1) },
    });
    await _profileHandler().process(command.id);
    assert.equal(await db.user.count(), 1);
    assert.equal(
      (
        await db.ensureCustomerProfileCommand.findUniqueOrThrow({
          where: { id: command.id },
        })
      ).status,
      "COMPLETED",
    );
  });

  it("serializes concurrent new-profile commands for the same email without creating a second User", async () => {
    const requested = await _request("profile-race@example.test");
    await _confirm(requested);
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    const first = await db.authPendingFlow.findFirstOrThrow();
    const proof = await db.verifiedIdentityFact.findUniqueOrThrow({
      where: { id: first.identityFactId },
    });
    const second = await db.$transaction((tx) =>
      app.get(AuthFlowStore).create(tx, {
        credentials: FlowCredentials.create(),
        user: null,
        identityFactId: proof.id,
        method: "EMAIL_REGISTRATION",
        accountId: null,
        credentialUpdatedAt: null,
        context: proof.requestContext as unknown as RequestEvidenceV1,
      }),
    );
    await db.authPendingFlow.update({
      where: { id: second.id },
      data: {
        draftName: first.draftName,
        draftPhone: first.draftPhone,
        credentialPasswordHash: first.credentialPasswordHash,
        credentialExpiresAt: second.expiresAt,
        credentialOperationKey: crypto.randomUUID(),
      },
    });
    const a = await _profileCommand(first.id, {
      name: "Анна",
      phone: "+79991234567",
    });
    const b = await _profileCommand(second.id, {
      name: "Анна",
      phone: "+79991234567",
    });
    await Promise.all([
      _profileHandler().process(a.id),
      _profileHandler().process(b.id),
    ]);
    const receipts = await db.ensureCustomerProfileCommand.findMany();
    assert.deepEqual(receipts.map((item) => item.status).sort(), [
      "COMPLETED",
      "REJECTED",
    ]);
    assert.equal(
      receipts.find((item) => item.status === "REJECTED")!.errorCode,
      "ACCOUNT_CHANGED",
    );
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.customerProfileState.count(), 1);
    assert.equal(await db.authCredential.count(), 0);
  });

  it("shows current consent revisions only after password authentication without creating an operation or session", async () => {
    await _legalRevisions();
    const user = await _user("ready");
    const credential = await db.authCredential.findFirstOrThrow();
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const readiness = await _completionRead(login.cookie);
    assert.equal(readiness.response.status, 200);
    assert.equal(readiness.state.status, "PENDING");
    assert.equal(readiness.state.nextStep, "consents");
    assert.equal(readiness.cookie.includes("artmate_access_token="), false);
    assert.equal(await db.authCompletionOperation.count(), 0);
    assert.equal(await db.applyConsentDecisionCommand.count(), 0);
    assert.equal(await db.requiredConsentAcceptance.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    assert.equal(await db.authEmailChallenge.count(), 0);
    assert.equal(await db.notificationJob.count(), 0);
    assert.deepEqual(await db.authCredential.findFirstOrThrow(), credential);
  });

  it("validates actual consent booleans and refuses mandatory consent refusal before queuing commands", async () => {
    const revisions = await _legalRevisions();
    await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    const input = await _consentInput(login.cookie, revisions, false);
    for (const invalid of ["true", "false", 1, 0, null]) {
      const response = await _completionPost(
        {
          ...input,
          decisions: [
            { revisionId: revisions.personal.id, accepted: invalid },
            input.decisions[1],
          ],
        },
        login.cookie,
      );
      assert.equal(response.response.status, 400);
      assert.equal(response.cookie.includes("artmate_access_token="), false);
    }
    const refused = await _completionPost(
      {
        ...input,
        decisions: input.decisions.map((decision) => ({
          ...decision,
          accepted: false,
        })),
      },
      login.cookie,
    );
    assert.ok([400, 409].includes(refused.response.status));
    assert.equal(await db.authCompletionOperation.count(), 0);
    assert.equal(await db.applyConsentDecisionCommand.count(), 0);
    assert.equal(await db.requiredConsentAcceptance.count(), 0);
  });

  it("keeps advertising refusal as a no-op and asks about advertising on the next explicit login", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const input = {
      ...(await _consentInput(login.cookie, revisions, false)),
      advertisingDevice: { timeZone: "Europe/Moscow", utcOffsetMinutes: 180 },
    };
    const submitted = await _completionPost(input, login.cookie);
    assert.equal(submitted.response.status, 201);
    assert.equal(submitted.state.status, "PENDING");
    assert.equal(submitted.cookie.includes("artmate_access_token="), false);
    const completed = await _finishCompletion(login.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    assert.equal(completed.state.user?.id, user.id);
    await _assertSession(completed.cookie, user.id);
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    assert.equal(
      (await db.applyConsentDecisionCommand.findFirstOrThrow()).advertisingDevice,
      null,
    );
    const acceptance = await db.requiredConsentAcceptance.findFirstOrThrow();
    assert.equal(acceptance.email, user.email);
    assert.equal(acceptance.revisionId, revisions.personal.id);
    assert.equal(acceptance.actorUserIdSnapshot, user.id);
    assert.equal(await db.notificationJob.count(), 0);
    const next = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const readiness = await _completionRead(next.cookie);
    assert.equal(readiness.state.status, "PENDING");
    assert.equal(readiness.state.nextStep, "consents");
    assert.equal(await db.authCompletionOperation.count(), 1);
  });

  it("persists a true advertising decision with its exact proof, revision, source and sanitized full request context", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const input = {
      ...(await _consentInput(login.cookie, revisions, true)),
      source: "checkout:gift",
    };
    const submitted = await _completionPost(
      input,
      login.cookie,
      {
        "user-agent": "Artmate integration test " + "long-agent/".repeat(200),
        "x-real-ip": "203.0.113.99",
        "x-request-id": "stage5-request-context",
        "x-test-context": "kept as supplied",
        authorization: "Bearer private-credential",
      },
      "?campaign=autumn&campaign=gift&token=private-query-token",
    );
    assert.equal(submitted.state.status, "PENDING");
    const completed = await _finishCompletion(login.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    const event = await db.emailAdvertisingConsentEvent.findFirstOrThrow();
    const subscription =
      await db.emailAdvertisingSubscription.findFirstOrThrow();
    const operation = await db.authCompletionOperation.findFirstOrThrow();
    const proof = await db.verifiedIdentityFact.findFirstOrThrow();
    assert.equal(event.action, "GRANTED");
    assert.equal(event.email, user.email);
    assert.equal(event.actorUserIdSnapshot, user.id);
    assert.equal(event.authOperationId, operation.id);
    assert.equal(event.identityFactId, proof.id);
    assert.equal(event.revisionId, revisions.advertising.id);
    assert.equal(event.source, "checkout:gift");
    assert.equal(event.clientIpAddress, null);
    assert.equal(event.clientTimeZone, null);
    assert.equal(subscription.state, "ACTIVE");
    assert.equal(subscription.version, 1);
    assert.equal(subscription.activeGrantId, event.id);
    const context = event.requestContext as unknown as RequestEvidenceV1;
    assert.equal(context.version, 1);
    assert.equal(context.source, "direct_request");
    assert.equal(context.http.method, "POST");
    assert.equal(context.http.version, "1.1");
    assert.deepEqual(context.query.campaign, ["autumn", "gift"]);
    assert.deepEqual(context.headers["x-test-context"], ["kept as supplied"]);
    assert.equal(context.headers["user-agent"]![0]!.length > 2000, true);
    assert.equal(context.connection.remoteAddress, "127.0.0.1");
    assert.ok(context.connection.remotePort);
    const persisted = JSON.stringify(context);
    for (const secret of [
      "private-credential",
      "private-query-token",
      _credentials(login.cookie).pending,
      "existing-password",
    ]) {
      assert.equal(persisted.includes(secret), false);
    }
    const acceptance = await db.requiredConsentAcceptance.findFirstOrThrow();
    assert.deepEqual(acceptance.requestContext, event.requestContext);
    assert.equal(acceptance.requestId, event.requestId);
    assert.equal(await db.notificationJob.count(), 0);
  });

  it("waits for both domain receipts before activating a registration password, and recovers a lost completion response", async () => {
    const revisions = await _legalRevisions();
    const requested = await _request("complete-signup@example.test");
    await _confirm(requested);
    const draft = _draft();
    await _post("/auth/flow/registration", draft, requested.cookie);
    const advertisingDevice = {
      timeZone: "Europe/Moscow",
      utcOffsetMinutes: 180,
      platformVersion: "15.0.0",
      browserVersions: [{ brand: "Google Chrome", version: "131.0.6778.85" }],
    };
    const input = {
      ...(await _consentInput(requested.cookie, revisions, true)),
      advertisingDevice,
    };
    assert.equal(input.operationKey, draft.operationKey);
    const capturedAt = new Date().toISOString();
    const ipAddress = "203.0.113.44";
    const client = {
      ipAddress,
      forwardedFor: [ipAddress],
      forwardedHeadersTrusted: true,
    };
    const context = {
      version: 1,
      capturedAt,
      source: "next_server_action",
      headers: {
        "user-agent": [
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        ],
      },
      client,
      http: { method: null, url: null, version: null },
      connection: null,
    };
    const envelope = Buffer.from(
      JSON.stringify({
        issuedAt: Date.now(),
        method: "POST",
        path: "/auth/flow/complete",
        bodySha256: crypto
          .createHash("sha256")
          .update(JSON.stringify(input))
          .digest("hex"),
        context,
      }),
    ).toString("base64url");
    const submitted = await _completionPost(input, requested.cookie, {
      "x-artmate-auth-context": envelope,
      "x-artmate-auth-signature": crypto
        .createHmac("sha256", process.env.AUTH_FLOW_PROXY_SECRET!)
        .update(envelope)
        .digest("hex"),
    });
    assert.equal(submitted.state.status, "PENDING", JSON.stringify(submitted.state));
    assert.equal(await db.user.count(), 0);
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.authAccount.count(), 0);
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
    const consent = await db.applyConsentDecisionCommand.findFirstOrThrow();
    await _consentHandler().process(consent.id);
    assert.equal(await db.authCredential.count(), 0);
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    const profile = await db.ensureCustomerProfileCommand.findFirstOrThrow();
    assert.equal(profile.status, "PENDING");
    assert.equal(await db.user.count(), 0);
    await _profileHandler().process(profile.id);
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.authCredential.count(), 0);
    const beforeFinal = await _completionRead(requested.cookie);
    assert.equal(beforeFinal.state.status, "COMPLETED");
    assert.equal(beforeFinal.state.user?.email, "complete-signup@example.test");
    assert.equal(await db.authCredential.count(), 1);
    assert.equal(await db.authAccount.count(), 1);
    const credential = await db.authCredential.findFirstOrThrow();
    assert.equal(
      await PasswordHasher.verify("new-password", credential.passwordHash),
      true,
    );
    const replay = await _completionPost(input, requested.cookie);
    assert.equal(replay.state.status, "COMPLETED");
    await _assertSession(replay.cookie, beforeFinal.state.user!.id);
    assert.equal(await db.authCompletionOperation.count(), 1);
    assert.equal(await db.applyConsentDecisionCommand.count(), 1);
    assert.equal(await db.ensureCustomerProfileCommand.count(), 1);
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
    const event = await db.emailAdvertisingConsentEvent.findFirstOrThrow();
    const evidence = event.requestContext as unknown as RequestEvidenceV1;
    assert.equal(event.action, "GRANTED");
    assert.equal(event.email, beforeFinal.state.user?.email);
    assert.equal(event.authOperationId, submitted.state.operationId);
    assert.equal(event.identityFactId, consent.identityFactId);
    assert.equal(event.revisionId, revisions.advertising.id);
    assert.equal(evidence.upstream?.capturedAt, capturedAt);
    assert.ok(event.occurredAt.getTime() >= Date.parse(evidence.capturedAt));
    assert.equal(event.clientIpAddress, ipAddress);
    assert.equal(event.clientTimeZone, advertisingDevice.timeZone);
    assert.equal(
      event.clientUtcOffsetMinutes,
      advertisingDevice.utcOffsetMinutes,
    );
    assert.equal(event.browserName, "Chrome");
    assert.equal(event.browserVersion, "131.0.6778.85");
    assert.equal(event.osName, "Windows");
    assert.equal(event.osVersion, "11+");
    const acceptance = await db.requiredConsentAcceptance.findFirstOrThrow();
    assert.equal(
      JSON.stringify(acceptance.requestContext).includes("Europe/Moscow"),
      false,
    );
    assert.deepEqual(await db.authCredential.findFirstOrThrow(), credential);
    const flow = await _pendingRecord(requested.cookie);
    assert.equal(flow.status, "COMPLETED");
    assert.equal(flow.credentialPasswordHash, null);
    assert.equal(flow.draftName, null);
    assert.equal(flow.draftPhone, null);
  });

  it("rejects a changed completion payload and a foreign browser without replacing the accepted operation", async () => {
    const revisions = await _legalRevisions();
    await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    const input = await _consentInput(login.cookie, revisions, true);
    const submitted = await _completionPost(input, login.cookie);
    assert.equal(submitted.state.status, "PENDING");
    const before = await db.applyConsentDecisionCommand.findFirstOrThrow();
    const changed = await _completionPost(
      { ...input, source: "different-form" },
      login.cookie,
    );
    assert.equal(changed.response.status, 409);
    const credentials = _credentials(login.cookie);
    const foreignCookie = `artmate_auth_pending=${encodeURIComponent(credentials.pending)}; artmate_auth_browser=${crypto.randomBytes(32).toString("hex")}`;
    assert.equal((await _completionRead(foreignCookie)).response.status, 401);
    assert.equal(
      (await _completionPost(input, foreignCookie)).response.status,
      401,
    );
    assert.equal(await db.authCompletionOperation.count(), 1);
    assert.deepEqual(
      await db.applyConsentDecisionCommand.findFirstOrThrow(),
      before,
    );
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
  });

  it("completes a guest purchase activation on the original User and preserves its orders", async () => {
    const revisions = await _legalRevisions();
    const purchase = await _purchase(2);
    const orders = await db.order.findMany({ orderBy: { id: "asc" } });
    const prepared = await _prepare();
    await _exchange(purchase.token, prepared.cookie);
    const password = _activationPassword();
    await _post(
      "/auth/flow/order-activation/password",
      password,
      prepared.cookie,
    );
    const submitted = await _completionPost(
      await _consentInput(prepared.cookie, revisions, false),
      prepared.cookie,
    );
    assert.equal(submitted.state.status, "PENDING");
    assert.equal(await db.authCredential.count(), 0);
    const completed = await _finishCompletion(prepared.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    assert.equal(completed.state.user?.id, purchase.userId);
    await _assertSession(completed.cookie, purchase.userId);
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.authCredential.count(), 1);
    assert.deepEqual(
      await db.order.findMany({ orderBy: { id: "asc" } }),
      orders,
    );
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    assert.ok(
      (await db.user.findUniqueOrThrow({ where: { id: purchase.userId } }))
        .emailVerifiedAt,
    );
  });

  it("rejects a retired form revision before it can become consent evidence", async () => {
    const revisions = await _legalRevisions();
    await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    const input = await _consentInput(login.cookie, revisions, true);
    await db.consentRevision.update({
      where: { id: revisions.advertising.id },
      data: { retiredAt: new Date() },
    });
    const result = await _completionPost(input, login.cookie);
    if (result.state.status === "PENDING") {
      await _consentHandler().process(
        (await db.applyConsentDecisionCommand.findFirstOrThrow()).id,
      );
      await app.get(AuthCompletionService).process(result.state.operationId!);
      assert.equal(
        (await _completionRead(login.cookie)).state.status,
        "REJECTED",
      );
    } else {
      assert.ok(
        result.response.status >= 400 || result.state.status === "REJECTED",
      );
    }
    assert.equal(await db.requiredConsentAcceptance.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
    assert.equal(result.cookie.includes("artmate_access_token="), false);
  });

  it("cancels an in-flight completion before final credentials and session issuance", async () => {
    const revisions = await _legalRevisions();
    const requested = await _request("cancel-completion@example.test");
    await _confirm(requested);
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    const submitted = await _completionPost(
      await _consentInput(requested.cookie, revisions, true),
      requested.cookie,
    );
    const consent = await db.applyConsentDecisionCommand.findFirstOrThrow();
    await _consentHandler().process(consent.id);
    const cancelled = await _post("/auth/flow/cancel", {}, requested.cookie);
    assert.equal(cancelled.response.status, 201);
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    const flow = await _pendingRecord(requested.cookie);
    assert.equal(flow.status, "CANCELLED");
    assert.equal(flow.credentialPasswordHash, null);
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
    const recovery = await _completionRead(requested.cookie);
    assert.equal(recovery.response.status, 200);
    assert.equal(recovery.state.status, "REJECTED");
    assert.equal(recovery.state.errorCode, "CANCELLED");
    assert.equal(recovery.cookie.includes("artmate_access_token="), false);
  });

  it("rejects completion after expiry without activating a password draft", async () => {
    const revisions = await _legalRevisions();
    const requested = await _request("expire-completion@example.test");
    await _confirm(requested);
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    const submitted = await _completionPost(
      await _consentInput(requested.cookie, revisions, false),
      requested.cookie,
    );
    const flow = await _pendingRecord(requested.cookie);
    const { mock } = await import("node:test");
    mock.timers.enable({ apis: ["Date"], now: flow.expiresAt.getTime() + 1 });
    try {
      await app
        .get(AuthCompletionService)
        .process(submitted.state.operationId!);
      assert.equal(
        (await _completionRead(requested.cookie)).response.status,
        401,
      );
    } finally {
      mock.timers.reset();
    }
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
  });

  it("refuses a changed profile revision after the consent receipt without issuing an access token", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const submitted = await _completionPost(
      await _consentInput(login.cookie, revisions, true),
      login.cookie,
    );
    await _consentHandler().process(
      (await db.applyConsentDecisionCommand.findFirstOrThrow()).id,
    );
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    const profile = await db.ensureCustomerProfileCommand.findFirstOrThrow();
    const updated = await db.user.update({
      where: { id: user.id },
      data: { name: "Changed in account settings" },
    });
    await _profileHandler().process(profile.id);
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    const result = await _completionRead(login.cookie);
    assert.equal(result.state.status, "REJECTED");
    assert.equal(result.cookie.includes("artmate_access_token="), false);
    assert.equal(
      (
        await db.ensureCustomerProfileCommand.findUniqueOrThrow({
          where: { id: profile.id },
        })
      ).errorCode,
      "PROFILE_CHANGED",
    );
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      updated,
    );
  });

  it("automatically completes a later password login when current required consent and advertising permission already exist", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(login.cookie, revisions, true),
      login.cookie,
    );
    await _finishCompletion(login.cookie);
    const next = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const ready = await _completionRead(next.cookie);
    assert.equal(ready.state.status, "PENDING");
    assert.equal(ready.state.nextStep, "completion");
    const command = await db.applyConsentDecisionCommand.findFirstOrThrow({
      where: { operationId: ready.state.operationId! },
    });
    assert.deepEqual(command.decisions, []);
    const completed = await _finishCompletion(next.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    await _assertSession(completed.cookie, user.id);
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
    assert.equal(await db.authCredential.count(), 1);
    assert.equal(await db.authEmailChallenge.count(), 0);
    assert.equal(await db.notificationJob.count(), 0);
  });

  it("rechecks a revocation committed after the consent receipt before creating a session", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const first = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(first.cookie, revisions, true),
      first.cookie,
    );
    await _finishCompletion(first.cookie);
    const next = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const ready = await _completionRead(next.cookie);
    const command = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { operationId: ready.state.operationId! },
    });
    await _consentHandler().process(command.id);
    const subscription =
      await db.emailAdvertisingSubscription.findFirstOrThrow();
    const originalGrant =
      await db.emailAdvertisingConsentEvent.findUniqueOrThrow({
        where: { id: subscription.activeGrantId! },
      });
    await db.$transaction(async (tx) => {
      const event = await tx.emailAdvertisingConsentEvent.create({
        data: {
          subscriptionId: subscription.id,
          version: subscription.version + 1,
          operationKey: crypto.randomUUID(),
          payloadHash: crypto
            .createHash("sha256")
            .update("fixture unsubscribe")
            .digest("hex"),
          action: "REVOKED",
          email: user.email!,
          source: "fixture:notification-settings",
          requestId: crypto.randomUUID(),
          requestContext: originalGrant.requestContext as never,
        },
      });
      await tx.emailAdvertisingSubscription.update({
        where: { id: subscription.id },
        data: { state: "REVOKED", version: event.version, activeGrantId: null },
      });
    });
    await app.get(AuthCompletionService).process(ready.state.operationId!);
    const result = await _completionRead(next.cookie);
    assert.equal(result.state.status, "REJECTED");
    assert.equal(result.cookie.includes("artmate_access_token="), false);
    assert.equal(await db.ensureCustomerProfileCommand.count(), 1);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 2);
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "REVOKED",
    );
  });

  it("keeps an existing advertising grant active when a later explicit decision is false", async () => {
    const revisions = await _legalRevisions();
    await _user("ready");
    const first = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(first.cookie, revisions, true),
      first.cookie,
    );
    await _finishCompletion(first.cookie);
    const before = await db.emailAdvertisingSubscription.findFirstOrThrow();
    const next = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(next.cookie, revisions, false),
      next.cookie,
    );
    const completed = await _finishCompletion(next.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    assert.deepEqual(
      await db.emailAdvertisingSubscription.findFirstOrThrow(),
      before,
    );
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
  });

  it("rechecks account status after Users receipt and rejects a blocked registration without installing its password", async () => {
    const revisions = await _legalRevisions();
    const requested = await _request("blocked-completion@example.test");
    await _confirm(requested);
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    const submitted = await _completionPost(
      await _consentInput(requested.cookie, revisions, false),
      requested.cookie,
    );
    await _consentHandler().process(
      (await db.applyConsentDecisionCommand.findFirstOrThrow()).id,
    );
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    const profile = await db.ensureCustomerProfileCommand.findFirstOrThrow();
    await _profileHandler().process(profile.id);
    const receipt = await db.ensureCustomerProfileCommand.findUniqueOrThrow({
      where: { id: profile.id },
    });
    await db.user.update({
      where: { id: receipt.resultUserId! },
      data: { status: "BLOCKED", authVersion: { increment: 1 } },
    });
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    const result = await _completionRead(requested.cookie);
    assert.equal(result.state.status, "REJECTED");
    assert.equal(result.cookie.includes("artmate_access_token="), false);
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.authAccount.count(), 0);
  });

  it("serializes concurrent final recovery requests into one installed password and one terminal operation", async () => {
    const revisions = await _legalRevisions();
    const requested = await _request("concurrent-completion@example.test");
    await _confirm(requested);
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    const submitted = await _completionPost(
      await _consentInput(requested.cookie, revisions, true),
      requested.cookie,
    );
    await _consentHandler().process(
      (await db.applyConsentDecisionCommand.findFirstOrThrow()).id,
    );
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    await _profileHandler().process(
      (await db.ensureCustomerProfileCommand.findFirstOrThrow()).id,
    );
    const results = await Promise.all([
      _completionRead(requested.cookie),
      _completionRead(requested.cookie),
    ]);
    for (const result of results) {
      assert.equal(result.response.status, 200);
      assert.equal(result.state.status, "COMPLETED");
      await _assertSession(result.cookie, result.state.user!.id);
    }
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.authCredential.count(), 1);
    assert.equal(await db.authAccount.count(), 1);
    assert.equal(
      await db.authCompletionOperation.count({
        where: { status: "COMPLETED" },
      }),
      1,
    );
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
  });

  it("commits consent facts, permission projection and receipt atomically and retries a rolled-back command", async () => {
    const revisions = await _legalRevisions();
    await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(login.cookie, revisions, true),
      login.cookie,
    );
    const command = await db.applyConsentDecisionCommand.findFirstOrThrow();
    await db.$executeRawUnsafe(
      `CREATE FUNCTION _test_consent_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'completed' THEN RAISE EXCEPTION 'test consent receipt failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      "CREATE TRIGGER test_consent_receipt_failure BEFORE UPDATE ON apply_consent_decision_commands FOR EACH ROW EXECUTE FUNCTION _test_consent_receipt_failure()",
    );
    try {
      await assert.rejects(
        _consentHandler().process(command.id),
        /test consent receipt failure/,
      );
      assert.equal(await db.requiredConsentAcceptance.count(), 0);
      assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
      assert.equal(await db.emailAdvertisingSubscription.count(), 0);
      assert.equal(await db.userConsentState.count(), 0);
      const pending = await db.applyConsentDecisionCommand.findUniqueOrThrow({
        where: { id: command.id },
      });
      assert.equal(pending.status, "PENDING");
      assert.equal(pending.attempts, 0);
    } finally {
      await db.$executeRawUnsafe(
        "DROP TRIGGER test_consent_receipt_failure ON apply_consent_decision_commands",
      );
      await db.$executeRawUnsafe(
        "DROP FUNCTION _test_consent_receipt_failure()",
      );
    }
    assert.equal(await _consentHandler().process(command.id), true);
    const receipt = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { id: command.id },
    });
    assert.equal(receipt.status, "COMPLETED");
    assert.equal(receipt.attempts, 1);
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
    assert.equal(await db.emailAdvertisingSubscription.count(), 1);
    assert.equal(await db.userConsentState.count(), 1);
  });

  it("lets only one consent worker claim an operation and preserves its terminal receipt on replay", async () => {
    const revisions = await _legalRevisions();
    await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(login.cookie, revisions, true),
      login.cookie,
    );
    const command = await db.applyConsentDecisionCommand.findFirstOrThrow();
    const claims = await Promise.all([
      _consentHandler().process(command.id),
      _consentHandler().process(command.id),
    ]);
    assert.deepEqual(claims.sort(), [false, true]);
    const receipt = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { id: command.id },
    });
    assert.equal(receipt.status, "COMPLETED");
    assert.equal(receipt.attempts, 1);
    assert.equal(await _consentHandler().process(command.id), false);
    assert.deepEqual(
      await db.applyConsentDecisionCommand.findUniqueOrThrow({
        where: { id: command.id },
      }),
      receipt,
    );
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
  });

  it("rejects a second consent operation based on an outdated state without duplicating evidence", async () => {
    const revisions = await _legalRevisions();
    await _user("ready");
    const first = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    const second = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    const a = await _completionPost(
      await _consentInput(first.cookie, revisions, true),
      first.cookie,
    );
    const b = await _completionPost(
      await _consentInput(second.cookie, revisions, true),
      second.cookie,
    );
    const aCommand = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { operationId: a.state.operationId! },
    });
    const bCommand = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { operationId: b.state.operationId! },
    });
    await _consentHandler().process(aCommand.id);
    await _consentHandler().process(bCommand.id);
    const rejected = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { id: bCommand.id },
    });
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.errorCode, "CONSENTS_CHANGED");
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).version,
      1,
    );
  });

  it("does not collect consent evidence from a command whose authentication operation was cancelled", async () => {
    const revisions = await _legalRevisions();
    await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: "ready@example.test",
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(login.cookie, revisions, true),
      login.cookie,
    );
    const command = await db.applyConsentDecisionCommand.findFirstOrThrow();
    await _post("/auth/flow/cancel", {}, login.cookie);
    await _consentHandler().process(command.id);
    const rejected = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { id: command.id },
    });
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.errorCode, "INVALID_OPERATION");
    assert.equal(await db.requiredConsentAcceptance.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
  });

  it("fences publication of a new legal revision through the final consent readiness transaction", async () => {
    const revisions = await _legalRevisions();
    let release!: () => void;
    let locked!: () => void;
    const lockReady = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const releaseLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transaction = db.$transaction(async (tx) => {
      const current = await ConsentReadModel.lock(
        tx,
        "ready@example.test",
        "site_auth",
      );
      assert.ok(current);
      locked();
      await releaseLock;
    });
    await lockReady;
    let published = false;
    const { id: _oldId, ...next } = revisions.personal;
    void _oldId;
    const publication = db.consentRevision
      .create({ data: { ...next, version: "stage5-fixture-next" } })
      .then(() => {
        published = true;
      });
    try {
      let blocked = false;
      const deadline = Date.now() + 1000;
      while (Date.now() < deadline) {
        const rows = await db.$queryRaw<
          { waiting: bigint }[]
        >`SELECT count(*) AS waiting FROM pg_locks WHERE relation = 'consent_revisions'::regclass AND NOT granted`;
        if (rows[0]!.waiting > 0n) {
          blocked = true;
          break;
        }
      }
      assert.equal(
        blocked,
        true,
        "Publishing must wait for the final transaction's registry lock",
      );
      assert.equal(published, false);
    } finally {
      release();
      await Promise.all([transaction, publication]);
    }
    const current = await db.$transaction((tx) =>
      ConsentReadModel.read(tx, "ready@example.test", "site_auth"),
    );
    assert.equal(
      current,
      null,
      "Ambiguous current revisions must close the gate",
    );
  });

  it("serializes cancellation against the final commit without leaving a half-active registration", async () => {
    const revisions = await _legalRevisions();
    const requested = await _request("cancel-final-race@example.test");
    await _confirm(requested);
    await _post("/auth/flow/registration", _draft(), requested.cookie);
    const submitted = await _completionPost(
      await _consentInput(requested.cookie, revisions, true),
      requested.cookie,
    );
    await _consentHandler().process(
      (await db.applyConsentDecisionCommand.findFirstOrThrow()).id,
    );
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    await _profileHandler().process(
      (await db.ensureCustomerProfileCommand.findFirstOrThrow()).id,
    );
    assert.equal(await db.authCredential.count(), 0);
    const [cancelled] = await Promise.all([
      _post("/auth/flow/cancel", {}, requested.cookie),
      app.get(AuthCompletionService).process(submitted.state.operationId!),
    ]);
    assert.equal(cancelled.response.status, 201);
    assert.equal(cancelled.cookie.includes("artmate_access_token="), false);
    const flow = await _pendingRecord(requested.cookie);
    const operation = await db.authCompletionOperation.findUniqueOrThrow({
      where: { id: submitted.state.operationId! },
    });
    const recovery = await _completionRead(requested.cookie);
    if (flow.status === "CANCELLED") {
      assert.equal(operation.status, "REJECTED");
      assert.equal(operation.errorCode, "CANCELLED");
      assert.equal(await db.authCredential.count(), 0);
      assert.equal(recovery.state.status, "REJECTED");
      assert.equal(recovery.cookie.includes("artmate_access_token="), false);
    } else {
      assert.equal(flow.status, "COMPLETED");
      assert.equal(operation.status, "COMPLETED");
      assert.equal(await db.authCredential.count(), 1);
      assert.equal(recovery.state.status, "COMPLETED");
      await _assertSession(recovery.cookie, operation.resultUserId!);
    }
    assert.equal(flow.credentialPasswordHash, null);
    assert.equal(flow.credentialOperationKey, null);
    assert.equal(await db.authCompletionOperation.count(), 1);
  });

  async function _legalRevisions(version = "stage5-fixture-1") {
    const publishedAt = new Date(Date.now() - 1000);
    const result = [];
    for (const kind of ["PERSONAL_DATA", "EMAIL_ADVERTISING"] as const) {
      const documentBytes = Buffer.from(
        `Fixture document ${kind} ${version}. This is not a published legal text.`,
      );
      const formSnapshotBytes = Buffer.from(`Fixture form ${kind} ${version}`);
      result.push(
        await db.consentRevision.create({
          data: {
            kind,
            purpose: "site_auth",
            version,
            documentTitle: `Fixture ${kind}`,
            documentBytes,
            documentSha256: crypto
              .createHash("sha256")
              .update(documentBytes)
              .digest("hex"),
            formSnapshotBytes,
            formSha256: crypto
              .createHash("sha256")
              .update(formSnapshotBytes)
              .digest("hex"),
            createdAt: publishedAt,
            publishedAt,
          },
        }),
      );
    }
    return { personal: result[0]!, advertising: result[1]! };
  }

  it("returns login for missing, invalid or expired sessions without creating a continuation or User", async () => {
    const user = await _user("ready");
    for (const cookie of [
      "",
      "artmate_access_token=invalid",
      await _sessionCookie(user, { expired: true }),
    ]) {
      const started = await _post("/auth/flow/start", {}, cookie);
      assert.equal(started.response.status, 201);
      assert.deepEqual(started.state, {
        status: "LOGIN_REQUIRED",
        nextStep: "login",
      });
      assert.equal(started.cookie, "");
    }
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.verifiedIdentityFact.count(), 0);
    assert.equal(await db.authCompletionOperation.count(), 0);
  });

  it("continues a verified cookie session with consents and no password or code, retaining the original email proof date", async () => {
    await _legalRevisions();
    const user = await _user("ready");
    const access = await _sessionCookie(user);
    const started = await _post("/auth/flow/start", {}, access);
    assert.equal(started.response.status, 201);
    assert.equal(started.state.nextStep, "consents");
    const flow = await _pendingRecord(started.cookie);
    const auth = await db.authAuthenticationFact.findUniqueOrThrow({
      where: { id: flow.authenticationFactId },
    });
    assert.equal(auth.method, "SESSION");
    assert.match(auth.sessionAccountBindingSnapshot!, /^[a-f0-9]{64}$/);
    assert.equal(auth.credentialUpdatedAt, null);
    assert.equal(auth.envCredentialBindingSnapshot, null);
    const proof = await db.verifiedIdentityFact.findUniqueOrThrow({
      where: { id: flow.identityFactId },
    });
    assert.equal(proof.verifiedAt.getTime(), user.emailVerifiedAt!.getTime());
    assert.equal(proof.method, "RECORDED_EMAIL_VERIFICATION");
    assert.equal(
      JSON.stringify(auth.requestContext).includes(
        access.slice("artmate_access_token=".length),
      ),
      false,
    );
    assert.equal(started.cookie.includes("artmate_access_token="), false);
    const retried = await _post(
      "/auth/flow/start",
      {},
      `${access}; ${started.cookie}`,
    );
    assert.equal(retried.state.nextStep, "consents");
    assert.equal((await _pendingRecord(retried.cookie)).id, flow.id);
    assert.equal(await db.authAuthenticationFact.count(), 1);
    assert.equal(await db.authEmailChallenge.count(), 0);
    assert.equal(await db.notificationJob.count(), 0);
    assert.equal(await db.authCompletionOperation.count(), 0);
  });

  it("fills missing session profile through the same Auth draft and owner completion", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    await db.user.update({ where: { id: user.id }, data: { phone: null } });
    const access = await _sessionCookie(user);
    const started = await _post("/auth/flow/start", {}, access);
    assert.equal(started.state.nextStep, "profile");
    const actor = `${access}; ${started.cookie}`;
    const profile = await _post(
      "/auth/flow/profile",
      { name: "Ignored", phone: "+79991112233" },
      actor,
    );
    assert.equal(profile.state.nextStep, "consents");
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).phone,
      null,
    );
    assert.equal(await db.ensureCustomerProfileCommand.count(), 0);
    await _completionPost(await _consentInput(actor, revisions, false), actor);
    const done = await _finishCompletion(actor);
    assert.equal(done.state.status, "COMPLETED");
    await _assertSession(done.cookie, user.id);
    const current = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(current.phone, "+79991112233");
    assert.equal(current.name, user.name);
    assert.equal(await db.authCredential.count(), 1);
  });

  it("automatically completes a ready session without additional acceptance or grant", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const password = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(password.cookie, revisions, true),
      password.cookie,
    );
    const login = await _finishCompletion(password.cookie);
    assert.equal(login.state.status, "COMPLETED");
    const started = await _post(
      "/auth/flow/start",
      {},
      `${login.cookie}; ${password.cookie}`,
    );
    assert.equal(started.state.nextStep, "preparing");
    assert.notEqual(
      (await _pendingRecord(started.cookie)).id,
      (await _pendingRecord(password.cookie)).id,
    );
    const actor = `${login.cookie}; ${started.cookie}`;
    const completing = await _completionRead(actor);
    assert.equal(completing.state.status, "PENDING");
    const done = await _finishCompletion(actor);
    assert.equal(done.state.status, "COMPLETED");
    await _assertSession(done.cookie, user.id);
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
    assert.equal(await db.authCredential.count(), 1);
    const replay = await _completionRead(actor);
    assert.equal(replay.state.status, "COMPLETED");
    assert.equal(await db.authCompletionOperation.count(), 2);
  });

  it("shows consents again on a fresh explicit session entry when advertising was skipped", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const access = await _sessionCookie(user);
    const started = await _post("/auth/flow/start", {}, access);
    const actor = `${access}; ${started.cookie}`;
    await _completionPost(await _consentInput(actor, revisions, false), actor);
    const done = await _finishCompletion(actor);
    assert.equal(done.state.status, "COMPLETED");
    const next = await _post(
      "/auth/flow/start",
      {},
      `${done.cookie}; ${started.cookie}`,
    );
    assert.equal(next.state.nextStep, "consents");
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    assert.equal(await db.authCompletionOperation.count(), 1);
  });

  it("rejects a missing or switched current session before enqueuing consent decisions", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const other = await _user("provider");
    const started = await _post(
      "/auth/flow/start",
      {},
      await _sessionCookie(user),
    );
    const input = await _consentInput(started.cookie, revisions, true);
    const missing = await _completionPost(input, started.cookie);
    assert.equal(missing.response.status, 401);
    const changed = await _completionPost(
      input,
      `${await _sessionCookie(other)}; ${started.cookie}`,
    );
    assert.equal(changed.response.status, 401);
    assert.equal(changed.cookie.includes("artmate_access_token="), false);
    assert.equal(await db.authCompletionOperation.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
  });

  it("rejects revoked authVersion and replaced session credential without a fresh password challenge", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const access = await _sessionCookie(user);
    const started = await _post("/auth/flow/start", {}, access);
    const actor = `${access}; ${started.cookie}`;
    const credential = await db.authCredential.findFirstOrThrow();
    await db.authCredential.update({
      where: { id: credential.id },
      data: {
        passwordUpdatedAt: new Date(
          credential.passwordUpdatedAt.getTime() + 1000,
        ),
      },
    });
    const changed = await _completionPost(
      await _consentInput(actor, revisions, true),
      actor,
    );
    assert.equal(changed.response.status, 401);
    await db.user.update({
      where: { id: user.id },
      data: { authVersion: { increment: 1 } },
    });
    const expired = await _post("/auth/flow/start", {}, access);
    assert.equal(expired.state.status, "LOGIN_REQUIRED");
    assert.equal(await db.authCompletionOperation.count(), 0);
    assert.equal(await db.authEmailChallenge.count(), 0);
  });

  it("rejects a switched current account on password completion and a foreign pending session at entry", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const other = await _user("provider");
    const password = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const switched = await _completionPost(
      await _consentInput(password.cookie, revisions, true),
      `${await _sessionCookie(other)}; ${password.cookie}`,
    );
    assert.equal(switched.response.status, 401);
    const conflict = await _post(
      "/auth/flow/start",
      {},
      `${await _sessionCookie(other)}; ${password.cookie}`,
    );
    assert.equal(conflict.response.status, 409);
    assert.equal(await db.authCompletionOperation.count(), 0);
    assert.equal(await db.authAuthenticationFact.count(), 1);
  });

  it("continues an already verified provider session without a local password and rechecks its exact provider account", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("provider");
    const access = await _sessionCookie(user, { provider: "yandex" });
    const started = await _post("/auth/flow/start", {}, access);
    assert.equal(started.state.nextStep, "consents");
    const actor = `${access}; ${started.cookie}`;
    await _completionPost(await _consentInput(actor, revisions, true), actor);
    const done = await _finishCompletion(actor);
    assert.equal(done.state.status, "COMPLETED");
    await _assertSession(done.cookie, user.id);
    assert.equal(await db.authCredential.count(), 0);
    const next = await _post(
      "/auth/flow/start",
      {},
      `${done.cookie}; ${started.cookie}`,
    );
    assert.equal(next.state.nextStep, "preparing");
    const account = await db.authAccount.findFirstOrThrow({
      where: { userId: user.id },
    });
    await db.authAccount.update({
      where: { id: account.id },
      data: { providerUserId: "changed-provider-id" },
    });
    const changed = await _completionRead(`${done.cookie}; ${next.cookie}`);
    assert.equal(changed.response.status, 401);
    assert.equal(await db.authCompletionOperation.count(), 1);
  });

  it("preserves environment-password token binding through session completion", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const account = await db.authAccount.findFirstOrThrow({
      where: { userId: user.id },
    });
    await db.authCredential.deleteMany({ where: { accountId: account.id } });
    process.env.AUTH_PASSWORD_EMAIL = user.email!;
    process.env.AUTH_PASSWORD = "environment-password";
    const binding = app
      .get(CredentialsAuthService)
      .getEnvCredentialBinding(user.email!);
    const access = await _sessionCookie(user, { envBinding: binding });
    const started = await _post("/auth/flow/start", {}, access);
    assert.equal(started.state.nextStep, "consents");
    const actor = `${access}; ${started.cookie}`;
    await _completionPost(await _consentInput(actor, revisions, false), actor);
    const done = await _finishCompletion(actor);
    assert.equal(done.state.status, "COMPLETED");
    const token = done.cookie.slice("artmate_access_token=".length);
    assert.equal(
      (await app.get(AuthService).verifyFlowSession(token)).principal
        .envCredentialBinding,
      binding,
    );
    assert.equal(await db.authCredential.count(), 0);
  });

  it("bounds pending session authority to the original JWT expiry", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const expiresAt = Math.floor(Date.now() / 1000) + 2;
    const access = await _sessionCookie(user, { expiresAt });
    const started = await _post("/auth/flow/start", {}, access);
    assert.equal(started.state.nextStep, "consents");
    const flow = await _pendingRecord(started.cookie);
    assert.equal(flow.expiresAt.getTime(), expiresAt * 1000);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, expiresAt * 1000 - Date.now() + 20)),
    );
    const expired = await _completionPost(
      await _consentInput(started.cookie, revisions, true),
      `${access}; ${started.cookie}`,
    );
    assert.equal(expired.response.status, 401);
    assert.equal(await db.authCompletionOperation.count(), 0);
    assert.equal(await db.authEmailChallenge.count(), 0);
  });

  it("keeps the original session after cancellation and rejects a switched actor on completed-response replay", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const other = await _user("provider");
    const access = await _sessionCookie(user);
    const first = await _post("/auth/flow/start", {}, access);
    const cancelled = await _post(
      "/auth/flow/cancel",
      {},
      `${access}; ${first.cookie}`,
    );
    assert.equal(cancelled.state.status, "CANCELLED");
    assert.equal(cancelled.cookie.includes("artmate_access_token="), false);
    assert.equal(
      (await app.get(AuthService).getSession(undefined, access)).user?.id,
      user.id,
    );
    assert.equal(await db.authCompletionOperation.count(), 0);
    const second = await _post("/auth/flow/start", {}, access);
    const actor = `${access}; ${second.cookie}`;
    await _completionPost(await _consentInput(actor, revisions, true), actor);
    const done = await _finishCompletion(actor);
    assert.equal(done.state.status, "COMPLETED");
    const switched = await _completionRead(
      `${await _sessionCookie(other)}; ${second.cookie}`,
    );
    assert.equal(switched.response.status, 401);
    assert.equal(switched.cookie.includes("artmate_access_token="), false);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
  });

  it("publishes one historical email proof for simultaneous sessions through two existing providers", async () => {
    await _legalRevisions();
    const user = await _user("ready");
    await db.authAccount.create({
      data: {
        userId: user.id,
        provider: "YANDEX",
        providerUserId: user.email!,
      },
    });
    const credentials = await _sessionCookie(user);
    const yandex = await _sessionCookie(user, { provider: "yandex" });
    const results = await Promise.all([
      _post("/auth/flow/start", {}, credentials),
      _post("/auth/flow/start", {}, yandex),
    ]);
    for (const result of results) {
      assert.equal(result.response.status, 201);
      assert.equal(result.state.nextStep, "consents");
    }
    assert.equal(await db.verifiedIdentityFact.count(), 1);
    assert.equal(await db.authAuthenticationFact.count(), 2);
    assert.equal(await db.authPendingFlow.count(), 2);
    assert.equal(await db.authCompletionOperation.count(), 0);
  });

  it("enforces nonempty session account binding and immutable authentication evidence in PostgreSQL", async () => {
    const user = await _user("ready");
    const started = await _post(
      "/auth/flow/start",
      {},
      await _sessionCookie(user),
    );
    const flow = await _pendingRecord(started.cookie);
    const authentication = await db.authAuthenticationFact.findUniqueOrThrow({
      where: { id: flow.authenticationFactId },
    });
    for (const binding of [null, "invalid"]) {
      await assert.rejects(
        db.authAuthenticationFact.create({
          data: {
            ...authentication,
            requestContext:
              authentication.requestContext as Prisma.InputJsonValue,
            id: crypto.randomUUID(),
            sourceId: crypto.randomUUID(),
            sessionAccountBindingSnapshot: binding,
          },
        }),
      );
    }
    await assert.rejects(
      db.authAuthenticationFact.update({
        where: { id: authentication.id },
        data: { sessionAccountBindingSnapshot: "f".repeat(64) },
      }),
    );
    assert.equal(await db.authAuthenticationFact.count(), 1);
  });

  it("serializes a session-entry retry with consent completion without a lock-order deadlock", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const access = await _sessionCookie(user);
    const started = await _post("/auth/flow/start", {}, access);
    const actor = `${access}; ${started.cookie}`;
    await _completionPost(await _consentInput(actor, revisions, false), actor);
    const flow = await _pendingRecord(actor);
    const consent = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { operationId: flow.currentOperationId! },
    });
    await _consentHandler().process(consent.id);
    const results = await Promise.all([
      _post("/auth/flow/start", {}, actor),
      app.get(AuthCompletionService).process(flow.currentOperationId!),
    ]);
    assert.equal(results[0].response.status, 201);
    assert.equal(results[0].state.nextStep, "consents");
    const profile = await db.ensureCustomerProfileCommand.findUniqueOrThrow({
      where: { operationId: flow.currentOperationId! },
    });
    await _profileHandler().process(profile.id);
    const done = await _completionRead(actor);
    assert.equal(done.state.status, "COMPLETED");
    await _assertSession(done.cookie, user.id);
  });

  it("binds Yandex start to fresh pending/browser cookies and S256 without creating a user or session", async () => {
    const start = await _yandexStart();
    const authorization = new URL(start.authorizationUrl);
    assert.equal(
      authorization.searchParams.get("code_challenge_method"),
      "S256",
    );
    assert.equal(authorization.searchParams.get("response_type"), "code");
    assert.equal(
      authorization.searchParams.get("client_id"),
      "isolated-yandex-client",
    );
    const attempt = await db.oAuthState.findUniqueOrThrow({
      where: { id: start.attemptId },
    });
    assert.equal(
      attempt.pkceChallenge,
      authorization.searchParams.get("code_challenge"),
    );
    assert.equal(
      attempt.stateHash,
      crypto.createHash("sha256").update(start.state).digest("hex"),
    );
    assert.ok(attempt.capabilityHash && attempt.browserBindingHash);
    assert.equal(JSON.stringify(attempt).includes(start.state), false);
    assert.equal(start.cookie.includes("artmate_access_token"), false);
    assert.equal(await db.user.count(), 0);
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.deepEqual(await _yandexResult(start), {
      attemptId: start.attemptId,
      status: "WAITING",
    });
  });

  it("uses linked Yandex identity and the original Users email confirmation without code or profile writes", async () => {
    const user = await _user("provider");
    yandexIdentity = {
      providerUserId: "provider@example.test",
      contactEmail: "changed-at-provider@example.test",
    };
    const start = await _yandexStart();
    const callback = await _yandexCallback(start);
    assert.equal(callback.response.status, 201);
    assert.equal(callback.result.status, "PENDING");
    const record = await _pendingRecord(start.cookie);
    const authentication = await db.authAuthenticationFact.findUniqueOrThrow({
      where: { id: record.authenticationFactId },
    });
    const proof = await db.verifiedIdentityFact.findUniqueOrThrow({
      where: { id: record.identityFactId },
    });
    assert.equal(authentication.method, "YANDEX");
    assert.equal(
      authentication.providerUserIdSnapshot,
      yandexIdentity.providerUserId,
    );
    assert.equal(proof.method, "RECORDED_EMAIL_VERIFICATION");
    assert.equal(proof.email, user.email);
    assert.equal(proof.verifiedAt.getTime(), user.emailVerifiedAt!.getTime());
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.equal(await db.authEmailChallenge.count(), 0);
    assert.equal(await db.notificationJob.count(), 0);
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(callback.cookie.includes("artmate_access_token"), false);
    assert.equal(JSON.stringify(proof).includes("provider-code"), false);
    assert.deepEqual(await _yandexResult(start), callback.result);
  });

  it("shows missing Yandex contacts and then common consents without a local password", async () => {
    await _legalRevisions();
    const user = await _user("provider");
    await db.user.update({
      where: { id: user.id },
      data: { name: null, phone: null },
    });
    const start = await _yandexStart();
    const callback = await _yandexCallback(start);
    assert.equal(callback.result.status, "PENDING");
    if (callback.result.status === "PENDING")
      assert.equal(callback.result.state.nextStep, "profile");
    const profile = await _post(
      "/auth/flow/profile",
      { name: "User name", phone: "+79991234567" },
      start.cookie,
    );
    assert.equal(profile.state.nextStep, "consents");
    assert.equal(await db.authCredential.count(), 0);
  });

  it("finishes linked Yandex through domain receipts and automatically resumes when current consents exist", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("provider");
    const first = await _yandexStart();
    await _yandexCallback(first);
    await _completionPost(
      await _consentInput(first.cookie, revisions, true),
      first.cookie,
    );
    const completed = await _finishCompletion(first.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    await _assertSession(completed.cookie, user.id);
    assert.equal(
      (completed.state.user as unknown as { provider: string }).provider,
      "yandex",
    );
    assert.equal(await db.authCredential.count(), 0);
    const second = await _yandexStart();
    const callback = await _yandexCallback(second);
    assert.equal(callback.result.status, "PENDING");
    if (callback.result.status === "PENDING")
      assert.equal(callback.result.state.nextStep, "preparing");
    await _completionRead(second.cookie);
    const again = await _finishCompletion(second.cookie);
    assert.equal(again.state.status, "COMPLETED");
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
  });

  it("links the exact provider email through completion while preserving an existing password and user", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const credential = await db.authCredential.findFirstOrThrow();
    yandexIdentity = {
      providerUserId: "unlinked-provider-id",
      contactEmail: user.email,
    };
    const start = await _yandexStart();
    const callback = await _yandexCallback(start);
    assert.equal(callback.result.status, "PENDING");
    assert.equal(await db.authAccount.count(), 1);
    assert.equal(await db.user.count(), 1);
    const proof = await db.verifiedIdentityFact.findFirstOrThrow();
    assert.equal(proof.method, "YANDEX_VERIFIED_EMAIL");
    assert.equal(proof.email, user.email);
    await _completionPost(
      await _consentInput(start.cookie, revisions, false),
      start.cookie,
    );
    const completed = await _finishCompletion(start.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    await _assertSession(completed.cookie, user.id);
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.authAccount.count(), 2);
    assert.deepEqual(await db.authCredential.findFirstOrThrow(), credential);
  });

  it("publishes the accepted provider-email proof without inventing a code for an unverified linked email", async () => {
    const user = await _user("provider");
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: null },
    });
    const start = await _yandexStart();
    const callback = await _yandexCallback(start);
    assert.equal(callback.result.status, "PENDING");
    assert.equal(
      (await db.verifiedIdentityFact.findFirstOrThrow()).method,
      "YANDEX_VERIFIED_EMAIL",
    );
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .emailVerifiedAt,
      null,
    );
    assert.equal(await db.authEmailChallenge.count(), 0);
  });

  it("registers a new Yandex user without local password only after profile and consent receipts", async () => {
    const revisions = await _legalRevisions();
    yandexIdentity = {
      providerUserId: "new-yandex-subject",
      contactEmail: "new-yandex@example.test",
    };
    const start = await _yandexStart();
    const callback = await _yandexCallback(start);
    assert.equal(callback.result.status, "PENDING");
    if (callback.result.status === "PENDING")
      assert.equal(callback.result.state.nextStep, "profile");
    assert.equal(await db.user.count(), 0);
    assert.equal(await db.authAccount.count(), 0);
    assert.equal(await db.authCredential.count(), 0);
    const profile = await _post(
      "/auth/flow/profile",
      { name: "New Yandex user", phone: "+79991234567" },
      start.cookie,
    );
    assert.equal(profile.state.nextStep, "consents");
    await _completionPost(
      await _consentInput(start.cookie, revisions, true),
      start.cookie,
    );
    const completed = await _finishCompletion(start.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    assert.equal(await db.user.count(), 1);
    const account = await db.authAccount.findFirstOrThrow();
    assert.equal(account.provider, "YANDEX");
    assert.equal(account.providerUserId, "new-yandex-subject");
    assert.equal(await db.authCredential.count(), 0);
    assert.equal(await db.authEmailChallenge.count(), 0);
    await _assertSession(completed.cookie, account.userId);
  });

  it("links a guest buyer by accepted provider email while preserving all orders and no local password", async () => {
    const revisions = await _legalRevisions();
    const purchase = await _purchase(2);
    const orders = await db.order.findMany({ orderBy: { id: "asc" } });
    yandexIdentity = {
      providerUserId: "guest-yandex",
      contactEmail: "buyer@example.test",
    };
    const start = await _yandexStart();
    await _yandexCallback(start);
    await _completionPost(
      await _consentInput(start.cookie, revisions, false),
      start.cookie,
    );
    const completed = await _finishCompletion(start.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    await _assertSession(completed.cookie, purchase.userId);
    assert.equal(await db.user.count(), 1);
    assert.deepEqual(
      await db.order.findMany({ orderBy: { id: "asc" } }),
      orders,
    );
    assert.equal(await db.authCredential.count(), 0);
  });

  it("rejects a second Yandex subject claiming an email already linked to another Yandex identity", async () => {
    const user = await _user("provider");
    yandexIdentity = {
      providerUserId: "different-yandex-subject",
      contactEmail: user.email,
    };
    const start = await _yandexStart();
    const callback = await _yandexCallback(start);
    assert.deepEqual(callback.result, {
      attemptId: start.attemptId,
      status: "REJECTED",
      errorCode: "ACCOUNT_LINK_REQUIRED",
    });
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.authAccount.count(), 1);
    assert.equal(await db.verifiedIdentityFact.count(), 0);
  });

  it("returns a safe missing-email result without creating a user", async () => {
    yandexIdentity = { providerUserId: "new-no-email", contactEmail: null };
    const start = await _yandexStart();
    const callback = await _yandexCallback(start);
    assert.deepEqual(callback.result, {
      attemptId: start.attemptId,
      status: "REJECTED",
      errorCode: "EMAIL_CONFIRMATION_REQUIRED",
    });
    assert.equal(await db.user.count(), 0);
    assert.equal(await db.authAccount.count(), 0);
  });

  it("rejects bad Yandex state, foreign cookies, PKCE mismatch and expired attempt before token exchange", async () => {
    await _user("provider");
    const start = await _yandexStart();
    assert.equal(
      (await _yandexCallback(start, { state: "a".repeat(43) })).response.status,
      401,
    );
    const stranger = await _yandexStart();
    const foreignResult = await fetch(
      `${baseUrl}/auth/flow/yandex/result?attemptId=${start.attemptId}`,
      { headers: { cookie: stranger.cookie } },
    );
    assert.equal(foreignResult.status, 401);
    assert.equal(
      (await _yandexCallback({ ...start, cookie: stranger.cookie })).response
        .status,
      401,
    );
    const wrongPkce = start.cookie.replace(
      /artmate_oauth_yandex_pkce=[^;]+/,
      `artmate_oauth_yandex_pkce=${"x".repeat(43)}`,
    );
    assert.equal(
      (await _yandexCallback({ ...start, cookie: wrongPkce })).response.status,
      401,
    );
    await db.oAuthState.update({
      where: { id: start.attemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await _yandexCallback(start)).response.status, 401);
    assert.equal(yandexExchanges, 0);
    assert.equal(await db.authPendingFlow.count(), 0);
  });

  it("replays the same Yandex callback outcome without a second token exchange even after OAuth cookies clear", async () => {
    await _user("provider");
    const start = await _yandexStart();
    const first = await _yandexCallback(start);
    const retry = await _yandexCallback({
      ...start,
      cookie: start.cookie
        .split("; ")
        .filter((part) => !part.startsWith("artmate_oauth_"))
        .join("; "),
    });
    assert.deepEqual(retry.result, first.result);
    assert.equal(yandexExchanges, 1);
    assert.equal(await db.authPendingFlow.count(), 1);
    assert.equal(
      (await _yandexCallback(start, { code: "other-code" })).response.status,
      401,
    );
    assert.equal(yandexExchanges, 1);
  });

  it("persists provider denial and exchange failure for a fresh explicit retry", async () => {
    const denied = await _yandexStart();
    const response = await _yandexCallback(denied, {
      code: undefined,
      error: "access_denied",
    });
    assert.deepEqual(response.result, {
      attemptId: denied.attemptId,
      status: "REJECTED",
      errorCode: "PROVIDER_DENIED",
    });
    assert.equal(yandexExchanges, 0);
    assert.deepEqual(await _yandexResult(denied), response.result);
    yandexFail = true;
    const failed = await _yandexStart();
    const exchange = await _yandexCallback(failed);
    assert.deepEqual(exchange.result, {
      attemptId: failed.attemptId,
      status: "REJECTED",
      errorCode: "OAUTH_EXCHANGE_FAILED",
    });
    assert.deepEqual(await _yandexResult(failed), exchange.result);
    assert.equal(await db.authPendingFlow.count(), 0);
  });

  it("prevents a cancelled in-flight Yandex exchange from creating a continuation", async () => {
    await _user("provider");
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    yandexGate = async () => {
      entered();
      await gate;
    };
    const start = await _yandexStart();
    const callback = _yandexCallback(start);
    await started;
    assert.deepEqual(await _yandexResult(start), {
      attemptId: start.attemptId,
      status: "WAITING",
    });
    const cancel = await fetch(`${baseUrl}/auth/flow/cancel`, {
      method: "POST",
      headers: { cookie: start.cookie, "x-artmate-csrf": "1" },
    });
    release();
    assert.equal(cancel.status, 201);
    assert.equal((await callback).response.status, 401);
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.verifiedIdentityFact.count(), 0);
  });

  it("serializes duplicate Yandex callback while the exchange is in flight", async () => {
    await _user("provider");
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    yandexGate = async () => {
      entered();
      await gate;
    };
    const start = await _yandexStart();
    const first = _yandexCallback(start);
    await started;
    const repeat = await _yandexCallback(start);
    assert.deepEqual(repeat.result, {
      attemptId: start.attemptId,
      status: "WAITING",
    });
    release();
    assert.equal((await first).result.status, "PENDING");
    assert.equal(yandexExchanges, 1);
    assert.equal(await db.authPendingFlow.count(), 1);
  });

  it("rejects changed provider binding before Yandex completion and rejects a different active session", async () => {
    const revisions = await _legalRevisions();
    await _user("provider");
    const other = await _user("ready");
    const start = await _yandexStart();
    await _yandexCallback(start);
    const active = await _sessionCookie(other);
    const switched = await _completionPost(
      await _consentInput(start.cookie, revisions, false),
      `${start.cookie}; ${active}`,
    );
    assert.equal(switched.response.status, 401);
    assert.equal(await db.authCompletionOperation.count(), 0);
    await db.authAccount.update({
      where: {
        provider_providerUserId: {
          provider: "YANDEX",
          providerUserId: "provider@example.test",
        },
      },
      data: { providerUserId: "replacement-id" },
    });
    assert.equal((await _get(start.cookie)).response.status, 401);
    assert.equal(
      (
        await _completionPost(
          await _consentInput(start.cookie, revisions, false),
          start.cookie,
        )
      ).response.status,
      401,
    );
  });

  it("rechecks a provider-id collision committed after OAuth proof before final linking", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const other = await _user("provider");
    yandexIdentity = {
      providerUserId: "new-subject-racing-link",
      contactEmail: user.email,
    };
    const start = await _yandexStart();
    await _yandexCallback(start);
    const submitted = await _completionPost(
      await _consentInput(start.cookie, revisions, false),
      start.cookie,
    );
    await _consentHandler().process(
      (await db.applyConsentDecisionCommand.findFirstOrThrow()).id,
    );
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    await _profileHandler().process(
      (await db.ensureCustomerProfileCommand.findFirstOrThrow()).id,
    );
    const otherAccount = await db.authAccount.findUniqueOrThrow({
      where: { userId_provider: { userId: other.id, provider: "YANDEX" } },
    });
    await db.authAccount.update({
      where: { id: otherAccount.id },
      data: { providerUserId: "new-subject-racing-link" },
    });
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    const result = await _completionRead(start.cookie);
    assert.equal(result.state.status, "REJECTED");
    assert.equal(result.cookie.includes("artmate_access_token"), false);
    assert.equal(
      (
        await db.authAccount.findUniqueOrThrow({
          where: { id: otherAccount.id },
        })
      ).userId,
      other.id,
    );
    assert.equal(
      await db.authAccount.count({
        where: { userId: user.id, provider: "YANDEX" },
      }),
      0,
    );
  });

  it("rejects blocked Yandex users without repairing or merging accounts", async () => {
    const user = await _user("provider");
    await db.user.update({
      where: { id: user.id },
      data: { status: "BLOCKED" },
    });
    const start = await _yandexStart();
    const callback = await _yandexCallback(start);
    assert.deepEqual(callback.result, {
      attemptId: start.attemptId,
      status: "REJECTED",
      errorCode: "ACCOUNT_UNAVAILABLE",
    });
    assert.equal(await db.authPendingFlow.count(), 0);
  });

  it("relays the registered Yandex callback only to the fixed site surface without a JWT", async () => {
    const response = await fetch(
      `${baseUrl}/auth/oauth/yandex/callback?code=provider-code&state=public-state&next=https%3A%2F%2Fevil.example&error_description=private`,
      { redirect: "manual" },
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.origin, "http://localhost:3000");
    assert.equal(location.pathname, "/auth/oauth/yandex/callback");
    assert.equal(location.searchParams.get("next"), null);
    assert.equal(location.searchParams.get("error_description"), null);
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal(await db.user.count(), 0);
  });

  it("requires an explicit true personal-data checkbox for public contact messages", async () => {
    for (const consent of [undefined, false, "true", "false", 1, null]) {
      const result = await _post("/contacts/messages", {
        name: "Анна",
        email: "reply@example.test",
        message: "Вопрос о заказе",
        acceptedPersonalDataConsent: consent,
      });
      assert.equal(result.response.status, 400, String(consent));
    }
    assert.equal(businessNotifications.length, 0);
    assert.equal(await db.user.count(), 0);
  });

  it("sends an anonymous contact message without creating identity or advertising consent", async () => {
    const result = await _post("/contacts/messages", {
      name: "Анна",
      email: "reply@example.test",
      message: "Вопрос о заказе",
      acceptedPersonalDataConsent: true,
    });
    assert.equal(result.response.status, 201);
    assert.deepEqual(result.state, { sent: true });
    assert.equal(result.cookie, "");
    assert.equal(businessNotifications.length, 1);
    assert.match(businessNotifications[0]!, /reply@example\.test/);
    assert.match(
      businessNotifications[0]!,
      /Согласие на обработку ПДн:<\/b> получено/,
    );
    assert.doesNotMatch(businessNotifications[0]!, /<b>Аккаунт:/);
    assert.equal(await db.user.count(), 0);
    assert.equal(await db.verifiedIdentityFact.count(), 0);
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.authCompletionOperation.count(), 0);
    assert.equal(await db.requiredConsentAcceptance.count(), 0);
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
  });

  it("rejects anonymous and pending-only business calls before notification or persistence", async () => {
    const pending = await _post("/auth/flow/password", {
      email: (await _user("ready")).email,
      password: "existing-password",
    });
    for (const cookie of ["", pending.cookie, "artmate_access_token=forged"]) {
      for (const [path, input] of _businessInputs()) {
        const result = await _post(
          path,
          { ...input, acceptedPersonalDataConsent: true, consent: true },
          cookie,
        );
        assert.equal(result.response.status, 401, path);
      }
    }
    assert.equal(businessNotifications.length, 0);
    assert.equal(await db.partnerApplication.count(), 0);
  });

  it("rejects missing current required consent and missing registry independently of client booleans", async () => {
    const user = await _user("ready");
    const cookie = await _sessionCookie(user);
    for (const [path, input] of _businessInputs())
      assert.equal((await _post(path, input, cookie)).response.status, 503);
    await _legalRevisions();
    for (const [path, input] of _businessInputs())
      assert.equal((await _post(path, input, cookie)).response.status, 403);
    assert.equal(businessNotifications.length, 0);
    assert.equal(await db.partnerApplication.count(), 0);
  });

  it("allows verified business actions with advertising skipped and records genuine provenance, not reply email permission", async () => {
    const { user, cookie } = await _businessReady();
    for (const [path, input] of _businessInputs()) {
      const result = await _post(path, input, cookie);
      assert.equal(result.response.status, 202);
    }
    const acceptance = await db.requiredConsentAcceptance.findFirstOrThrow();
    const application = await db.partnerApplication.findFirstOrThrow();
    assert.equal(application.email, "reply@example.test");
    assert.equal(application.authenticatedUserId, user.id);
    assert.equal(application.consentAcceptanceId, acceptance.id);
    assert.equal(application.consent, null);
    assert.equal(businessNotifications.length, 1);
    assert.match(businessNotifications[0]!, /reply@example\.test/);
    assert.ok(businessNotifications[0]!.includes(acceptance.id));
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    assert.equal(await db.requiredConsentAcceptance.count(), 1);
  });

  it("rejects forged actor, action, purpose and legacy boolean fields after authentication", async () => {
    const { cookie } = await _businessReady();
    for (const [path, input] of _businessInputs()) {
      for (const forged of [
        { actor: { id: "other" } },
        { purpose: "site_auth" },
        { action: "contact_message" },
        { consent: true },
        { acceptedPersonalDataConsent: true },
      ])
        assert.equal(
          (await _post(path, { ...input, ...forged }, cookie)).response.status,
          400,
        );
    }
    assert.equal(businessNotifications.length, 0);
    assert.equal(await db.partnerApplication.count(), 0);
  });

  it("rejects stale sessions, unverified emails and incomplete profile before business effects", async () => {
    const { user, cookie } = await _businessReady();
    await db.user.update({ where: { id: user.id }, data: { phone: null } });
    for (const [path, input] of _businessInputs())
      assert.equal((await _post(path, input, cookie)).response.status, 403);
    await db.user.update({
      where: { id: user.id },
      data: { phone: "+79991234567", emailVerifiedAt: null },
    });
    for (const [path, input] of _businessInputs())
      assert.equal((await _post(path, input, cookie)).response.status, 401);
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), authVersion: { increment: 1 } },
    });
    for (const [path, input] of _businessInputs())
      assert.equal((await _post(path, input, cookie)).response.status, 401);
    assert.equal(businessNotifications.length, 0);
    assert.equal(await db.partnerApplication.count(), 0);
  });

  it("rejects a real old acceptance after the published required document changes", async () => {
    const { cookie } = await _businessReady();
    await db.consentRevision.updateMany({
      data: { retiredAt: new Date(Date.now() - 1) },
    });
    await _legalRevisions("next");
    for (const [path, input] of _businessInputs())
      assert.equal((await _post(path, input, cookie)).response.status, 403);
    assert.equal(businessNotifications.length, 0);
    assert.equal(await db.partnerApplication.count(), 0);
  });

  it("does not accept a permission projection without its exact persisted acceptance", async () => {
    const { user, cookie } = await _businessReady();
    const state = await db.userConsentState.findUniqueOrThrow({
      where: { email: user.email! },
    });
    const acceptance = await db.requiredConsentAcceptance.findFirstOrThrow();
    await db.userConsentState.update({
      where: { email: user.email! },
      data: {
        requiredAcceptances: [
          {
            purpose: "site_auth",
            revisionId: acceptance.revisionId,
            acceptanceId: "nonexistent-acceptance",
          },
        ],
        revision: state.revision + 1,
      },
    });
    for (const [path, input] of _businessInputs())
      assert.equal((await _post(path, input, cookie)).response.status, 403);
    assert.equal(businessNotifications.length, 0);
    assert.equal(await db.partnerApplication.count(), 0);
  });

  it("removes obsolete customer HTTP auth entry points while retaining role-scoped affiliate/admin login", async () => {
    const user = await _user("ready");
    for (const path of [
      "/auth/login",
      "/auth/register",
      "/auth/email-verification/confirm",
      "/auth/email-verification/resend",
    ])
      assert.equal((await _post(path, {})).response.status, 404);
    const input = { email: user.email, password: "existing-password" };
    assert.equal(
      (await _post("/auth/affiliate/login", input)).response.status,
      403,
    );
    assert.equal(
      (await _post("/auth/admin/login", input)).response.status,
      403,
    );
    await db.user.update({
      where: { id: user.id },
      data: { roles: ["CUSTOMER", "PARTNER"] },
    });
    const affiliate = await _post("/auth/affiliate/login", input);
    assert.equal(affiliate.response.status, 201);
    assert.ok(affiliate.cookie.includes("artmate_access_token="));
    await db.user.update({
      where: { id: user.id },
      data: { roles: ["CUSTOMER", "ADMIN"] },
    });
    const adminLogin = await _post("/auth/admin/login", input);
    assert.equal(adminLogin.response.status, 201);
    assert.ok(adminLogin.cookie.includes("artmate_access_token="));
  });

  it("direct settings grant records verified advertising evidence without Auth, profile or PDn effects", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const cookie = await _sessionCookie(user);
    const before = await _settingsStatus(cookie);
    assert.equal(before.grantRevisionId, revisions.advertising.id);
    const result = await _post(
      "/consents/email-advertising/grant",
      _settingsInput(before),
      cookie,
    );
    assert.equal(result.response.status, 201, JSON.stringify(result.state));
    assert.equal(result.cookie, "");
    assert.deepEqual(await _settingsStatus(cookie), {
      email: user.email,
      subscribed: true,
      version: 1,
      stateRevision: 1,
      grantRevisionId: revisions.advertising.id,
    });
    const event = await db.emailAdvertisingConsentEvent.findFirstOrThrow();
    assert.equal(event.source, "notification_settings");
    assert.equal(event.actorUserIdSnapshot, user.id);
    assert.equal(event.email, user.email);
    assert.equal(
      event.emailVerifiedAtSnapshot?.getTime(),
      user.emailVerifiedAt!.getTime(),
    );
    assert.equal(event.revisionId, revisions.advertising.id);
    assert.equal(event.authOperationId, null);
    assert.equal(event.identityFactId, null);
    assert.equal(
      (event.requestContext as unknown as RequestEvidenceV1).http.method,
      "POST",
    );
    assert.ok(event.requestId);
    assert.equal(await db.authCompletionOperation.count(), 0);
    assert.equal(await db.authPendingFlow.count(), 0);
    assert.equal(await db.requiredConsentAcceptance.count(), 0);
    assert.equal(await db.verifiedIdentityFact.count(), 0);
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.deepEqual(
      (await db.userConsentState.findFirstOrThrow()).requiredAcceptances,
      [],
    );
  });

  it("requires the current authenticated verified account, CSRF and exact settings payload", async () => {
    await _legalRevisions();
    const user = await _user("ready");
    const cookie = await _sessionCookie(user);
    const input = _settingsInput(await _settingsStatus(cookie));
    assert.equal(
      (await _post("/consents/email-advertising/grant", input)).response.status,
      401,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/consents/email-advertising/grant`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify(input),
        })
      ).status,
      403,
    );
    for (const extra of [
      { email: "victim@example.test" },
      { actorUserId: "victim" },
      { subscribed: true },
      { source: "other" },
    ]) {
      assert.equal(
        (
          await _post(
            "/consents/email-advertising/grant",
            { ...input, ...extra },
            cookie,
          )
        ).response.status,
        400,
      );
    }
    for (const bad of [
      {},
      { ...input, expectedVersion: -1 },
      { ...input, expectedStateRevision: undefined },
    ]) {
      assert.equal(
        (await _post("/consents/email-advertising/grant", bad, cookie)).response
          .status,
        400,
      );
    }
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: null },
    });
    assert.equal(
      (await _post("/consents/email-advertising/grant", input, cookie)).response
        .status,
      401,
    );
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), status: "BLOCKED" },
    });
    assert.equal(
      (await _post("/consents/email-advertising/grant", input, cookie)).response
        .status,
      401,
    );
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
  });

  it("settings repeated and concurrent ON commits one grant and no repeated acceptance", async () => {
    await _legalRevisions();
    const cookie = await _sessionCookie(await _user("ready"));
    const input = _settingsInput(await _settingsStatus(cookie));
    const results = await Promise.all([
      _post("/consents/email-advertising/grant", input, cookie),
      _post("/consents/email-advertising/grant", input, cookie),
    ]);
    for (const result of results)
      assert.equal(result.response.status, 201, JSON.stringify(result.state));
    assert.equal(
      (await _post("/consents/email-advertising/grant", input, cookie)).response
        .status,
      201,
    );
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
    assert.equal((await db.userConsentState.findFirstOrThrow()).revision, 1);
  });

  it("settings stale ON cannot override a later OFF even before a subscription exists", async () => {
    await _legalRevisions();
    const cookie = await _sessionCookie(await _user("ready"));
    const stale = _settingsInput(await _settingsStatus(cookie));
    assert.equal(
      (await _post("/consents/email-advertising/revoke", {}, cookie)).response
        .status,
      201,
    );
    assert.equal(
      (await _post("/consents/email-advertising/grant", stale, cookie)).response
        .status,
      409,
    );
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    const fresh = await _settingsStatus(cookie);
    assert.equal(fresh.version, 0);
    assert.equal(fresh.stateRevision, 1);
    assert.equal(
      (
        await _post(
          "/consents/email-advertising/grant",
          _settingsInput(fresh),
          cookie,
        )
      ).response.status,
      201,
    );
    assert.equal((await _settingsStatus(cookie)).stateRevision, 2);
  });

  it("settings revoke and regrant retain history and an old unsubscribe link still revokes", async () => {
    await _legalRevisions();
    const cookie = await _sessionCookie(await _user("ready"));
    const old = _settingsInput(await _settingsStatus(cookie));
    assert.equal(
      (await _post("/consents/email-advertising/grant", old, cookie)).response
        .status,
      201,
    );
    const subscription =
      await db.emailAdvertisingSubscription.findFirstOrThrow();
    const token = await app.get(UnsubscribeTokenIssuer).issue(subscription.id);
    await _post("/consents/email-advertising/revoke", {}, cookie);
    assert.equal(
      (await _post("/consents/email-advertising/grant", old, cookie)).response
        .status,
      409,
    );
    assert.equal(
      (
        await _post(
          "/consents/email-advertising/grant",
          _settingsInput(await _settingsStatus(cookie)),
          cookie,
        )
      ).response.status,
      201,
    );
    assert.equal((await _settingsStatus(cookie)).version, 3);
    assert.equal(
      (
        await _post("/consents/email-advertising/unsubscribe/confirm", {
          token,
        })
      ).response.status,
      201,
    );
    assert.equal((await _settingsStatus(cookie)).subscribed, false);
    assert.deepEqual(
      (
        await db.emailAdvertisingConsentEvent.findMany({
          orderBy: { version: "asc" },
        })
      ).map((e) => e.action),
      ["GRANTED", "REVOKED", "GRANTED", "REVOKED"],
    );
    assert.equal(await db.requiredConsentAcceptance.count(), 0);
  });

  it("settings refuses a stale advertising revision and rolls back when the grant key is unavailable", async () => {
    await _legalRevisions();
    const cookie = await _sessionCookie(await _user("ready"));
    const input = _settingsInput(await _settingsStatus(cookie));
    assert.equal(
      (
        await _post(
          "/consents/email-advertising/grant",
          { ...input, revisionId: "different" },
          cookie,
        )
      ).response.status,
      409,
    );
    const previous = process.env.ADVERTISING_RECIPIENT_HMAC_SECRET;
    try {
      delete process.env.ADVERTISING_RECIPIENT_HMAC_SECRET;
      assert.equal(
        (await _post("/consents/email-advertising/grant", input, cookie))
          .response.status,
        503,
      );
    } finally {
      process.env.ADVERTISING_RECIPIENT_HMAC_SECRET = previous;
    }
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    assert.equal(await db.userConsentState.count(), 0);
    await db.consentRevision.updateMany({
      data: { retiredAt: new Date(Date.now() - 1) },
    });
    assert.equal(
      (await _post("/consents/email-advertising/grant", input, cookie)).response
        .status,
      503,
    );
  });

  async function _settingsStatus(cookie: string) {
    const response = await fetch(`${baseUrl}/consents/email-advertising`, {
      headers: { cookie },
    });
    assert.equal(response.status, 200);
    return (await response.json()) as {
      email: string;
      subscribed: boolean;
      version: number;
      stateRevision: number;
      grantRevisionId?: string;
    };
  }
  function _settingsInput(state: Awaited<ReturnType<typeof _settingsStatus>>) {
    assert.ok(state.grantRevisionId);
    return {
      revisionId: state.grantRevisionId,
      expectedVersion: state.version,
      expectedStateRevision: state.stateRevision,
    };
  }

  it("reads only the current account advertising status and rejects client email/actor inputs", async () => {
    const user = await _user("ready");
    const cookie = await _sessionCookie(user);
    assert.equal(
      (await fetch(`${baseUrl}/consents/email-advertising`)).status,
      401,
    );
    const read = await fetch(`${baseUrl}/consents/email-advertising`, {
      headers: { cookie },
    });
    assert.equal(read.status, 200);
    assert.deepEqual(await read.json(), {
      email: user.email,
      subscribed: false,
      version: 0,
      stateRevision: 0,
    });
    for (const input of [
      { email: "victim@example.test" },
      { actor: { id: "other" } },
      { subscribed: true },
      { token: "anything" },
    ])
      assert.equal(
        (await _post("/consents/email-advertising/revoke", input, cookie))
          .response.status,
        400,
      );
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(await db.userConsentState.count(), 0);
  });

  it("records an off-state fence without a subscription, registry, profile or grant secrets", async () => {
    const user = await _user("ready");
    const cookie = await _sessionCookie(user);
    await db.user.update({ where: { id: user.id }, data: { phone: null } });
    await _withoutGrantSettings(async () => {
      const result = await _post(
        "/consents/email-advertising/revoke",
        {},
        cookie,
      );
      assert.equal(result.response.status, 201);
      assert.deepEqual(result.state, {
        email: user.email,
        subscribed: false,
        version: 0,
        stateRevision: 1,
      });
    });
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
    const state = await db.userConsentState.findUniqueOrThrow({
      where: { email: user.email! },
    });
    assert.equal(state.revision, 1);
    assert.deepEqual(state.requiredAcceptances, []);
  });

  it("withdraws an active permission atomically without registry, profile or configured grant/proxy keys", async () => {
    const ready = await _advertisingReady();
    const before = await db.userConsentState.findUniqueOrThrow({
      where: { email: ready.user.email! },
    });
    await db.consentRevision.updateMany({
      data: { retiredAt: new Date(Date.now() - 1) },
    });
    await db.user.update({
      where: { id: ready.user.id },
      data: { phone: null },
    });
    await _withoutGrantSettings(async () => {
      assert.equal(
        (await _post("/consents/email-advertising/revoke", {}, ready.cookie))
          .response.status,
        201,
      );
    });
    const subscription =
      await db.emailAdvertisingSubscription.findFirstOrThrow();
    const state = await db.userConsentState.findUniqueOrThrow({
      where: { email: ready.user.email! },
    });
    assert.equal(subscription.state, "REVOKED");
    assert.equal(subscription.version, 2);
    assert.equal(subscription.activeGrantId, null);
    assert.equal(state.revision, before.revision + 1);
    assert.deepEqual(state.requiredAcceptances, before.requiredAcceptances);
    const event = await db.emailAdvertisingConsentEvent.findFirstOrThrow({
      where: { action: "REVOKED" },
    });
    assert.equal(event.actorUserIdSnapshot, ready.user.id);
    assert.equal(event.authOperationId, null);
    assert.equal(event.identityFactId, null);
    assert.equal(event.revisionId, null);
    assert.equal(event.source, "notification_settings");
    const read = await fetch(`${baseUrl}/consents/email-advertising`, {
      headers: { cookie: ready.cookie },
    });
    assert.deepEqual(await read.json(), {
      email: ready.user.email,
      subscribed: false,
      version: 2,
      stateRevision: before.revision + 1,
    });
  });

  it("treats public GET/HEAD and invalid token GET as read-only and redirects only to the fixed site", async () => {
    const ready = await _advertisingReady();
    const token = await app
      .get(UnsubscribeTokenIssuer)
      .issue(ready.subscription.id);
    const before = await db.userConsentState.findFirstOrThrow();
    assert.equal(
      (
        await fetch(`${baseUrl}/auth/me`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status,
      401,
    );
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(
        `${baseUrl}/consents/email-advertising/unsubscribe?token=${token}`,
        { method, redirect: "manual" },
      );
      assert.equal(response.status, 303);
      assert.equal(
        response.headers.get("location"),
        `http://localhost:3000/unsubscribe?token=${token}`,
      );
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.match(response.headers.get("cache-control")!, /no-store/);
      assert.equal(response.headers.getSetCookie().length, 0);
    }
    const invalid = await fetch(
      `${baseUrl}/consents/email-advertising/unsubscribe?token=wrong`,
      { redirect: "manual" },
    );
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.get("referrer-policy"), "no-referrer");
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "ACTIVE",
    );
    assert.deepEqual(await db.userConsentState.findFirstOrThrow(), before);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
    const persisted = JSON.stringify(
      await db.emailAdvertisingUnsubscribeToken.findMany(),
    );
    assert.equal(persisted.includes(token), false);
  });

  it("requires normal CSRF for human token confirmation and refuses invalid capabilities or extra fields", async () => {
    const ready = await _advertisingReady();
    const token = await app
      .get(UnsubscribeTokenIssuer)
      .issue(ready.subscription.id);
    const withoutCsrf = await fetch(
      `${baseUrl}/consents/email-advertising/unsubscribe/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      },
    );
    assert.equal(withoutCsrf.status, 403);
    assert.equal(withoutCsrf.headers.get("referrer-policy"), "no-referrer");
    for (const input of [
      { token: "invalid" },
      { token: "B".repeat(43) },
      { token, email: ready.user.email },
      { token, subscribed: true },
    ])
      assert.equal(
        (await _post("/consents/email-advertising/unsubscribe/confirm", input))
          .response.status,
        400,
      );
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "ACTIVE",
    );
    await _withoutGrantSettings(async () => {
      const result = await _post(
        "/consents/email-advertising/unsubscribe/confirm",
        { token },
      );
      assert.equal(result.response.status, 201);
      assert.deepEqual(result.state, { unsubscribed: true });
    });
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "REVOKED",
    );
    const event = await db.emailAdvertisingConsentEvent.findFirstOrThrow({
      where: { action: "REVOKED" },
    });
    assert.equal(event.actorUserIdSnapshot, null);
    assert.equal(event.source, "email_unsubscribe");
    assert.equal(JSON.stringify(event.requestContext).includes(token), false);
  });

  it("accepts standard one-click urlencoded and multipart without cookies, login, CSRF or grant keys", async () => {
    const ready = await _advertisingReady();
    const token = await app
      .get(UnsubscribeTokenIssuer)
      .issue(ready.subscription.id);
    await _withoutGrantSettings(async () => {
      for (const multipart of [false, true]) {
        const response = await _oneClick(token, multipart);
        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), { unsubscribed: true });
        assert.equal(response.headers.getSetCookie().length, 0);
        assert.equal(response.headers.has("location"), false);
        assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      }
    });
    assert.equal(
      await db.emailAdvertisingConsentEvent.count({
        where: { action: "REVOKED" },
      }),
      1,
    );
    assert.equal((await db.userConsentState.findFirstOrThrow()).revision, 3);
    const event = await db.emailAdvertisingConsentEvent.findFirstOrThrow({
      where: { action: "REVOKED" },
    });
    assert.equal(JSON.stringify(event.requestContext).includes(token), false);
    assert.equal(event.source, "email_one_click");
  });

  it("bounds and validates the RFC body and keeps the CSRF exemption on its exact path and method", async () => {
    const ready = await _advertisingReady();
    const token = await app
      .get(UnsubscribeTokenIssuer)
      .issue(ready.subscription.id);
    const path = `/consents/email-advertising/unsubscribe?token=${token}`;
    assert.equal((await _oneClick("A".repeat(43))).status, 400);
    for (const [method, suffix, type, body] of [
      [
        "POST",
        "",
        "application/json",
        JSON.stringify({ "List-Unsubscribe": "One-Click" }),
      ],
      [
        "PUT",
        "",
        "application/x-www-form-urlencoded",
        "List-Unsubscribe=One-Click",
      ],
      [
        "POST",
        "/extra",
        "application/x-www-form-urlencoded",
        "List-Unsubscribe=One-Click",
      ],
      [
        "POST",
        "",
        "application/x-www-form-urlencoded",
        "List-Unsubscribe=wrong",
      ],
      [
        "POST",
        "",
        "application/x-www-form-urlencoded",
        "List-Unsubscribe=One-Click&extra=1",
      ],
      [
        "POST",
        "",
        "application/x-www-form-urlencoded",
        "List-Unsubscribe=One-Click&List-Unsubscribe=One-Click",
      ],
    ]) {
      const route = suffix
        ? `/consents/email-advertising/unsubscribe${suffix}?token=${token}`
        : path;
      const response = await fetch(baseUrl + route, {
        method,
        headers: { "content-type": type! },
        body,
      });
      assert.ok(
        [400, 403].includes(response.status),
        `${method} ${suffix} ${body}: ${response.status}`,
      );
    }
    const boundary = "IsolatedFileBoundary";
    const upload = await fetch(baseUrl + path, {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="secret.txt"\r\nContent-Type: text/plain\r\n\r\nvalue\r\n--${boundary}--\r\n`,
    });
    assert.equal(upload.status, 400);
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "ACTIVE",
    );
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 1);
  });

  it("serializes concurrent repeated token withdrawals without duplicate events or permission versions", async () => {
    const ready = await _advertisingReady();
    const token = await app
      .get(UnsubscribeTokenIssuer)
      .issue(ready.subscription.id);
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => _oneClick(token)),
    );
    for (const response of responses) assert.equal(response.status, 201);
    const subscription =
      await db.emailAdvertisingSubscription.findFirstOrThrow();
    assert.equal(subscription.state, "REVOKED");
    assert.equal(subscription.version, 2);
    assert.equal(
      await db.emailAdvertisingConsentEvent.count({
        where: { action: "REVOKED" },
      }),
      1,
    );
    assert.equal((await db.userConsentState.findFirstOrThrow()).revision, 6);
  });

  it("keeps older links usable after a fresh regrant and keeps all issued hashes without storing raw tokens", async () => {
    const ready = await _advertisingReady();
    const issuer = app.get(UnsubscribeTokenIssuer);
    const oldToken = await issuer.issue(ready.subscription.id);
    const secondToken = await issuer.issue(ready.subscription.id);
    assert.notEqual(oldToken, secondToken);
    assert.equal((await _oneClick(oldToken)).status, 201);
    const login = await _post("/auth/flow/password", {
      email: ready.user.email,
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(login.cookie, ready.revisions, true),
      login.cookie,
    );
    assert.equal(
      (await _finishCompletion(login.cookie)).state.status,
      "COMPLETED",
    );
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "ACTIVE",
    );
    assert.equal((await _oneClick(oldToken)).status, 201);
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "REVOKED",
    );
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).version,
      4,
    );
    assert.equal(await db.emailAdvertisingUnsubscribeToken.count(), 2);
    assert.equal(
      await db.emailAdvertisingConsentEvent.count({
        where: { action: "REVOKED" },
      }),
      2,
    );
  });

  it("fences a queued first grant even when there is no subscription yet", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const session = await _sessionCookie(user);
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const submitted = await _completionPost(
      await _consentInput(login.cookie, revisions, true),
      login.cookie,
    );
    const command = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { operationId: submitted.state.operationId! },
    });
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(
      (await _post("/consents/email-advertising/revoke", {}, session)).response
        .status,
      201,
    );
    await _consentHandler().process(command.id);
    assert.equal(
      (
        await db.applyConsentDecisionCommand.findUniqueOrThrow({
          where: { id: command.id },
        })
      ).errorCode,
      "CONSENTS_CHANGED",
    );
    assert.equal(await db.emailAdvertisingSubscription.count(), 0);
    assert.equal(await db.emailAdvertisingConsentEvent.count(), 0);
  });

  it("fences a queued regrant on a repeated already-off withdrawal", async () => {
    const ready = await _advertisingReady();
    const token = await app
      .get(UnsubscribeTokenIssuer)
      .issue(ready.subscription.id);
    await _oneClick(token);
    const login = await _post("/auth/flow/password", {
      email: ready.user.email,
      password: "existing-password",
    });
    const submitted = await _completionPost(
      await _consentInput(login.cookie, ready.revisions, true),
      login.cookie,
    );
    const command = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { operationId: submitted.state.operationId! },
    });
    assert.equal((await _oneClick(token)).status, 201);
    await _consentHandler().process(command.id);
    assert.equal(
      (
        await db.applyConsentDecisionCommand.findUniqueOrThrow({
          where: { id: command.id },
        })
      ).errorCode,
      "CONSENTS_CHANGED",
    );
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "REVOKED",
    );
    assert.equal(
      await db.emailAdvertisingConsentEvent.count({
        where: { action: "REVOKED" },
      }),
      1,
    );
  });

  it("rejects final Auth completion when a real withdrawal follows the grant receipt", async () => {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    const submitted = await _completionPost(
      await _consentInput(login.cookie, revisions, true),
      login.cookie,
    );
    const command = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { operationId: submitted.state.operationId! },
    });
    await _consentHandler().process(command.id);
    const subscription =
      await db.emailAdvertisingSubscription.findFirstOrThrow();
    const token = await app.get(UnsubscribeTokenIssuer).issue(subscription.id);
    assert.equal((await _oneClick(token)).status, 201);
    await app.get(AuthCompletionService).process(submitted.state.operationId!);
    const result = await _completionRead(login.cookie);
    assert.equal(result.state.status, "REJECTED");
    assert.equal(result.cookie.includes("artmate_access_token="), false);
    assert.equal(
      (await db.emailAdvertisingSubscription.findFirstOrThrow()).state,
      "REVOKED",
    );
  });

  async function _advertisingReady() {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(login.cookie, revisions, true),
      login.cookie,
    );
    const completed = await _finishCompletion(login.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    return {
      revisions,
      user,
      cookie: completed.cookie,
      subscription: await db.emailAdvertisingSubscription.findFirstOrThrow(),
    };
  }
  function _oneClick(token: string, multipart = false) {
    const boundary = "IsolatedOneClickBoundary";
    const body = multipart
      ? `--${boundary}\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--${boundary}--\r\n`
      : "List-Unsubscribe=One-Click";
    return fetch(
      `${baseUrl}/consents/email-advertising/unsubscribe?token=${token}`,
      {
        method: "POST",
        headers: {
          "content-type": multipart
            ? `multipart/form-data; boundary=${boundary}`
            : "application/x-www-form-urlencoded",
        },
        body,
        redirect: "manual",
      },
    );
  }
  async function _withoutGrantSettings(action: () => Promise<void>) {
    const names = [
      "AUTH_FLOW_PROXY_SECRET",
      "ADVERTISING_RECIPIENT_HMAC_SECRET",
      "ADVERTISING_RECIPIENT_KEY_VERSION",
    ] as const;
    const saved = names.map((name) => process.env[name]);
    try {
      for (const name of names) delete process.env[name];
      await action();
    } finally {
      names.forEach((name, index) => {
        if (saved[index] === undefined) delete process.env[name];
        else process.env[name] = saved[index];
      });
    }
  }

  function _businessInputs(): [string, Record<string, unknown>][] {
    return [
      [
        "/partner-applications",
        {
          name: "Reply contact",
          email: "reply@example.test",
          preferredContact: "email",
          channelUrl: "https://example.test/channel",
          partnerType: "creator",
          audienceSize: "up_to_1000",
        },
      ],
    ];
  }

  async function _businessReady() {
    const revisions = await _legalRevisions();
    const user = await _user("ready");
    const login = await _post("/auth/flow/password", {
      email: user.email,
      password: "existing-password",
    });
    await _completionPost(
      await _consentInput(login.cookie, revisions, false),
      login.cookie,
    );
    const completed = await _finishCompletion(login.cookie);
    assert.equal(completed.state.status, "COMPLETED");
    return { user, cookie: completed.cookie };
  }

  async function _yandexStart() {
    const response = await fetch(`${baseUrl}/auth/flow/yandex/start`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-artmate-csrf": "1" },
      body: "{}",
    });
    assert.equal(response.status, 201);
    const data = (await response.json()) as {
      attemptId: string;
      authorizationUrl: string;
    };
    const cookie = response.headers
      .getSetCookie()
      .map((part) => part.split(";")[0])
      .join("; ");
    return {
      ...data,
      cookie,
      state: new URL(data.authorizationUrl).searchParams.get("state")!,
    };
  }
  async function _yandexCallback(
    start: { cookie: string; state: string },
    overrides: { code?: string; state?: string; error?: string } = {},
  ) {
    const response = await fetch(`${baseUrl}/auth/flow/yandex/callback`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-artmate-csrf": "1",
        cookie: start.cookie,
      },
      body: JSON.stringify({
        code: "provider-code",
        state: start.state,
        ...overrides,
      }),
    });
    return {
      response,
      result: (await response.json()) as YandexFlowResultV1,
      cookie: response.headers.getSetCookie().join("; "),
    };
  }
  async function _yandexResult(start: { cookie: string; attemptId: string }) {
    const response = await fetch(
      `${baseUrl}/auth/flow/yandex/result?attemptId=${encodeURIComponent(start.attemptId)}`,
      { headers: { cookie: start.cookie } },
    );
    assert.equal(response.status, 200);
    return (await response.json()) as YandexFlowResultV1;
  }

  async function _sessionCookie(
    user: Awaited<ReturnType<typeof _user>>,
    options: {
      provider?: "credentials" | "yandex";
      expired?: boolean;
      expiresAt?: number;
      envBinding?: string;
    } = {},
  ) {
    const token = await app.get(JwtService).signAsync(
      {
        sub: user.id,
        provider:
          options.provider ??
          (user.email === "provider@example.test" ? "yandex" : "credentials"),
        providerUserId: user.email!,
        email: user.email!,
        name: user.name!,
        phone: user.phone!,
        roles: ["customer"],
        authVersion: user.authVersion,
        envCredentialBinding: options.envBinding,
        exp:
          options.expiresAt ??
          Math.floor(Date.now() / 1000) + (options.expired ? -10 : 600),
      },
      { secret: process.env.AUTH_JWT_SECRET! },
    );
    return `artmate_access_token=${encodeURIComponent(token)}`;
  }

  async function _pendingRecord(cookie: string) {
    return db.authPendingFlow.findUniqueOrThrow({
      where: {
        capabilityHash: FlowCredentials.capabilityHash(_credentials(cookie)),
      },
    });
  }

  async function _consentInput(
    cookie: string,
    revisions: Awaited<ReturnType<typeof _legalRevisions>>,
    advertising: boolean,
  ) {
    const flow = await _pendingRecord(cookie);
    const identity = await db.verifiedIdentityFact.findUniqueOrThrow({
      where: { id: flow.identityFactId },
    });
    const state = await db.userConsentState.findUnique({
      where: { email: identity.email },
    });
    const subscription = await db.emailAdvertisingSubscription.findUnique({
      where: { email: identity.email },
    });
    return {
      operationKey: flow.credentialOperationKey ?? crypto.randomUUID(),
      expectedStateRevision: state?.revision ?? 0,
      expectedAdvertisingVersion: subscription?.version ?? 0,
      decisions: [
        { revisionId: revisions.personal.id, accepted: true },
        { revisionId: revisions.advertising.id, accepted: advertising },
      ],
    };
  }

  function _consentHandler() {
    return new ConsentDecisionCommandHandler(db as never);
  }

  async function _finishCompletion(cookie: string) {
    const flow = await _pendingRecord(cookie);
    assert.ok(flow.currentOperationId);
    const consent = await db.applyConsentDecisionCommand.findUniqueOrThrow({
      where: { operationId: flow.currentOperationId },
    });
    await _consentHandler().process(consent.id);
    const consentReceipt =
      await db.applyConsentDecisionCommand.findUniqueOrThrow({
        where: { id: consent.id },
      });
    assert.equal(
      consentReceipt.status,
      "COMPLETED",
      JSON.stringify(consentReceipt),
    );
    await app.get(AuthCompletionService).process(flow.currentOperationId);
    const operation = await db.authCompletionOperation.findUniqueOrThrow({
      where: { id: flow.currentOperationId },
    });
    assert.notEqual(operation.status, "REJECTED", JSON.stringify(operation));
    const profile = await db.ensureCustomerProfileCommand.findUnique({
      where: { operationId: flow.currentOperationId },
    });
    if (profile) await _profileHandler().process(profile.id);
    await app.get(AuthCompletionService).process(flow.currentOperationId);
    return _completionRead(cookie);
  }

  async function _completionPost(
    input: unknown,
    cookie: string,
    extraHeaders: Record<string, string> = {},
    query = "",
  ) {
    return _completionRequest(
      `/auth/flow/complete${query}`,
      cookie,
      input,
      extraHeaders,
    );
  }

  async function _completionRead(cookie: string) {
    return _completionRequest("/auth/flow/complete", cookie);
  }

  async function _completionRequest(
    path: string,
    cookie: string,
    input?: unknown,
    extraHeaders: Record<string, string> = {},
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: input === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        "x-artmate-csrf": "1",
        cookie,
        ...extraHeaders,
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const state = (await response.json()) as {
      status: string;
      nextStep?: string;
      operationId?: string;
      errorCode?: string;
      user?: { id: string; email?: string };
    };
    const cookies = response.headers
      .getSetCookie()
      .map((item) => item.split(";")[0])
      .join("; ");
    return { response, state, cookie: cookies };
  }

  async function _assertSession(cookie: string, userId: string) {
    const value = cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("artmate_access_token="))
      ?.slice("artmate_access_token=".length);
    assert.ok(value, "Only a completed operation may issue an access cookie");
    const payload = await app.get(JwtService).verifyAsync<{
      sub: string;
    }>(decodeURIComponent(value), { secret: process.env.AUTH_JWT_SECRET! });
    assert.equal(payload.sub, userId);
  }

  function _profileHandler() {
    return new CustomerProfileCommandHandler(
      db as never,
      new UsersService(db as never),
    );
  }
  async function _profileCommand(
    flowId: string,
    values: { name: string; phone: string },
    override: {
      expectedUserId?: string;
      expectedProfileRevision?: number;
      payloadHash?: string;
    } = {},
  ) {
    const flow = await db.authPendingFlow.findUniqueOrThrow({
      where: { id: flowId },
    });
    const operation = await db.authCompletionOperation.create({
      data: {
        flowId,
        identityFactId: flow.identityFactId,
        authenticationFactId: flow.authenticationFactId,
        purpose: flow.purpose,
        operationKey: flow.credentialOperationKey ?? crypto.randomUUID(),
        payloadHash: "a".repeat(64),
      },
    });
    await db.authPendingFlow.update({
      where: { id: flow.id },
      data: { status: "COMPLETING", currentOperationId: operation.id },
    });
    const intent = {
      contractVersion: 1 as const,
      operationId: operation.id,
      identityFactId: flow.identityFactId,
      expectedUserId: override.expectedUserId ?? flow.userIdSnapshot,
      expectedProfileRevision:
        override.expectedProfileRevision ?? flow.profileRevision,
      ...values,
    };
    return db.ensureCustomerProfileCommand.create({
      data: {
        ...intent,
        payloadHash: override.payloadHash ?? ProfileCommandPayload.hash(intent),
      },
    });
  }

  function _mailer() {
    const mailer = new MailerService();
    mailer.sendMail = async () => {
      throw new Error("Real email delivery must not run in auth tests");
    };
    return mailer;
  }
  function _queue() {
    return new NotificationQueueService(_mailer(), db as never);
  }
  function _prepare() {
    return _post("/auth/flow/prepare", {});
  }
  function _exchange(token: string, cookie: string) {
    return _post("/auth/flow/order-activation/exchange", { token }, cookie);
  }
  function _activationPassword() {
    return {
      password: "new-password",
      passwordConfirm: "new-password",
      operationKey: crypto.randomUUID(),
    };
  }
  async function _activationLink(
    userId: string,
    expiresAt = new Date(Date.now() + 60_000),
  ) {
    const tokenId = createOrderActivationTokenId();
    const token = createOrderActivationToken(
      tokenId,
      process.env.AUTH_JWT_SECRET!,
    );
    await db.authOrderActivationToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash: createOrderActivationTokenHash(
          token,
          process.env.AUTH_JWT_SECRET!,
        ),
        expiresAt,
      },
    });
    return { tokenId, token, expiresAt };
  }
  async function _purchase(count: number) {
    let userId: string | undefined;
    for (let i = 0; i < count; i++) {
      const order = await db.order.create({
        data: {
          id: crypto.randomBytes(16).toString("hex"),
          cartId: `guest-cart-${i}`,
          customerEmail: "buyer@example.test",
          customerName: "Buyer",
          customerPhone: "+79990000000",
          pickupPointId: "point",
          pickupPointTitle: "Point",
          pickupPointAddress: "Address",
          pickupPointWorkHours: "9-18",
          deliveryPrice: 0,
          itemsCount: 1,
          subtotal: 100,
          total: 100,
          paymentRedirectUrl: "https://example.test/payment",
        },
      });
      userId = await db.$transaction((tx) =>
        app
          .get(OrderActivationService)
          .attachGuestOrderInTransaction(tx, order),
      );
    }
    assert.ok(userId);
    const link = await db.authOrderActivationToken.findFirstOrThrow({
      where: { userId },
    });
    return {
      userId,
      tokenId: link.id,
      token: createOrderActivationToken(link.id, process.env.AUTH_JWT_SECRET!),
    };
  }

  async function _user(
    kind: "ready" | "guest" | "provider" | "blocked" | "deleted" | "unfinished",
  ) {
    const user = await db.user.create({
      data: {
        email: `${kind}@example.test`,
        name: "Existing name",
        phone: "+79990000000",
        emailVerifiedAt:
          kind === "guest" || kind === "unfinished" ? null : new Date(),
        status:
          kind === "blocked"
            ? "BLOCKED"
            : kind === "deleted"
              ? "DELETED"
              : "ACTIVE",
      },
    });
    await db.authAccount.create({
      data: {
        userId: user.id,
        provider: kind === "provider" ? "YANDEX" : "CREDENTIALS",
        providerUserId: `${kind}@example.test`,
        ...(kind !== "guest" && kind !== "provider"
          ? {
              credential: {
                create: {
                  passwordHash:
                    await PasswordHasher.create("existing-password"),
                },
              },
            }
          : {}),
      },
    });
    return user;
  }

  async function _post(path: string, input: unknown, cookie = "") {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-artmate-csrf": "1",
        cookie,
      },
      body: JSON.stringify(input),
    });
    const state = (await response.json()) as AuthFlowStateDTO;
    const cookies = response.headers
      .getSetCookie()
      .map((item) => item.split(";")[0])
      .join("; ");
    return { response, state, cookie: cookies };
  }
  async function _get(cookie: string) {
    const response = await fetch(`${baseUrl}/auth/flow`, {
      headers: { cookie },
    });
    return { response, state: (await response.json()) as AuthFlowStateDTO };
  }
  async function _request(email: string) {
    const requested = await _post("/auth/email-code/request", { email });
    assert.equal(requested.response.status, 201);
    const job = await db.notificationJob.findFirstOrThrow({
      where: {
        payload: {
          path: ["challengeId"],
          equals: _credentials(requested.cookie).pending.slice(0, 36),
        },
      },
    });
    const message = await RegistrationEmailAdapter.prepare(
      db as never,
      job.payload as Record<string, unknown>,
    );
    assert.ok(message);
    return {
      ...requested,
      code: /Код подтверждения: (\d{6})/.exec(message.text!)![1]!,
    };
  }
  async function _confirm(requested: { cookie: string; code: string }) {
    return _post(
      "/auth/email-code/confirm",
      { code: requested.code, generation: 1 },
      requested.cookie,
    );
  }
  function _draft() {
    return {
      name: "New name",
      phone: "+7 (999) 123-45-67",
      password: "new-password",
      passwordConfirm: "new-password",
      operationKey: crypto.randomUUID(),
    };
  }
  function _credentials(cookie: string): AuthFlowCredentials {
    const values = Object.fromEntries(
      cookie.split(";").map((item) => item.trim().split("=")),
    );
    return {
      pending: decodeURIComponent(values.artmate_auth_pending!),
      browser: decodeURIComponent(values.artmate_auth_browser!),
    };
  }
});
