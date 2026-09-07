import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { AuthController } from "../src/auth/auth.controller";
import { AuthGuard } from "../src/auth/auth.guard";
import { ConfirmTelegramLinkRequestDTO } from "../src/auth/dto/confirm-telegram-link-request.dto";
import { RegisterRequestDTO } from "../src/auth/dto/register-request.dto";
import { RequestAccountRecoveryDTO } from "../src/auth/dto/request-account-recovery.dto";

const pipe = new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
});

describe("Telegram link confirmation contract", () => {
  it("accepts code only and rejects missing, malformed, or legacy consent input", async () => {
    const valid = await transform(ConfirmTelegramLinkRequestDTO, { code: "123456" });
    assert.equal(valid.code, "123456");
    assert.deepEqual(Object.keys(valid), ["code"]);

    for (const input of [
      {},
      { code: "12345" },
      { code: "1234567" },
      { code: "12345a" },
      { acceptedPersonalDataConsent: true, code: "123456" },
    ]) {
      await assert.rejects(transform(ConfirmTelegramLinkRequestDTO, input));
    }
  });

  it("retains AuthGuard on the confirmation endpoint", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuthController.prototype.confirmTelegramLink,
    ) as unknown[];

    assert.equal(guards.includes(AuthGuard), true);
  });

  it("keeps consent required for registration and password reset requests", async () => {
    await assert.rejects(
      transform(RegisterRequestDTO, {
        email: "user@example.com",
        password: "password123",
      }),
    );
    await assert.rejects(
      transform(RequestAccountRecoveryDTO, { email: "user@example.com" }),
    );

    assert.equal(
      (
        await transform(RegisterRequestDTO, {
          acceptedPersonalDataConsent: true,
          email: "user@example.com",
          password: "password123",
        })
      ).acceptedPersonalDataConsent,
      true,
    );
    assert.equal(
      (
        await transform(RequestAccountRecoveryDTO, {
          acceptedPersonalDataConsent: true,
          email: "user@example.com",
        })
      ).acceptedPersonalDataConsent,
      true,
    );
  });
});

function transform<T extends object>(type: new () => T, value: unknown) {
  return pipe.transform(value, {
    metatype: type,
    type: "body",
  } as ArgumentMetadata) as Promise<T>;
}
