import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ArgumentMetadata,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  ValidationPipe,
} from "@nestjs/common";
import {
  GUARDS_METADATA,
  HEADERS_METADATA,
  HTTP_CODE_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";

import { AuthGuard } from "../src/auth/auth.guard";
import { AuthService } from "../src/auth/auth.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import {
  PromoCodeInputDTO,
  UpdatePromoCodeInputDTO,
} from "../src/promocodes/dto";
import {
  AdminPromocodesController,
  PublicPromocodesController,
} from "../src/promocodes/promocodes.controller";
import { PromocodesThrottleService } from "../src/promocodes/promocodes-throttle.service";
import { UsersService } from "../src/users/users.service";

const pipe = new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
});

describe("promocodes HTTP validation", () => {
  it("normalizes ASCII lowercase but rejects Unicode case folding", async () => {
    const valid = await transform(
      PromoCodeInputDTO,
      validInput({ code: " sale_10 " }),
    );
    assert.equal(valid.code, "SALE_10");
    for (const code of ["ſAVE", "ßA", "ПРОМО"]) {
      await assert.rejects(transform(PromoCodeInputDTO, validInput({ code })));
    }
  });

  it("accepts PATCH without code and rejects invalid cap/count/name/date values", async () => {
    const update = validInput();
    delete (update as { code?: string }).code;
    assert.equal(
      (await transform(UpdatePromoCodeInputDTO, update)).code,
      undefined,
    );
    for (const invalid of [
      validInput({ kind: "welcome" }),
      validInput({ maxDiscountKopecks: 0 }),
      validInput({ maxUses: 2_147_483_648 }),
      validInput({ name: "x".repeat(161) }),
      validInput({ startsAt: "2026-08-31" }),
      validInput({ startsAt: "2026-08-31T12:00:00" }),
      validInput({ startsAt: "2026-02-30T12:00:00Z" }),
    ]) {
      await assert.rejects(transform(PromoCodeInputDTO, invalid));
    }
  });

  it("protects GET welcome with auth and private no-store caching", () => {
    const handler = (
      PublicPromocodesController.prototype as unknown as {
        welcome: (...args: unknown[]) => unknown;
      }
    ).welcome;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    const headers = Reflect.getMetadata(HEADERS_METADATA, handler) as Array<{
      name: string;
      value: string;
    }>;

    assert.equal(Reflect.getMetadata(PATH_METADATA, handler), "welcome");
    assert.equal(guards.includes(AuthGuard), true);
    assert.deepEqual(headers, [
      { name: "Cache-Control", value: "private, no-store" },
    ]);
  });

  it("keeps welcome-offer public with optional auth and private no-store caching", async () => {
    const handler = PublicPromocodesController.prototype.welcomeOffer;
    const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];
    const headers = Reflect.getMetadata(HEADERS_METADATA, handler) as Array<{
      name: string;
      value: string;
    }>;
    const userIds: Array<string | undefined> = [];
    let authenticated = false;
    const controller = new PublicPromocodesController(
      {
        getWelcomeOffer: (userId?: string) => {
          userIds.push(userId);
          return { offer: null };
        },
      } as never,
      {} as never,
      {
        getSession: async () => ({
          user: authenticated ? { id: "user-1" } : null,
        }),
      } as never,
    );

    assert.equal(guards.includes(AuthGuard), false);
    assert.deepEqual(headers, [
      { name: "Cache-Control", value: "private, no-store" },
    ]);
    await controller.welcomeOffer({ headers: {} });
    authenticated = true;
    await controller.welcomeOffer({ headers: {} });
    assert.deepEqual(userIds, [undefined, "user-1"]);
  });

  it("handles malformed encoded cookies without throwing URIError", () => {
    const authService = Object.create(AuthService.prototype) as AuthService;
    assert.equal(
      authService.getCookieValue(
        "artmate_access_token=%E0%A4%A",
        "artmate_access_token",
      ),
      undefined,
    );
  });

  it("registers welcome-offer, welcome and preview public-controller routes", () => {
    const prototype = PublicPromocodesController.prototype;
    const routes = Object.getOwnPropertyNames(prototype).flatMap(
      (methodName) => {
        if (methodName === "constructor") return [];

        const handler = prototype[methodName as keyof typeof prototype];
        const path = Reflect.getMetadata(PATH_METADATA, handler);

        return typeof path === "string" ? [{ methodName, path }] : [];
      },
    );

    assert.deepEqual(routes, [
      { methodName: "welcomeOffer", path: "welcome-offer" },
      { methodName: "welcome", path: "welcome" },
      { methodName: "preview", path: "preview" },
    ]);
    assert.equal(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        PublicPromocodesController.prototype.preview,
      ),
      HttpStatus.OK,
    );
  });

  it("enforces the public rate boundary per IP and cart cookie", () => {
    const throttle = new PromocodesThrottleService();
    const identity = {
      cookieHeader: "cart_id=cart-1",
      requestIp: "203.0.113.20",
    };
    for (let index = 0; index < 30; index += 1) {
      assert.doesNotThrow(() => throttle.assertAllowed(identity));
    }
    assert.throws(
      () => throttle.assertAllowed(identity),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "getStatus" in error &&
        (error as { getStatus(): number }).getStatus() === 429,
    );
  });

  it("requires CSRF for non-exempt admin mutations", () => {
    const csrf = new CsrfMiddleware();
    assert.throws(
      () =>
        csrf.use(
          {
            headers: {},
            method: "POST",
            originalUrl:
              "/promocodes/admin/promo-1/redemptions/order-1/release",
          },
          {},
          () => assert.fail("must not continue"),
        ),
      ForbiddenException,
    );
    let continued = false;
    csrf.use(
      {
        headers: { "x-artmate-csrf": "1" },
        method: "POST",
        originalUrl: "/promocodes/admin",
      },
      {},
      () => {
        continued = true;
      },
    );
    assert.equal(continued, true);
  });

  it("enforces anonymous 401, customer 403 and permits the admin role", async () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminPromocodesController,
    ) as unknown[];
    assert.equal(guards.includes(AuthGuard), true);

    const guard = new AuthGuard({
      getTokenFromRequest: () => undefined,
    } as AuthService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as ExecutionContext;
    await assert.rejects(() => guard.canActivate(context), {
      status: HttpStatus.UNAUTHORIZED,
    });

    const users = Object.create(UsersService.prototype) as UsersService;
    assert.throws(
      () =>
        users.assertRole(
          {
            roles: [],
          },
          "admin",
        ),
      ForbiddenException,
    );
    assert.doesNotThrow(() => users.assertRole({ roles: ["admin"] }, "admin"));
  });
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    code: "SALE10",
    name: "Sale",
    type: "percentage",
    basisPoints: 1_000,
    amountKopecks: null,
    maxDiscountKopecks: null,
    minSubtotalKopecks: 0,
    startsAt: "2026-08-31T12:00:00.123Z",
    endsAt: "2026-09-30T12:00:00+03:00",
    maxUses: null,
    maxUsesPerUser: null,
    isActive: true,
    ...overrides,
  };
}

function transform<T extends object>(type: new () => T, value: unknown) {
  return pipe.transform(value, {
    metatype: type,
    type: "body",
  } as ArgumentMetadata) as Promise<T>;
}
