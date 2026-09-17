import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ConflictException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AffiliatePayoutsService } from "../src/affiliate/affiliate-payouts.service";
import type { AffiliatePayoutBalanceService } from "../src/affiliate/affiliate-payout-balance.service";
import { AffiliatePayoutListDTO } from "../src/affiliate/dto";
import type { Prisma } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";

const partnerUser = {
  id: "partner-user",
  provider: "credentials" as const,
  providerUserId: "partner@example.com",
  roles: ["partner" as const],
};
const requestId = "00000000-0000-4000-8000-000000000001";
const adminUser = {
  id: "admin-user",
  provider: "credentials" as const,
  providerUserId: "admin@example.com",
  roles: ["admin" as const],
};

describe("AffiliatePayoutsService", () => {
  it("creates an exact-threshold partial reserve and idempotently returns it", async () => {
    const fixture = createFixture();
    const first = await fixture.service.createOwnPayout(partnerUser, {
      requestId,
      amountKopecks: 500_000,
    });
    fixture.partner.minimumPayoutKopecks = 700_000n;
    fixture.partner.contractVersion = 3;
    fixture.partner.contractNumber = "A-3";
    fixture.partner.contractPaymentDetails = "changed";
    const retry = await fixture.service.createOwnPayout(partnerUser, {
      requestId,
      amountKopecks: 500_000,
    });

    assert.equal(first.id, retry.id);
    assert.equal(first.amountKopecks, 500_000);
    assert.equal(retry.minimumPayoutKopecks, 500_000);
    assert.deepEqual(retry.contract, {
      version: 2,
      number: "A-2",
      signedAt: "2026-09-01T00:00:00.000Z",
      paymentDetails: "snapshot",
    });
    assert.deepEqual(fixture.journal, [{ kind: "RESERVE", amountKopecks: 500_000n }]);
    assert.equal(fixture.balance.availableKopecks, 1_000_000);
  });

  it("rejects below-minimum, above-balance and changed amount retries", async () => {
    const below = createFixture();
    await assert.rejects(
      below.service.createOwnPayout(partnerUser, {
        requestId,
        amountKopecks: 499_999,
      }),
      (error: unknown) => payoutCode(error) === "affiliate_payout_below_minimum",
    );

    const above = createFixture();
    await assert.rejects(
      above.service.createOwnPayout(partnerUser, {
        requestId,
        amountKopecks: 1_000_001,
      }),
      (error: unknown) => payoutCode(error) === "affiliate_payout_unavailable_balance",
    );

    const conflict = createFixture();
    await conflict.service.createOwnPayout(partnerUser, {
      requestId,
      amountKopecks: 500_000,
    });
    await assert.rejects(
      conflict.service.createOwnPayout(partnerUser, {
        requestId,
        amountKopecks: 600_000,
      }),
      (error: unknown) => payoutCode(error) === "affiliate_payout_request_conflict",
    );
  });

  it("makes paid and rejected transitions immutable and idempotent", async () => {
    const paidFixture = createFixture();
    const payout = await paidFixture.service.createOwnPayout(partnerUser, {
      requestId,
      amountKopecks: 500_000,
    });
    const paidRequest = {
      requestId: "00000000-0000-4000-8000-000000000002",
      confirmed: true,
      paidAt: "2026-09-17T10:00:00.000Z",
      reference: "bank-1",
    };
    const paid = await paidFixture.service.markPaid(
      "partner-user",
      payout.id,
      paidRequest,
      adminUser,
    );
    const retry = await paidFixture.service.markPaid(
      "partner-user",
      payout.id,
      paidRequest,
      adminUser,
    );
    assert.equal(paid.status, "paid");
    assert.equal(retry.id, paid.id);
    assert.deepEqual(
      paidFixture.journal,
      [
        { kind: "RESERVE", amountKopecks: 500_000n },
        { kind: "PAY", amountKopecks: 500_000n },
      ],
    );

    const rejectedFixture = createFixture();
    const rejectedPayout = await rejectedFixture.service.createOwnPayout(
      partnerUser,
      { requestId, amountKopecks: 500_000 },
    );
    const rejected = await rejectedFixture.service.reject(
      "partner-user",
      rejectedPayout.id,
      {
        requestId: "00000000-0000-4000-8000-000000000003",
        reason: "not payable",
      },
      adminUser,
    );
    assert.equal(rejected.status, "rejected");
    assert.deepEqual(
      rejectedFixture.journal,
      [
        { kind: "RESERVE", amountKopecks: 500_000n },
        { kind: "RELEASE", amountKopecks: 500_000n },
      ],
    );
  });

  it("projects only the payout summary contract and rejects unsafe offsets", async () => {
    const fixture = createFixture();
    const list = await fixture.service.listOwnPayouts(partnerUser, 1, 10);
    assert.deepEqual(Object.keys(list.summary).sort(), [
      "asOf",
      "availableKopecks",
      "blockedReason",
      "canRequest",
      "debtKopecks",
      "minimumPayoutKopecks",
      "paidKopecks",
      "reservedKopecks",
    ]);
    assert.deepEqual(
      await validate(plainToInstance(AffiliatePayoutListDTO, list), {
        forbidNonWhitelisted: true,
        whitelist: true,
      }),
      [],
    );
    await assert.rejects(
      fixture.service.listOwnPayouts(partnerUser, 2_147_483_647, 50),
    );
  });

  it("does not expose an idempotent own response after access is revoked", async () => {
    const fixture = createFixture();
    await fixture.service.createOwnPayout(partnerUser, {
      requestId,
      amountKopecks: 500_000,
    });
    fixture.partner.status = "SUSPENDED";
    await assert.rejects(
      fixture.service.createOwnPayout(partnerUser, {
        requestId,
        amountKopecks: 500_000,
      }),
    );
  });

  it("allows admin read/reject but not paid for a suspended partner", async () => {
    const fixture = createFixture();
    const payout = await fixture.service.createOwnPayout(partnerUser, {
      requestId,
      amountKopecks: 500_000,
    });
    fixture.partner.status = "SUSPENDED";
    const adminList = await fixture.service.listAdminPayouts(
      "partner-user",
      1,
      10,
    );
    assert.equal(adminList.summary.blockedReason, "partner_inactive");
    await assert.rejects(
      fixture.service.markPaid(
        "partner-user",
        payout.id,
        {
          requestId: "00000000-0000-4000-8000-000000000004",
          confirmed: true,
          paidAt: "2026-09-17T10:00:00.000Z",
          reference: "blocked",
        },
        adminUser,
      ),
    );
    const rejected = await fixture.service.reject(
      "partner-user",
      payout.id,
      {
        requestId: "00000000-0000-4000-8000-000000000005",
        reason: "access suspended",
      },
      adminUser,
    );
    assert.equal(rejected.status, "rejected");
  });

  it("fails ownership and blocked-account checks under the user lock", async () => {
    const fixture = createFixture();
    await assert.rejects(
      fixture.service.listAdminPayouts("other-user", 1, 10),
    );
    fixture.userState.status = "BLOCKED";
    await assert.rejects(
      fixture.service.createOwnPayout(partnerUser, {
        requestId,
        amountKopecks: 500_000,
      }),
    );
  });

  it("uses one fresh database timestamp for cancellation audit rows", async () => {
    const fixture = createFixture();
    await fixture.service.createOwnPayout(partnerUser, {
      requestId,
      amountKopecks: 500_000,
    });
    await fixture.service.cancelPendingInTransaction(
      fixture.tx as unknown as Prisma.TransactionClient,
      fixture.partner.id,
      "refund",
    );
    const cancellation = fixture.events.at(-1);
    const release = fixture.journal.at(-1);
    assert.equal(cancellation?.createdAt, fixture.cancellationClock);
    assert.equal(release?.createdAt, fixture.cancellationClock);
  });
});

