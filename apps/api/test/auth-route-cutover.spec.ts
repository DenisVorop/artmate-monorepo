import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AuthController } from "../src/auth/auth.controller";
import { AuthLinkFlowController } from "../src/auth/link-flow.controller";
import { AuthService } from "../src/auth/auth.service";
import { AuthGuard } from "../src/auth/auth.guard";
import { CredentialsAuthService } from "../src/auth/credentials-auth.service";
import { LoginThrottleService } from "../src/auth/login-throttle.service";
import { OAuthProvidersService } from "../src/auth/oauth-providers.service";
import { TelegramLinkService } from "../src/auth/telegram-link.service";
import { ActivationFlowService } from "../src/auth/activation-flow.service";
import { RegistrationDraftService } from "../src/auth/registration-draft.service";
import { RecoveryFlowService } from "../src/auth/recovery-flow.service";
import { FlowLifecycleService } from "../src/auth/flow-lifecycle.service";
import { UsersService } from "../src/users/users.service";

/** Real Nest route registry, isolated services: no DB, mail or external network. */
describe("shared auth route cutover HTTP", () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let baseUrl: string;
  let issuedSessions = 0;
  const originalSecret = process.env.AUTH_FLOW_PROXY_SECRET;

  before(async () => {
    process.env.AUTH_FLOW_PROXY_SECRET = "isolated-route-context-secret";
    @Module({
      controllers: [AuthController, AuthLinkFlowController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            createAccessToken: () => {
              issuedSessions++;
              return "forbidden-test-session";
            },
          },
        },
        { provide: AuthGuard, useValue: { canActivate: () => false } },
        { provide: CredentialsAuthService, useValue: {} },
        { provide: LoginThrottleService, useValue: {} },
        {
          provide: OAuthProvidersService,
          useValue: { getProviders: () => ["yandex"] },
        },
        { provide: TelegramLinkService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: ActivationFlowService, useValue: {} },
        { provide: RegistrationDraftService, useValue: {} },
        { provide: FlowLifecycleService, useValue: {} },
        {
          provide: RecoveryFlowService,
          useValue: { request: () => ({ ok: true }) },
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
      }),
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });
  after(async () => {
    await app?.close();
    if (originalSecret === undefined) delete process.env.AUTH_FLOW_PROXY_SECRET;
    else process.env.AUTH_FLOW_PROXY_SECRET = originalSecret;
  });

  it("does not expose superseded activation, recovery or reset endpoints or issue a cookie through them", async () => {
    const active = await fetch(`${baseUrl}/auth/providers`);
    assert.equal(active.status, 200, "AuthController must actually be mounted");
    for (const route of [
      "register",
      "login",
      "email-verification/confirm",
      "email-verification/resend",
      "order-activation/confirm",
      "order-activation/validate",
      "password-reset/confirm",
      "recovery/request",
    ]) {
      const response = await fetch(`${baseUrl}/auth/${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "fixture-token",
          password: "fixture-password",
          email: "fixture@example.test",
        }),
      });
      assert.equal(response.status, 404, route);
      assert.equal(response.headers.getSetCookie().length, 0, route);
    }
    assert.equal(issuedSessions, 0);
  });

  it("keeps recovery on the shared flow without a consent checkbox or session issuance", async () => {
    const response = await fetch(`${baseUrl}/auth/flow/recovery/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fixture@example.test" }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal(issuedSessions, 0);
  });
});
