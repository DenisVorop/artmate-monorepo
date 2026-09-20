import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";

import type {
  LoyaltyMember,
  LoyaltyOperation,
  LoyaltyReservation,
  Prisma,
} from "../src/generated/prisma/client";
import {
  LoyaltyWalletService,
  type LoyaltyPointsCommand,
} from "../src/loyalty/wallet.service";

function fixture(balancePoints = 100n) {
  const member = {
    id: "member-1",
    userId: "user-1",
    status: "ACTIVE",
    historyState: "READY",
  } as LoyaltyMember;
  const wallet = {
    memberId: member.id,
    balancePoints,
    reservedPoints: 0n,
    revision: 0n,
    updatedAt: new Date(),
  };
  const order = {
    id: "order-1",
    userId: member.userId,
    checkoutActorUserId: member.userId as string | null,
    paymentStatus: "PENDING",
    status: "PENDING_PAYMENT",
    paidAt: null as Date | null,
    terminalPaymentFailedAt: null,
    crmStatus: "NEW",
  };
  const operations = new Map<string, LoyaltyOperation>();
  const reservations = new Map<string, LoyaltyReservation>();
  const locks: string[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      locks.push(strings.join("?"));
      return [{ id: member.id }];
    },
    loyaltyMember: { findUnique: async () => member },
    loyaltyWallet: {
      findUnique: async () => ({ ...wallet }),
      update: async ({ data }: { data: object }) => Object.assign(wallet, data),
    },
    order: { findUnique: async () => order },
    loyaltyOperation: {
      findUnique: async ({ where }: { where: { operationKey: string } }) =>
        operations.get(where.operationKey) ?? null,
      create: async ({ data }: { data: LoyaltyOperation }) => {
        assert.equal("points" in data, false);
        assert.equal("orderId" in data, false);
        const operation = {
          ...data,
          id: `operation-${operations.size + 1}`,
          recordedAt: new Date(),
        };
        operations.set(operation.operationKey, operation);
        return operation;
      },
    },
    loyaltyReservation: {
      findUnique: async ({ where }: { where: { orderId: string } }) =>
        reservations.get(where.orderId) ?? null,
      create: async ({ data }: { data: LoyaltyReservation }) => {
        const reservation = {
          ...data,
          id: `reservation-${reservations.size + 1}`,
          status: "RESERVED" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        reservations.set(data.orderId, reservation);
        return reservation;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: object;
      }) => {
        const reservation = [...reservations.values()].find(
          (value) => value.id === where.id,
        )!;
        return Object.assign(reservation, data);
      },
    },
  } as unknown as Prisma.TransactionClient;
  const service = new LoyaltyWalletService();
  const command: LoyaltyPointsCommand = {
    memberId: member.id,
    operationKey: "credit-1",
    points: 25,
    sourceKey: "work:1",
    rulesVersion: "v1",
    occurredAt: new Date("2026-09-20T00:00:00Z"),
  };
  const reserve = {
    ...command,
    operationKey: "reserve-1",
    orderId: order.id,
    points: 50,
  };
  const settle = {
    memberId: member.id,
    operationKey: "consume-1",
    orderId: order.id,
    sourceKey: "payment:1",
    rulesVersion: "v1",
    occurredAt: command.occurredAt,
  };
  return {
    member,
    wallet,
    order,
    operations,
    reservations,
    locks,
    tx,
    service,
    command,
    reserve,
    settle,
  };
}