function createFixture() {
  const payouts: Array<Record<string, unknown>> = [];
  const operations: Array<Record<string, unknown>> = [];
  const journal: Array<{
    kind: string;
    amountKopecks: bigint;
    createdAt?: Date;
  }> = [];
  const events: Array<Record<string, unknown>> = [];
  const now = new Date("2026-09-17T10:00:00.000Z");
  const cancellationClock = new Date("2026-09-17T10:00:01.000Z");
  const partner = {
    id: "partner-1",
    userId: "partner-user",
    status: "ACTIVE",
    minimumPayoutKopecks: null as bigint | null,
    contractVersion: 2,
    contractNumber: "A-2",
    contractSignedAt: new Date("2026-09-01T00:00:00.000Z"),
    contractPaymentDetails: "snapshot",
  };
  const userState = {
    id: "partner-user",
    roles: ["PARTNER"],
    status: "ACTIVE",
  };
  const tx = {
    $queryRaw: async (query: { text: string }) =>
      query.text.includes("clock_timestamp")
        ? [{ now: cancellationClock }]
        : [{ id: "partner-user" }],
    $executeRawUnsafe: async () => 0,
    user: {
      findUnique: async () => userState,
    },
    affiliatePartner: {
      findUnique: async ({ where }: { where: { userId?: string; id?: string } }) =>
        where.userId && where.userId !== partner.userId
          ? null
          : {
              ...partner,
              user: { roles: userState.roles, status: userState.status },
            },
    },
    affiliatePayoutOperation: {
      findUnique: async ({ where }: { where: { partnerId_requestId: { requestId: string } } }) =>
        operations.find((entry) => entry.requestId === where.partnerId_requestId.requestId) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        operations.push(data);
        return data;
      },
    },
    affiliatePayout: {
      findFirst: async ({ where }: { where: { status?: string; id?: string } }) =>
        payouts.find((entry) =>
          where.id
            ? entry.id === where.id
            : "reference" in where
              ? entry.reference === where.reference
              : entry.status === where.status,
        ) ?? null,
      findMany: async () => payouts,
      count: async () => payouts.length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const payout = {
          id: `payout-${payouts.length + 1}`,
          ...data,
          createdAt: now,
          updatedAt: now,
          paidAt: null,
          reference: null,
          reason: null,
          events: [],
        };
        payouts.push(payout);
        return payout;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const payout = payouts.find((entry) => entry.id === where.id);
        if (!payout) throw new Error("missing payout");
        Object.assign(payout, data, { updatedAt: now });
        return payout;
      },
    },
    affiliatePayoutEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const event = { id: `event-${events.length + 1}`, createdAt: now, reason: null, actorUserId: null, ...data };
        events.push(event);
        const payout = payouts.find((entry) => entry.id === data.payoutId);
        (payout?.events as Array<Record<string, unknown>> | undefined)?.push(event);
        return event;
      },
    },
    affiliatePayoutJournalEntry: {
      create: async ({
        data,
      }: {
        data: { kind: string; amountKopecks: bigint; createdAt?: Date };
      }) => {
        journal.push({
          kind: data.kind,
          amountKopecks: data.amountKopecks,
          ...(data.createdAt ? { createdAt: data.createdAt } : {}),
        });
        return data;
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  } as unknown as PrismaService;
  const balance = {
    availableKopecks: 1_000_000,
    debtKopecks: 0,
    heldKopecks: 0,
    paidKopecks: 0,
    pendingKopecks: 0,
    reservedKopecks: 0,
    reversedKopecks: 0,
  };
  const balanceService = {
    calculateInTransaction: async () => balance,
  } as unknown as AffiliatePayoutBalanceService;
  return {
    service: new AffiliatePayoutsService(prisma, balanceService),
    balance,
    events,
    journal,
    partner,
    userState,
    tx,
    cancellationClock,
  };
}

function payoutCode(error: unknown) {
  if (!(error instanceof ConflictException)) return undefined;
  const response = error.getResponse();
  return typeof response === "object" && response && "code" in response
    ? response.code
    : undefined;
}
