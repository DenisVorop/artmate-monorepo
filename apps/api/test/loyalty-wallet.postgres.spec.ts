import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  EnrollLoyaltyDTO,
  LoyaltyHistoryDTO,
  LoyaltyOverviewDTO,
} from "../src/loyalty/dto";
import { LoyaltyMembershipService } from "../src/loyalty/membership.service";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import type { PrismaService } from "../src/prisma/prisma.service";

// Opt-in isolated database only; never inherit runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;

describe(
  "loyalty PostgreSQL transactions",
  { skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set" },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
    const wallet = new LoyaltyWalletService();
    const occurredAt = new Date("2026-09-20T12:00:00.000Z");

    before(async () => {
      const url = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
      assert.match(url.pathname, /^\/artmate_loyalty_test[a-z0-9_]*$/);
      assert.equal(url.search, "");
      first = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.toString() }),
      });
      second = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.toString() }),
      });
      await Promise.all([first.$connect(), second.$connect()]);
    });
    after(async () => {
      await Promise.all([first?.$disconnect(), second?.$disconnect()]);
    });

    function command(memberId: string, points: number, label = randomUUID()) {
      return {
        memberId,
        points,
        operationKey: `test:${label}`,
        sourceKey: `source:${label}`,
        rulesVersion: "test-v1",
        occurredAt,
      };
    }
    async function member() {
      const user = await first.user.create({ data: {} });
      return first.loyaltyMember.create({
        data: {
          userId: user.id,
          termsVersion: "loyalty-v1",
          historyState: "READY",
          wallet: { create: {} },
        },
      });
    }
    async function order(userId: string, guest = false) {
      return first.order.create({
        data: {
          id: `loy-${randomUUID().slice(0, 24)}`,
          cartId: randomUUID(),
          userId,
          checkoutActorUserId: guest ? null : userId,
          customerName: "QA",
          customerEmail: "qa@example.test",
          customerPhone: "+70000000000",
          pickupPointId: "test",
          pickupPointTitle: "test",
          pickupPointAddress: "test",
          pickupPointWorkHours: "test",
          deliveryPrice: 0,
          paymentRedirectUrl: "",
          itemsCount: 1,
          subtotal: 100,
          total: 100,
        },
      });
    }
    const balance = (memberId: string) =>
      first.loyaltyWallet.findUniqueOrThrow({ where: { memberId } });

    it("enrolls only explicitly and serializes concurrent enrollment without resetting consent or balance", async () => {
      const user = await first.user.create({ data: {} });
      const a = new LoyaltyMembershipService(first as unknown as PrismaService);
      const b = new LoyaltyMembershipService(
        second as unknown as PrismaService,
      );
      assert.equal((await a.getMine(user.id)).enrolled, false);
      assert.equal(
        await first.loyaltyMember.count({ where: { userId: user.id } }),
        0,
      );
      await assert.rejects(
        a.enroll(user.id, {
          acceptedTerms: false as never,
          termsVersion: "loyalty-v1",
        }),
      );
      await assert.rejects(
        a.enroll(user.id, { acceptedTerms: true, termsVersion: "old" }),
      );
      const input = {
        acceptedTerms: true as const,
        termsVersion: "loyalty-v1",
      };
      const [left, right] = await Promise.all([
        a.enroll(user.id, input),
        b.enroll(user.id, input),
      ]);
      assert.deepEqual(left, right);
      assert.equal(left.member?.historyState, "pending");
      assert.equal(left.member?.wallet.balancePoints, 0);
      assert.equal(
        validateSync(plainToInstance(LoyaltyOverviewDTO, left), {
          whitelist: true,
          forbidNonWhitelisted: true,
        }).length,
        0,
      );
      const id = left.member!.id;
      await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, command(id, 25)),
      );
      assert.equal(
        (await a.enroll(user.id, input)).member?.wallet.balancePoints,
        25,
      );
      const pendingOrder = await order(user.id);
      await assert.rejects(
        first.$transaction((tx) =>
          wallet.reserveInTransaction(tx, {
            ...command(id, 10),
            orderId: pendingOrder.id,
          }),
        ),
      );
      await first.user.update({
        where: { id: user.id },
        data: { status: "BLOCKED" },
      });
      await assert.rejects(a.getMine(user.id));
      await assert.rejects(a.enroll(user.id, input));
    });

    it("applies concurrent identical credits once and rejects a changed payload", async () => {
      const m = await member();
      const input = command(m.id, 25);
      const results = await Promise.all([
        first.$transaction((tx) => wallet.creditInTransaction(tx, input)),
        second.$transaction((tx) => wallet.creditInTransaction(tx, input)),
      ]);
      assert.equal(results[0].operation.id, results[1].operation.id);
      assert.equal(results.filter((r) => r.replayed).length, 1);
      await assert.rejects(
        first.$transaction((tx) =>
          wallet.creditInTransaction(tx, { ...input, points: 50 }),
        ),
      );
      assert.equal((await balance(m.id)).balancePoints, 25n);
      assert.equal((await balance(m.id)).revision, 1n);
    });

    it("rolls back both wallet and ledger on a caller failure and on a cross-member key collision", async () => {
      const a = await member();
      const b = await member();
      const input = command(a.id, 100);
      await assert.rejects(
        first.$transaction(async (tx) => {
          await wallet.creditInTransaction(tx, input);
          throw new Error("rollback test");
        }),
        /rollback test/,
      );
      assert.equal((await balance(a.id)).revision, 0n);
      assert.equal(
        await first.loyaltyOperation.count({ where: { memberId: a.id } }),
        0,
      );
      const results = await Promise.allSettled([
        first.$transaction((tx) => wallet.creditInTransaction(tx, input)),
        second.$transaction((tx) =>
          wallet.creditInTransaction(tx, { ...input, memberId: b.id }),
        ),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (await balance(a.id)).balancePoints +
          (await balance(b.id)).balancePoints,
        100n,
      );
    });

    it("does not overspend across concurrent orders or accept guest-linked ownership", async () => {
      const m = await member();
      await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, command(m.id, 100)),
      );
      const a = await order(m.userId);
      const b = await order(m.userId);
      const results = await Promise.allSettled([
        first.$transaction((tx) =>
          wallet.reserveInTransaction(tx, {
            ...command(m.id, 70),
            orderId: a.id,
          }),
        ),
        second.$transaction((tx) =>
          wallet.reserveInTransaction(tx, {
            ...command(m.id, 70),
            orderId: b.id,
          }),
        ),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal((await balance(m.id)).reservedPoints, 70n);
      const guest = await order(m.userId, true);
      await assert.rejects(
        first.$transaction((tx) =>
          wallet.reserveInTransaction(tx, {
            ...command(m.id, 10),
            orderId: guest.id,
          }),
        ),
      );
      const peer = await member();
      const foreign = await order(peer.userId);
      await assert.rejects(
        first.$transaction((tx) =>
          wallet.reserveInTransaction(tx, {
            ...command(m.id, 10),
            orderId: foreign.id,
          }),
        ),
      );
      assert.equal((await balance(m.id)).reservedPoints, 70n);
    });

    it("settles a reservation once under a consume/release race and keeps terminal retries idempotent", async () => {
      const m = await member();
      const o = await order(m.userId);
      await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, command(m.id, 100)),
      );
      const reserve = { ...command(m.id, 70), orderId: o.id };
      await first.$transaction((tx) =>
        wallet.reserveInTransaction(tx, reserve),
      );
      await first.loyaltyMember.update({
        where: { id: m.id },
        data: { status: "BLOCKED" },
      });
      const consume = { ...command(m.id, 70), orderId: o.id };
      const release = { ...command(m.id, 70), orderId: o.id };
      const results = await Promise.allSettled([
        first.$transaction((tx) => wallet.consumeInTransaction(tx, consume)),
        second.$transaction((tx) => wallet.releaseInTransaction(tx, release)),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const reservation = await first.loyaltyReservation.findUniqueOrThrow({
        where: { orderId: o.id },
      });
      const replay =
        reservation.status === "CONSUMED"
          ? await first.$transaction((tx) =>
              wallet.consumeInTransaction(tx, consume),
            )
          : await first.$transaction((tx) =>
              wallet.releaseInTransaction(tx, release),
            );
      assert.equal(replay.replayed, true);
      assert.equal((await balance(m.id)).reservedPoints, 0n);
      assert.equal(
        (await balance(m.id)).balancePoints,
        reservation.status === "CONSUMED" ? 30n : 100n,
      );
      assert.equal((await balance(m.id)).revision, 3n);
      assert.equal(
        (
          await first.$transaction((tx) =>
            wallet.reserveInTransaction(tx, reserve),
          )
        ).replayed,
        true,
      );
    });

    it("clips reversals at zero, records zero corrections and never consumes future credit on retry", async () => {
      const m = await member();
      await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, command(m.id, 25)),
      );
      const input = command(m.id, 100);
      assert.equal(
        (
          await first.$transaction((tx) =>
            wallet.reverseInTransaction(tx, input),
          )
        ).operation.balanceDelta,
        -25n,
      );
      const zero = command(m.id, 100);
      assert.equal(
        (
          await first.$transaction((tx) =>
            wallet.reverseInTransaction(tx, zero),
          )
        ).operation.balanceDelta,
        0n,
      );
      await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, command(m.id, 25)),
      );
      await first.$transaction((tx) => wallet.reverseInTransaction(tx, input));
      await first.$transaction((tx) => wallet.reverseInTransaction(tx, zero));
      assert.equal((await balance(m.id)).balancePoints, 25n);
      assert.equal((await balance(m.id)).revision, 4n);
    });

    it("rejects corrections conflicting with an active hold without losing the correction key", async () => {
      const m = await member();
      const o = await order(m.userId);
      await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, command(m.id, 100)),
      );
      await first.$transaction((tx) =>
        wallet.reserveInTransaction(tx, {
          ...command(m.id, 80),
          orderId: o.id,
        }),
      );
      const reversal = command(m.id, 50);
      await assert.rejects(
        first.$transaction((tx) => wallet.reverseInTransaction(tx, reversal)),
      );
      assert.equal(
        await first.loyaltyOperation.findUnique({
          where: { operationKey: reversal.operationKey },
        }),
        null,
      );
      await first.$transaction((tx) =>
        wallet.releaseInTransaction(tx, {
          ...command(m.id, 80),
          orderId: o.id,
        }),
      );
      await first.$transaction((tx) =>
        wallet.reverseInTransaction(tx, reversal),
      );
      assert.equal((await balance(m.id)).balancePoints, 50n);
    });

    it("serves private cursor history and enforces immutable ledger and wallet consistency in PostgreSQL", async () => {
      const m = await member();
      const other = await member();
      const firstCredit = await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, command(m.id, 25)),
      );
      await first.$transaction((tx) =>
        wallet.creditInTransaction(tx, command(m.id, 50)),
      );
      const membership = new LoyaltyMembershipService(
        first as unknown as PrismaService,
      );
      const page = await membership.listOperations(m.userId, { limit: 1 });
      assert.equal(page.items[0]!.sequence, 2);
      assert.equal(page.nextCursor, "2");
      assert.equal(
        validateSync(plainToInstance(LoyaltyHistoryDTO, page), {
          whitelist: true,
          forbidNonWhitelisted: true,
        }).length,
        0,
      );
      assert.equal(
        (
          await membership.listOperations(m.userId, {
            cursor: page.nextCursor!,
            limit: 1,
          })
        ).items[0]!.sequence,
        1,
      );
      assert.deepEqual(
        await membership.listOperations(other.userId, { cursor: "2" }),
        { items: [], nextCursor: null },
      );
      await assert.rejects(
        membership.listOperations(m.userId, { cursor: "9007199254740992" }),
      );
      await assert.rejects(
        first.loyaltyOperation.update({
          where: { id: firstCredit.operation.id },
          data: { sourceKey: "changed" },
        }),
      );
      await assert.rejects(
        first.loyaltyOperation.delete({
          where: { id: firstCredit.operation.id },
        }),
      );
      await assert.rejects(
        first.loyaltyWallet.update({
          where: { memberId: m.id },
          data: { balancePoints: 999 },
        }),
      );
      assert.equal((await balance(m.id)).balancePoints, 75n);
      const spoofed = plainToInstance(EnrollLoyaltyDTO, {
        acceptedTerms: true,
        termsVersion: "loyalty-v1",
        userId: other.userId,
      });
      assert.ok(
        validateSync(spoofed, { whitelist: true, forbidNonWhitelisted: true })
          .length > 0,
      );
    });
  },
);