describe("LoyaltyWalletService", () => {
  it("credits pending history, serializes member, and replays before blocked checks", async () => {
    const f = fixture();
    f.member.historyState = "PENDING";
    const first = await f.service.creditInTransaction(f.tx, f.command);
    assert.equal(first.replayed, false);
    assert.equal(f.wallet.balancePoints, 125n);
    assert.equal(f.wallet.revision, 1n);
    assert.match(f.locks[0]!, /loyalty_members.*FOR UPDATE/);
    f.member.status = "BLOCKED";
    const replay = await f.service.creditInTransaction(f.tx, f.command);
    assert.equal(replay.replayed, true);
    assert.equal(replay.operation, first.operation);
    assert.equal(f.operations.size, 1);
    await assert.rejects(
      f.service.creditInTransaction(f.tx, {
        ...f.command,
        operationKey: "another",
      }),
      ConflictException,
    );
  });

  it("rejects key reuse with changed amounts, source, rules, date, member, or kind", async () => {
    const f = fixture();
    await f.service.creditInTransaction(f.tx, f.command);
    for (const patch of [
      { points: 26 },
      { sourceKey: "work:2" },
      { rulesVersion: "v2" },
      { occurredAt: new Date("2026-09-21") },
      { memberId: "other" },
    ]) {
      await assert.rejects(
        f.service.creditInTransaction(f.tx, { ...f.command, ...patch }),
        ConflictException,
      );
    }
    await assert.rejects(
      f.service.reverseInTransaction(f.tx, f.command),
      ConflictException,
    );
    assert.equal(f.wallet.balancePoints, 125n);
  });

  it("clips reversal at zero and records requested amount even when balance is empty", async () => {
    const f = fixture(10n);
    const first = await f.service.reverseInTransaction(f.tx, f.command);
    assert.equal(first.operation.requestedPoints, 25n);
    assert.equal(first.operation.balanceDelta, -10n);
    assert.equal(f.wallet.balancePoints, 0n);
    const next = await f.service.reverseInTransaction(f.tx, {
      ...f.command,
      operationKey: "reverse-2",
    });
    assert.equal(next.operation.balanceDelta, 0n);
    assert.equal(f.wallet.revision, 2n);
  });

  it("reserves without reducing balance and consumes even for a blocked member", async () => {
    const f = fixture();
    const reserved = await f.service.reserveInTransaction(f.tx, f.reserve);
    assert.equal(f.wallet.balancePoints, 100n);
    assert.equal(f.wallet.reservedPoints, 50n);
    assert.equal(reserved.operation.reservedDelta, 50n);
    assert.match(f.locks[0]!, /orders.*FOR UPDATE/);
    assert.match(f.locks[1]!, /loyalty_members.*FOR UPDATE/);
    f.member.status = "BLOCKED";
    f.member.historyState = "FAILED";
    assert.equal(
      (await f.service.reserveInTransaction(f.tx, f.reserve)).replayed,
      true,
    );
    const consumed = await f.service.consumeInTransaction(f.tx, f.settle);
    assert.equal(f.wallet.balancePoints, 50n);
    assert.equal(f.wallet.reservedPoints, 0n);
    assert.equal(consumed.operation.balanceDelta, -50n);
    assert.equal(f.reservations.get(f.order.id)?.status, "CONSUMED");
    assert.equal(
      (await f.service.consumeInTransaction(f.tx, f.settle)).replayed,
      true,
    );
    await assert.rejects(
      f.service.releaseInTransaction(f.tx, {
        ...f.settle,
        operationKey: "release-1",
      }),
      ConflictException,
    );
    assert.equal(f.wallet.revision, 2n);
  });

  it("releases reservations, retries safely, and rejects late consume or second reserve", async () => {
    const f = fixture();
    await f.service.reserveInTransaction(f.tx, f.reserve);
    await assert.rejects(
      f.service.reserveInTransaction(f.tx, {
        ...f.reserve,
        operationKey: "reserve-2",
      }),
      ConflictException,
    );
    f.member.status = "BLOCKED";
    const command = { ...f.settle, operationKey: "release-1" };
    await f.service.releaseInTransaction(f.tx, command);
    assert.equal(f.wallet.balancePoints, 100n);
    assert.equal(f.wallet.reservedPoints, 0n);
    assert.equal(
      (await f.service.releaseInTransaction(f.tx, command)).replayed,
      true,
    );
    await assert.rejects(
      f.service.consumeInTransaction(f.tx, f.settle),
      ConflictException,
    );
  });

  it("never reverses reserved funds or reserves unavailable balance", async () => {
    const f = fixture();
    await f.service.reserveInTransaction(f.tx, f.reserve);
    await assert.rejects(
      f.service.reverseInTransaction(f.tx, { ...f.command, points: 100 }),
      ConflictException,
    );
    assert.equal(f.wallet.balancePoints, 100n);
    assert.equal(f.wallet.reservedPoints, 50n);
    await assert.rejects(
      f.service.reserveInTransaction(f.tx, {
        ...f.reserve,
        orderId: "order-2",
        operationKey: "reserve-2",
        points: 51,
      }),
      ConflictException,
    );
  });

  it("does not trust guest email-linked ownership and rejects unready or paid orders", async () => {
    for (const state of [
      "guest",
      "pending",
      "blocked",
      "paid",
      "paidAt",
      "cancelled",
    ]) {
      const f = fixture();
      if (state === "guest") f.order.checkoutActorUserId = null;
      if (state === "pending") f.member.historyState = "PENDING";
      if (state === "blocked") f.member.status = "BLOCKED";
      if (state === "paid") f.order.paymentStatus = "PAID";
      if (state === "paidAt") f.order.paidAt = new Date();
      if (state === "cancelled") f.order.crmStatus = "CANCELLED";
      await assert.rejects(
        f.service.reserveInTransaction(f.tx, f.reserve),
        ConflictException,
      );
      assert.equal(f.operations.size, 0);
    }
  });

  it("rejects invalid values and overflow instead of rounding", async () => {
    const f = fixture();
    for (const points of [
      0,
      -1,
      1.1,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await assert.rejects(
        f.service.creditInTransaction(f.tx, { ...f.command, points }),
        BadRequestException,
      );
    }
    for (const patch of [
      { operationKey: " " },
      { sourceKey: " trailing " },
      { rulesVersion: "v".repeat(65) },
      { occurredAt: new Date(NaN) },
    ]) {
      await assert.rejects(
        f.service.creditInTransaction(f.tx, { ...f.command, ...patch }),
        BadRequestException,
      );
    }
    f.wallet.balancePoints = BigInt(Number.MAX_SAFE_INTEGER);
    await assert.rejects(
      f.service.creditInTransaction(f.tx, f.command),
      ConflictException,
    );
    f.wallet.balancePoints = 0n;
    f.wallet.revision = BigInt(Number.MAX_SAFE_INTEGER);
    await assert.rejects(
      f.service.creditInTransaction(f.tx, f.command),
      ConflictException,
    );
    assert.equal(f.operations.size, 0);
  });
});
