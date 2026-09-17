import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import {
  AdminAffiliatePayoutsController,
  AffiliatePayoutsController,
} from "../src/affiliate/affiliate-payouts.controller";
import {
  AffiliatePayoutDTO,
  CreateAffiliatePayoutRequestDTO,
  MarkAffiliatePayoutPaidRequestDTO,
} from "../src/affiliate/dto";
import { AuthGuard } from "../src/auth/auth.guard";

describe("affiliate payout HTTP contract", () => {
  it("validates selected amount and explicit payout confirmation", async () => {
    const valid = plainToInstance(CreateAffiliatePayoutRequestDTO, {
      requestId: "00000000-0000-4000-8000-000000000001",
      amountKopecks: 500_000,
    });
    assert.deepEqual(await validate(valid), []);
    for (const amountKopecks of [1.5, 0, Number.MAX_SAFE_INTEGER + 1]) {
      assert.notEqual(
        (await validate(plainToInstance(CreateAffiliatePayoutRequestDTO, {
          requestId: "00000000-0000-4000-8000-000000000001",
          amountKopecks,
        }))).length,
        0,
      );
    }
    assert.notEqual(
      (await validate(plainToInstance(MarkAffiliatePayoutPaidRequestDTO, {
        requestId: "00000000-0000-4000-8000-000000000001",
        paidAt: "2026-09-17T10:00:00.000Z",
        reference: "bank-1",
        confirmed: false,
      }))).length,
      0,
    );
  });

  it("requires nullable response fields and complete snapshots", async () => {
    const payout = {
      id: "payout-1", status: "pending", amountKopecks: 500_000,
      minimumPayoutKopecks: 500_000, createdAt: "2026-09-17T10:00:00.000Z",
      updatedAt: "2026-09-17T10:00:00.000Z", paidAt: null, reference: null,
      reason: null, contract: { version: 2, number: "A-2", signedAt: "2026-09-01T00:00:00.000Z", paymentDetails: "snapshot" },
      events: [{ id: "event-1", status: "pending", createdAt: "2026-09-17T10:00:00.000Z", actorUserId: "partner-user", reason: null }],
    };
    assert.deepEqual(await validate(plainToInstance(AffiliatePayoutDTO, payout)), []);
    delete (payout as { paidAt?: string | null }).paidAt;
    assert.notEqual((await validate(plainToInstance(AffiliatePayoutDTO, payout))).length, 0);
  });

  it("guards partner and admin payout controllers", () => {
    for (const controller of [AffiliatePayoutsController, AdminAffiliatePayoutsController]) {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
      assert.equal(guards.includes(AuthGuard), true);
    }
  });
});
