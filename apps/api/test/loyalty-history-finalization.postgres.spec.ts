import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { LoyaltyHistoryFinalizationService } from "../src/loyalty/history-finalization.service";
import { LoyaltyHistoryPreviewService } from "../src/loyalty/history-preview.service";
import { LoyaltyPurchaseHistoryService } from "../src/loyalty/purchase-history.service";
import { LoyaltyPurchaseSettlementService } from "../src/loyalty/purchase-settlement.service";
import { LoyaltyWalletService } from "../src/loyalty/wallet.service";
import type { PrismaService } from "../src/prisma/prisma.service";

// Explicit isolated local database only. Never fall back to runtime DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;

describe(
  "loyalty history finalization in PostgreSQL",
  { skip: databaseUrl ? false : "LOYALTY_TEST_DATABASE_URL is not set" },
  () => {
    let first: PrismaClient;
    let second: PrismaClient;
    const wallet = new LoyaltyWalletService();

    before(async () => {
      const url = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
      assert.equal(url.port, "55439");
      assert.match(url.pathname, /^\/artmate_loyalty_test(?:_[a-z0-9_]+)?$/);
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

    const preview = (client = first) =>
      new LoyaltyHistoryPreviewService(client as unknown as PrismaService);
    const history = (client = first) =>
      new LoyaltyPurchaseHistoryService(
        client as unknown as PrismaService,
        preview(client),
        new LoyaltyPurchaseSettlementService(
          client as unknown as PrismaService,
          wallet,
        ),
      );
    const finalizer = (client = first) =>
      new LoyaltyHistoryFinalizationService(
        client as unknown as PrismaService,
        preview(client),
      );

    async function member(
      options: {
        historyState?: "PENDING" | "READY" | "FAILED";
        status?: "ACTIVE" | "BLOCKED";
        userStatus?: "ACTIVE" | "BLOCKED";
      } = {},
    ) {
      const user = await first.user.create({
        data: { status: options.userStatus ?? "ACTIVE" },
      });
      const loyaltyMember = await first.loyaltyMember.create({
        data: {
          userId: user.id,
          termsVersion: "loyalty-v1",
          historyState: options.historyState ?? "PENDING",
          status: options.status ?? "ACTIVE",
          wallet: { create: {} },
        },
      });
      return { user, member: loyaltyMember };
    }

    it("moves an empty synchronized history to READY once", async () => {
      const fixture = await member();

      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: false,
      });
      const waiting = await first.loyaltyHistorySync.findUniqueOrThrow({
        where: { memberId: fixture.member.id },
      });
      assert.equal(waiting.completedAt, null);
      assert.equal(waiting.attempts, 0);
      assert.equal(waiting.lastError, null);

      assert.deepEqual(await history().processMember(fixture.member.id), {
        processed: true,
        orders: 0,
      });
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: true,
      });
      const completed = await first.loyaltyHistorySync.findUniqueOrThrow({
        where: { memberId: fixture.member.id },
      });
      assert.ok(completed.completedAt);
      assert.equal(completed.lastError, null);
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: false,
        ready: true,
      });
    });

    it("does not process blocked, failed or inactive identities", async () => {
      const fixtures = [
        await member({ status: "BLOCKED" }),
        await member({ historyState: "FAILED" }),
        await member({ userStatus: "BLOCKED" }),
      ];

      for (const fixture of fixtures) {
        assert.deepEqual(await finalizer().processMember(fixture.member.id), {
          processed: false,
          ready: false,
        });
        assert.equal(
          (
            await first.loyaltyMember.findUniqueOrThrow({
              where: { id: fixture.member.id },
            })
          ).historyState,
          fixture.member.historyState,
        );
      }
    });

    it("serializes concurrent finalizers to at most one actual READY transition", async () => {
      const fixture = await member();
      await history().processMember(fixture.member.id);

      const results = await Promise.all([
        finalizer(first).processMember(fixture.member.id),
        finalizer(second).processMember(fixture.member.id),
      ]);
      assert.equal(
        results.filter((result) => result.processed && result.ready).length,
        1,
      );
      assert.ok(results.every((result) => result.ready || !result.processed));
      assert.equal(
        (
          await first.loyaltyMember.findUniqueOrThrow({
            where: { id: fixture.member.id },
          })
        ).historyState,
        "READY",
      );
      assert.ok(
        (
          await first.loyaltyHistorySync.findUniqueOrThrow({
            where: { memberId: fixture.member.id },
          })
        ).completedAt,
      );
    });

    it("does not trust an old checkpoint when the current preview is incomplete", async () => {
      const fixture = await member();
      await history().processMember(fixture.member.id);
      const reader = preview();
      const report = await reader.previewMember(fixture.member.id);
      reader.previewMemberInTransaction = async () => ({
        ...report,
        complete: false,
      });
      const service = new LoyaltyHistoryFinalizationService(
        first as unknown as PrismaService,
        reader,
      );
      assert.deepEqual(await service.processMember(fixture.member.id), {
        processed: true,
        ready: false,
      });
      assert.equal(
        (
          await first.loyaltyMember.findUniqueOrThrow({
            where: { id: fixture.member.id },
          })
        ).historyState,
        "PENDING",
      );
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: true,
      });
    });

    it("retries reader failures without exposing details or modifying the wallet", async () => {
      const fixture = await member();
      await history().processMember(fixture.member.id);
      const reader = preview();
      reader.previewMemberInTransaction = async () => {
        throw new Error("PRIVATE source failure");
      };
      const service = new LoyaltyHistoryFinalizationService(
        first as unknown as PrismaService,
        reader,
      );
      await assert.rejects(
        service.processMember(fixture.member.id),
        /PRIVATE source failure/,
      );
      const failed = await first.loyaltyHistorySync.findUniqueOrThrow({
        where: { memberId: fixture.member.id },
      });
      assert.equal(failed.attempts, 1);
      assert.equal(failed.lastError, "history_finalization_failed");
      assert.equal(failed.completedAt, null);
      assert.ok(failed.nextAttemptAt > failed.updatedAt);
      assert.equal(
        await first.loyaltyOperation.count({
          where: { memberId: fixture.member.id },
        }),
        0,
      );
      assert.deepEqual(await finalizer().processMember(fixture.member.id), {
        processed: true,
        ready: true,
      });
      assert.equal(
        (
          await first.loyaltyHistorySync.findUniqueOrThrow({
            where: { memberId: fixture.member.id },
          })
        ).lastError,
        null,
      );
    });
  },
);
