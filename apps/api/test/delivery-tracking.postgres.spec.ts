import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import {
  TrackingStorage,
  type TrackingLease,
} from "../src/delivery-tracking/tracking.storage";
import { OrdersStorage } from "../src/orders/orders.storage";
import { publishTrackingRequest } from "../src/orders/delivery-status/publish-tracking-request";
import type { PrismaService } from "../src/prisma/prisma.service";

// Explicit opt-in: never use the application's DATABASE_URL.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.DELIVERY_TRACKING_TEST_DATABASE_URL;

describe(
  "delivery tracking PostgreSQL transactions",
  {
    skip: databaseUrl
      ? false
      : "DELIVERY_TRACKING_TEST_DATABASE_URL is not set",
  },
  () => {
    let db: PrismaClient;
    let other: PrismaClient;
    let tracking: TrackingStorage;
    let orders: OrdersStorage;

    before(async () => {
      const url = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
      assert.match(url.pathname, /^\/artmate_delivery_test_[a-z0-9_]+$/);
      assert.equal(url.search, "");
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: databaseUrl }),
      });
      other = new PrismaClient({
        adapter: new PrismaPg({ connectionString: databaseUrl }),
      });
      tracking = new TrackingStorage(db as unknown as PrismaService);
      orders = new OrdersStorage(
        db as unknown as PrismaService,
        {} as never,
        {} as never,
        {} as never,
        {
          recordCompletionInTransaction: async (
            tx: Prisma.TransactionClient,
            orderId: string,
          ) => {
            await tx.$executeRaw`INSERT INTO delivery_test_effects (order_id) VALUES (${orderId})`;
          },
        } as never,
        {} as never,
      );
      await db.$executeRawUnsafe(
        "CREATE TABLE IF NOT EXISTS delivery_test_effects (order_id TEXT PRIMARY KEY)",
      );
      await db.user.create({ data: { id: "test-admin", roles: ["ADMIN"] } });
    });

    after(async () => {
      await Promise.all([db?.$disconnect(), other?.$disconnect()]);
    });
    beforeEach(async () => {
      await db.orderDeliveryCompletionReceipt.deleteMany();
      await db.deliveryCompletionEvent.deleteMany();
      await db.deliveryTrackingObservation.deleteMany();
      await db.deliveryTrackingRequest.deleteMany();
      await db.orderHistory.deleteMany();
      await db.notificationJob.deleteMany();
      await db.order.deleteMany();
      await db.$executeRawUnsafe("DELETE FROM delivery_test_effects");
    });

    async function seed(numbers = ["01-2-3", "01-2-4"]) {
      const order = await db.order.create({
        data: {
          id: `test-${randomUUID().slice(0, 12)}`,
          cartId: "test-cart",
          customerName: "Test",
          customerEmail: "test@example.invalid",
          customerPhone: "000",
          deliveryProvider: "OZON",
          ozonPostingNumbers: numbers,
          crmStatus: "DELIVERING",
          status: "PAID",
          paymentStatus: "PAID",
          paidAt: new Date(),
          pickupPointId: "point",
          pickupPointTitle: "point",
          pickupPointAddress: "test",
          pickupPointWorkHours: "",
          deliveryPrice: 0,
          paymentRedirectUrl: "",
          itemsCount: 0,
          subtotal: 0,
          total: 0,
        },
      });
      await db.$transaction(async (tx) => {
        await publishTrackingRequest(tx, order);
      });
      return order;
    }

    async function claim() {
      const lease = await tracking.claimNext();
      assert.ok(lease);
      return lease;
    }

    async function delivered(lease: TrackingLease) {
      return tracking.settle(
        lease,
        lease.externalNumbers.map((externalNumber) => ({
          externalNumber,
          state: "delivered",
        })),
      );
    }

    async function notifications(tx: Prisma.TransactionClient) {
      await tx.notificationJob.create({
        data: { channel: "EMAIL", payload: { test: true } },
      });
    }

    it("leases once across replicas, recovers expiration and rejects the old worker", async () => {
      await seed();
      const second = new TrackingStorage(other as unknown as PrismaService);
      const leases = await Promise.all([
        tracking.claimNext(),
        second.claimNext(),
      ]);
      assert.equal(leases.filter(Boolean).length, 1);
      const initial = leases.find(Boolean)!;
      await db.deliveryTrackingObservation.update({
        where: { orderId: initial.orderId },
        data: { lockedUntil: new Date(0) },
      });
      const replacement = await claim();
      assert.notEqual(initial.leaseToken, replacement.leaseToken);
      assert.equal(await delivered(initial), false);
      assert.equal(await delivered(replacement), true);
      assert.equal(await db.deliveryCompletionEvent.count(), 1);
    });

    it("never publishes completion for missing, partial, cancelled, unknown or failed checks", async () => {
      const order = await seed();
      for (const state of ["in_transit", "cancelled", "unknown"] as const) {
        const lease = await claim();
        await tracking.settle(lease, [
          { externalNumber: "01-2-3", state: "delivered" },
          { externalNumber: "01-2-4", state },
        ]);
        assert.equal(await db.deliveryCompletionEvent.count(), 0);
        assert.equal(await tracking.claimNext(), null);
        await db.deliveryTrackingObservation.update({
          where: { orderId: order.id },
          data: { nextCheckAt: new Date(0) },
        });
      }
      for (const states of [
        null,
        [{ externalNumber: "01-2-3", state: "delivered" as const }],
        [
          { externalNumber: "01-2-3", state: "delivered" as const },
          { externalNumber: "01-2-3", state: "delivered" as const },
        ],
      ]) {
        await tracking.settle(await claim(), states);
        assert.equal(await db.deliveryCompletionEvent.count(), 0);
        await db.deliveryTrackingObservation.update({
          where: { orderId: order.id },
          data: { nextCheckAt: new Date(0) },
        });
      }
      await delivered(await claim());
      assert.equal(await db.deliveryCompletionEvent.count(), 1);
      assert.equal(await tracking.claimNext(), null);
    });

    it("changing the saved list invalidates in-flight checks and old completion events", async () => {
      const order = await seed();
      const oldLease = await claim();
      await orders.updateAdminOrderOzonPostings(
        order.id,
        ["01-2-5"],
        "test-admin",
      );
      assert.equal(await delivered(oldLease), false);
      const lease = await claim();
      await delivered(lease);
      await orders.updateAdminOrderOzonPostings(
        order.id,
        ["01-2-6"],
        "test-admin",
      );
      assert.equal(
        await orders.applyDeliveryCompletion(lease.revision, notifications),
        false,
      );
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
          .crmStatus,
        "DELIVERING",
      );
      assert.equal(await db.notificationJob.count(), 0);
    });

    it("completes once under concurrent retries and commits history, effects and notifications together", async () => {
      const order = await seed();
      const lease = await claim();
      await delivered(lease);
      const results = await Promise.all([
        orders.applyDeliveryCompletion(lease.revision, notifications),
        orders.applyDeliveryCompletion(lease.revision, notifications),
      ]);
      assert.deepEqual(results.sort(), [false, true]);
      const stored = await db.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(stored.crmStatus, "COMPLETED");
      assert.equal(stored.paymentStatus, "PAID");
      assert.ok(stored.completedAt);
      assert.equal(
        await db.orderHistory.count({
          where: { orderId: order.id, eventType: "status_changed" },
        }),
        1,
      );
      assert.equal(await db.notificationJob.count(), 1);
      assert.equal(await db.orderDeliveryCompletionReceipt.count(), 1);
      assert.deepEqual(
        await db.$queryRaw`SELECT order_id FROM delivery_test_effects`,
        [{ order_id: order.id }],
      );
      assert.equal(
        (
          await db.deliveryTrackingRequest.findUniqueOrThrow({
            where: { orderId: order.id },
          })
        ).enabled,
        false,
      );
    });

    it("rolls back a failed consumer and retries the persisted delivery fact", async () => {
      const order = await seed();
      const lease = await claim();
      await delivered(lease);
      await assert.rejects(
        orders.applyDeliveryCompletion(lease.revision, async (tx) => {
          await notifications(tx);
          throw new Error("simulated failure");
        }),
        /simulated failure/,
      );
      assert.equal(await db.deliveryCompletionEvent.count(), 1);
      assert.equal(await db.orderDeliveryCompletionReceipt.count(), 0);
      assert.equal(await db.notificationJob.count(), 0);
      assert.deepEqual(
        await db.$queryRaw`SELECT order_id FROM delivery_test_effects`,
        [],
      );
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
          .crmStatus,
        "DELIVERING",
      );
      assert.equal(
        await orders.applyDeliveryCompletion(lease.revision, notifications),
        true,
      );
    });

    it("does not complete a cancelled, unpaid, empty or no-longer-delivering order", async () => {
      for (const data of [
        { crmStatus: "CANCELLED" as const },
        { crmStatus: "PAID" as const },
        { paymentStatus: "PENDING" as const },
        { ozonPostingNumbers: [] },
      ]) {
        const order = await seed();
        const lease = await claim();
        await delivered(lease);
        await db.order.update({ where: { id: order.id }, data });
        assert.equal(
          await orders.applyDeliveryCompletion(lease.revision, notifications),
          false,
        );
      }
      assert.equal(await db.notificationJob.count(), 0);
    });

    it("enables tracking on entering delivery and disables it on cancellation", async () => {
      const order = await seed();
      await orders.updateAdminOrderStatus(order.id, "paid", "test-admin");
      assert.equal(await tracking.claimNext(), null);
      await orders.updateAdminOrderStatus(order.id, "delivering", "test-admin");
      const lease = await claim();
      await orders.updateAdminOrderStatus(order.id, "cancelled", "test-admin");
      assert.equal(await delivered(lease), false);
      assert.equal(await tracking.claimNext(), null);
    });

    it("does not allow the same shipment to be assigned concurrently to two orders", async () => {
      const first = await seed([]);
      const second = await seed([]);
      const results = await Promise.allSettled([
        orders.updateAdminOrderOzonPostings(first.id, ["99-1-1"], "test-admin"),
        orders.updateAdminOrderOzonPostings(
          second.id,
          ["99-1-1"],
          "test-admin",
        ),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        results.filter((result) => result.status === "rejected").length,
        1,
      );
    });
  },
);
