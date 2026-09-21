import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { AffiliatePayoutBalanceService } from "../src/affiliate/affiliate-payout-balance.service";
import { AffiliatePayoutsService } from "../src/affiliate/affiliate-payouts.service";
import { AffiliateFinancialAccountingService } from "../src/affiliate/financial-accounting.service";
import { PrismaClient } from "../src/generated/prisma/client";
import { createOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";
import type { PrismaService } from "../src/prisma/prisma.service";
import { calculatePromoPricing } from "../src/promocodes/pricing";

// This opt-in test URL is intentionally isolated from application runtime env.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.AFFILIATE_PAYOUT_TEST_DATABASE_URL;

describe("affiliate payout PostgreSQL concurrency", () => {
  it(
    "serializes create, retry, pay, reject and refund across real connections",
    { skip: databaseUrl ? false : "AFFILIATE_PAYOUT_TEST_DATABASE_URL is not set" },
    async () => {
      const safeUrl = requireIsolatedDatabaseUrl(databaseUrl!);
      const first = client(safeUrl);
      const second = client(safeUrl);
      await Promise.all([first.$connect(), second.$connect()]);
      const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
      const partnerUserId = `pay-partner-${suffix}`;
      const secondPartnerUserId = `pay-peer-${suffix}`;
      const adminUserId = `pay-admin-${suffix}`;
      const partnerId = `pay-partner-${suffix}`;
      const secondPartnerId = `pay-peer-${suffix}`;
      const orderId = `pay-order-${suffix}`;
      const commissionId = `pay-commission-${suffix}`;
      const partner = {
        id: partnerUserId,
        provider: "credentials" as const,
        providerUserId: `${suffix}@example.test`,
        roles: ["partner" as const],
      };
      const admin = {
        id: adminUserId,
        provider: "credentials" as const,
        providerUserId: `admin-${suffix}@example.test`,
        roles: ["admin" as const],
      };
      const peer = {
        id: secondPartnerUserId,
        provider: "credentials" as const,
        providerUserId: `peer-${suffix}@example.test`,
        roles: ["partner" as const],
      };
      try {
        await seed(first, { adminUserId, commissionId, orderId, partnerId, partnerUserId, secondPartnerId, secondPartnerUserId, suffix });
        await addMatureCredit(first, {
          orderId: `peer-order-${suffix}`,
          commissionId: `peer-commission-${suffix}`,
          partnerId: secondPartnerId,
          amount: 1_000_000,
        });
        const firstBalance = new AffiliatePayoutBalanceService();
        const secondBalance = new AffiliatePayoutBalanceService();
        const firstPayouts = new AffiliatePayoutsService(first as unknown as PrismaService, firstBalance);
        const secondPayouts = new AffiliatePayoutsService(second as unknown as PrismaService, secondBalance);

        const competing = await Promise.allSettled([
          firstPayouts.createOwnPayout(partner, { requestId: randomUUID(), amountKopecks: 500_000 }),
          secondPayouts.createOwnPayout(partner, { requestId: randomUUID(), amountKopecks: 600_000 }),
        ]);
        assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal(competing.filter((result) => result.status === "rejected").length, 1);
        const firstOpen = await first.affiliatePayout.findFirstOrThrow({ where: { partnerId, status: "PENDING" } });
        await firstPayouts.reject(partnerUserId, firstOpen.id, { requestId: randomUUID(), reason: "race cleanup" }, admin);

        const retryId = randomUUID();
        const identical = await Promise.all([
          firstPayouts.createOwnPayout(partner, { requestId: retryId, amountKopecks: 400_000 }),
          secondPayouts.createOwnPayout(partner, { requestId: retryId, amountKopecks: 400_000 }),
        ]);
        assert.equal(identical[0].id, identical[1].id);
        await firstPayouts.reject(partnerUserId, identical[0].id, { requestId: randomUUID(), reason: "retry verified" }, admin);

        const ownerPayout = await firstPayouts.createOwnPayout(partner, { requestId: randomUUID(), amountKopecks: 100_000 });
        const peerPayout = await secondPayouts.createOwnPayout(peer, { requestId: randomUUID(), amountKopecks: 100_000 });
        const crossActors = await Promise.all([
          firstPayouts.markPaid(partnerUserId, ownerPayout.id, {
            requestId: randomUUID(), confirmed: true, paidAt: new Date().toISOString(), reference: `cross-a-${suffix}`,
          }, { ...peer, roles: ["admin"] }),
          secondPayouts.markPaid(secondPartnerUserId, peerPayout.id, {
            requestId: randomUUID(), confirmed: true, paidAt: new Date().toISOString(), reference: `cross-b-${suffix}`,
          }, { ...partner, roles: ["admin"] }),
        ]);
        assert.equal(crossActors.every((payout) => payout.status === "paid"), true);

        const collision = await firstPayouts.createOwnPayout(partner, { requestId: randomUUID(), amountKopecks: 300_000 });
        const transition = await Promise.allSettled([
          firstPayouts.markPaid(partnerUserId, collision.id, {
            requestId: randomUUID(), confirmed: true, paidAt: new Date().toISOString(), reference: `transition-${suffix}`,
          }, admin),
          secondPayouts.reject(partnerUserId, collision.id, { requestId: randomUUID(), reason: "transition race" }, admin),
        ]);
        assert.equal(transition.filter((result) => result.status === "fulfilled").length, 1);
        const collisionState = await first.affiliatePayout.findUniqueOrThrow({ where: { id: collision.id } });
        assert.notEqual(collisionState.status, "PENDING");

        const refundFirst = await seedScenarioPartner(first, suffix, "rf");
        const refundFirstAuth = authUser(refundFirst.userId);
        const refundFirstPayout = await firstPayouts.createOwnPayout(refundFirstAuth, {
          requestId: randomUUID(), amountKopecks: 600_000,
        });
        assert.deepEqual(await currentBalance(first, firstBalance, refundFirst.partnerId), {
          availableKopecks: 400_000, reservedKopecks: 600_000, paidKopecks: 0,
          debtKopecks: 0, pendingKopecks: 0, heldKopecks: 0, reversedKopecks: 0,
        });
        let refundReady!: () => void;
        let releaseRefund!: () => void;
        const refundReadyPromise = new Promise<void>((resolve) => {
          refundReady = resolve;
        });
        const releaseRefundPromise = new Promise<void>((resolve) => {
          releaseRefund = resolve;
        });
        const refundFirstOperation = recordRefund(
          second,
          secondPayouts,
          adminUserId,
          refundFirst,
          suffix,
          "rf",
          { ready: refundReady, release: releaseRefundPromise },
        );
        await refundReadyPromise;
        const blockedPay = assert.rejects(
          firstPayouts.markPaid(refundFirst.userId, refundFirstPayout.id, {
            requestId: randomUUID(), confirmed: true, paidAt: new Date().toISOString(), reference: `rf-${suffix}`,
          }, admin),
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
        releaseRefund();
        await refundFirstOperation;
        await blockedPay;
        assert.equal(
          (await first.affiliatePayout.findUniqueOrThrow({ where: { id: refundFirstPayout.id } })).status,
          "CANCELLED",
        );
        assert.deepEqual(await currentBalance(first, firstBalance, refundFirst.partnerId), {
          availableKopecks: 200_000, reservedKopecks: 0, paidKopecks: 0,
          debtKopecks: 0, pendingKopecks: 0, heldKopecks: 0, reversedKopecks: 800_000,
        });

        const payFirst = await seedScenarioPartner(first, suffix, "pf");
        const payFirstAuth = authUser(payFirst.userId);
        const payFirstCreateRequestId = randomUUID();
        const payFirstPayout = await firstPayouts.createOwnPayout(payFirstAuth, {
          requestId: payFirstCreateRequestId, amountKopecks: 600_000,
        });
        await firstPayouts.markPaid(payFirst.userId, payFirstPayout.id, {
          requestId: randomUUID(), confirmed: true, paidAt: new Date().toISOString(), reference: `pf-${suffix}`,
        }, admin);
        const terminalRetry = await firstPayouts.createOwnPayout(payFirstAuth, {
          requestId: payFirstCreateRequestId, amountKopecks: 600_000,
        });
        assert.equal(terminalRetry.id, payFirstPayout.id);
        assert.equal(
          await first.affiliatePayout.count({ where: { partnerId: payFirst.partnerId } }),
          1,
        );
        await recordRefund(second, secondPayouts, adminUserId, payFirst, suffix, "pf");
        assert.deepEqual(await currentBalance(first, firstBalance, payFirst.partnerId), {
          availableKopecks: 0, reservedKopecks: 0, paidKopecks: 600_000,
          debtKopecks: 400_000, pendingKopecks: 0, heldKopecks: 0, reversedKopecks: 800_000,
        });
        await addMatureCredit(first, {
          orderId: `cov1-${suffix}`, commissionId: `cov1c-${suffix}`,
          partnerId: payFirst.partnerId, amount: 250_000,
        });
        assert.deepEqual(await currentBalance(first, firstBalance, payFirst.partnerId), {
          availableKopecks: 0, reservedKopecks: 0, paidKopecks: 600_000,
          debtKopecks: 150_000, pendingKopecks: 0, heldKopecks: 0, reversedKopecks: 800_000,
        });
        await addMatureCredit(first, {
          orderId: `cov2-${suffix}`, commissionId: `cov2c-${suffix}`,
          partnerId: payFirst.partnerId, amount: 200_000,
        });
        assert.deepEqual(await currentBalance(first, firstBalance, payFirst.partnerId), {
          availableKopecks: 50_000, reservedKopecks: 0, paidKopecks: 600_000,
          debtKopecks: 0, pendingKopecks: 0, heldKopecks: 0, reversedKopecks: 800_000,
        });

        const timestampRace = await seedScenarioPartner(first, suffix, "ts");
        const timestampRefundId = `tsr-${suffix}`;
        await insertRefund(
          second,
          adminUserId,
          timestampRace.orderId,
          timestampRefundId,
          suffix,
          "ts",
        );
        let orderLocked!: () => void;
        let releaseTimestampRefund!: () => void;
        const orderLockedPromise = new Promise<void>((resolve) => {
          orderLocked = resolve;
        });
        const releaseTimestampRefundPromise = new Promise<void>((resolve) => {
          releaseTimestampRefund = resolve;
        });
        const timestampAccounting = new AffiliateFinancialAccountingService(
          secondPayouts,
        );
        const oldTransactionRefund = second.$transaction(async (tx) => {
          await tx.$queryRawUnsafe(
            `SELECT "id" FROM "orders" WHERE "id" = '${timestampRace.orderId}' FOR UPDATE`,
          );
          orderLocked();
          await releaseTimestampRefundPromise;
          await timestampAccounting.recordRefundReversalInTransaction(tx, {
            commission: {
              id: timestampRace.commissionId,
              orderId: timestampRace.orderId,
              partnerId: timestampRace.partnerId,
              subtotalKopecks: 1_000_000n,
              earnedKopecks: 1_000_000n,
              itemSnapshot: [
                {
                  id: "item-1",
                  quantity: 10,
                  subtotalKopecks: 1_000_000,
                  commissionKopecks: 1_000_000,
                },
              ],
            },
            previousReturnedQuantities: [],
            nextReturnedQuantities: [{ id: "item-1", quantity: 8 }],
            refundId: timestampRefundId,
          });
        });
        await orderLockedPromise;
        const timestampPayout = await firstPayouts.createOwnPayout(
          authUser(timestampRace.userId),
          { requestId: randomUUID(), amountKopecks: 600_000 },
        );
        releaseTimestampRefund();
        await oldTransactionRefund;
        assert.equal(
          (
            await first.affiliatePayout.findUniqueOrThrow({
              where: { id: timestampPayout.id },
            })
          ).status,
          "CANCELLED",
        );
        assert.deepEqual(
          await currentBalance(first, firstBalance, timestampRace.partnerId),
          {
            availableKopecks: 200_000,
            reservedKopecks: 0,
            paidKopecks: 0,
            debtKopecks: 0,
            pendingKopecks: 0,
            heldKopecks: 0,
            reversedKopecks: 800_000,
          },
        );

        const pendingCount = await first.affiliatePayout.count({ where: { partnerId, status: "PENDING" } });
        assert.ok(pendingCount <= 1);
      } finally {
        await Promise.all([first.$disconnect(), second.$disconnect()]);
      }
    },
  );
});

function client(url: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

function requireIsolatedDatabaseUrl(value: string) {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("Payout PostgreSQL tests require a loopback database host");
  }
  const database = url.pathname.slice(1);
  if (!/(?:test|qa)/i.test(database)) {
    throw new Error("Payout PostgreSQL tests require a database name containing test or qa");
  }
  return value;
}

function authUser(userId: string) {
  return {
    id: userId,
    provider: "credentials" as const,
    providerUserId: `${userId}@example.test`,
    roles: ["partner" as const],
  };
}

async function currentBalance(client: PrismaClient, service: AffiliatePayoutBalanceService, partnerId: string) {
  return client.$transaction((tx) => service.calculateInTransaction(tx, partnerId));
}

async function seed(client: PrismaClient, ids: {
  adminUserId: string; commissionId: string; orderId: string; partnerId: string; partnerUserId: string;
  secondPartnerId: string; secondPartnerUserId: string; suffix: string;
}) {
  await client.$executeRawUnsafe(`
    INSERT INTO "users" ("id", "email", "roles", "status") VALUES
      ('${ids.partnerUserId}', '${ids.suffix}@example.test', ARRAY['customer', 'partner', 'admin']::"user_role"[], 'active'),
      ('${ids.secondPartnerUserId}', 'peer-${ids.suffix}@example.test', ARRAY['customer', 'partner', 'admin']::"user_role"[], 'active'),
      ('${ids.adminUserId}', 'admin-${ids.suffix}@example.test', ARRAY['customer', 'admin']::"user_role"[], 'active');
    INSERT INTO "affiliate_partners" (
      "id", "user_id", "status", "minimum_payout_kopecks", "contract_number", "contract_signed_at", "contract_payment_details", "contract_version"
    ) VALUES ('${ids.partnerId}', '${ids.partnerUserId}', 'active', 100000, 'QA-${ids.suffix}', '2026-01-01', 'QA only', 1);
    INSERT INTO "affiliate_partners" (
      "id", "user_id", "status", "minimum_payout_kopecks", "contract_number", "contract_signed_at", "contract_payment_details", "contract_version"
    ) VALUES ('${ids.secondPartnerId}', '${ids.secondPartnerUserId}', 'active', 100000, 'QA-PEER-${ids.suffix}', '2026-01-01', 'QA only', 1);
    INSERT INTO "orders" (
      "id", "cart_id", "status", "crm_status", "customer_name", "customer_phone", "customer_email",
      "delivery_provider", "pickup_point_id", "pickup_point_title", "pickup_point_address", "pickup_point_work_hours",
      "delivery_price", "payment_method", "payment_status", "payment_redirect_url", "items_count", "subtotal", "discount", "total", "paid_at", "completed_at"
    ) VALUES (
      '${ids.orderId}', 'qa-${ids.suffix}', 'paid', 'completed', 'QA', '+70000000000', '${ids.suffix}@example.test',
      'ozon', 'qa', 'QA', 'QA', 'QA', 0, 'bank_card_mock', 'paid', '', 1, 20000, 0, 20000, NOW() - interval '30 days', NOW() - interval '20 days'
    );
    INSERT INTO "affiliate_commissions" (
      "id", "order_id", "partner_id", "code_snapshot", "partner_percent", "buyer_percent", "is_self_purchase",
      "subtotal_kopecks", "earned_kopecks", "item_snapshot", "available_at", "created_at"
    ) VALUES (
      '${ids.commissionId}', '${ids.orderId}', '${ids.partnerId}', 'QA-${ids.suffix}', 15, 5, false,
      2000000, 2000000, '[{"id":"item-1","quantity":1,"subtotalKopecks":2000000,"commissionKopecks":2000000}]',
      NOW() - interval '6 days', NOW() - interval '20 days'
    );
    INSERT INTO "affiliate_ledger_entries" (
      "id", "commission_id", "order_id", "partner_id", "kind", "amount_kopecks", "operation_key", "created_at"
    ) VALUES ('credit-${ids.suffix}', '${ids.commissionId}', '${ids.orderId}', '${ids.partnerId}', 'credit', 2000000, 'qa:${ids.suffix}:credit', NOW() - interval '20 days');
  `);
}

async function addMatureCredit(client: PrismaClient, input: { orderId: string; commissionId: string; partnerId: string; amount: number }) {
  const suffix = createHash("sha256")
    .update(input.commissionId)
    .digest("hex")
    .slice(0, 12);
  await client.$executeRawUnsafe(`
    INSERT INTO "orders" (
      "id", "cart_id", "status", "crm_status", "customer_name", "customer_phone", "customer_email",
      "delivery_provider", "pickup_point_id", "pickup_point_title", "pickup_point_address", "pickup_point_work_hours",
      "delivery_price", "payment_method", "payment_status", "payment_redirect_url", "items_count", "subtotal", "discount", "total", "paid_at", "completed_at"
    ) VALUES (
      '${input.orderId}', 'cover-${suffix}', 'paid', 'completed', 'QA', '+70000000000', 'cover-${suffix}@example.test',
      'ozon', 'qa', 'QA', 'QA', 'QA', 0, 'bank_card_mock', 'paid', '', 1, 10000, 0, 10000, NOW() - interval '30 days', NOW() - interval '20 days'
    );
    INSERT INTO "affiliate_commissions" (
      "id", "order_id", "partner_id", "code_snapshot", "partner_percent", "buyer_percent", "is_self_purchase",
      "subtotal_kopecks", "earned_kopecks", "item_snapshot", "available_at", "created_at"
    ) VALUES (
      '${input.commissionId}', '${input.orderId}', '${input.partnerId}', 'COVER-${suffix}', 15, 5, false,
      ${input.amount}, ${input.amount}, '[{"id":"item-1","quantity":10,"subtotalKopecks":${input.amount},"commissionKopecks":${input.amount}}]', NOW() - interval '6 days', NOW() - interval '20 days'
    );
    INSERT INTO "affiliate_ledger_entries" (
      "id", "commission_id", "order_id", "partner_id", "kind", "amount_kopecks", "operation_key", "created_at"
    ) VALUES ('cover-credit-${suffix}', '${input.commissionId}', '${input.orderId}', '${input.partnerId}', 'credit', ${input.amount}, 'qa:${suffix}:cover', NOW() - interval '20 days');
  `);
}

async function seedScenarioPartner(client: PrismaClient, suffix: string, label: string) {
  const userId = `${label}u-${suffix}`;
  const partnerId = `${label}p-${suffix}`;
  const orderId = `${label}o-${suffix}`;
  const commissionId = `${label}c-${suffix}`;
  await client.$executeRawUnsafe(`
    INSERT INTO "users" ("id", "email", "roles", "status")
      VALUES ('${userId}', '${label}-${suffix}@example.test', ARRAY['customer', 'partner']::"user_role"[], 'active');
    INSERT INTO "affiliate_partners" (
      "id", "user_id", "status", "minimum_payout_kopecks", "contract_number", "contract_signed_at", "contract_payment_details", "contract_version"
    ) VALUES ('${partnerId}', '${userId}', 'active', 100000, '${label}-${suffix}', '2026-01-01', 'QA only', 1);
  `);
  await addMatureCredit(client, { orderId, commissionId, partnerId, amount: 1_000_000 });
  await client.$transaction(async (tx) => {
    await tx.orderItem.create({
      data: {
        orderId,
        productId: "item-1",
        title: "QA coloring",
        slug: "qa-coloring",
        image: "https://example.test/coloring.webp",
        price: "1000.00",
        quantity: 10,
        lineTotal: "10000.00",
      },
    });
    const pricingSnapshot = createOrderPricingSnapshot(
      calculatePromoPricing(
        [{ id: "item-1", unitPriceKopecks: 100_000, quantity: 10 }],
        { type: "fixed", amountKopecks: 0 },
      ),
      0,
    );
    await tx.order.update({
      where: { id: orderId },
      data: { itemsCount: 10, pricingSnapshot },
    });
  });
  return { userId, partnerId, orderId, commissionId };
}

async function recordRefund(
  client: PrismaClient,
  payouts: AffiliatePayoutsService,
  adminUserId: string,
  scenario: { partnerId: string; orderId: string; commissionId: string },
  suffix: string,
  label: string,
  barrier?: { ready: () => void; release: Promise<void> },
) {
  const refundId = `${label}r-${suffix}`;
  await insertRefund(
    client,
    adminUserId,
    scenario.orderId,
    refundId,
    suffix,
    label,
  );
  const accounting = new AffiliateFinancialAccountingService(payouts);
  await client.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT "id" FROM "orders" WHERE "id" = '${scenario.orderId}' FOR UPDATE`);
    await accounting.recordRefundReversalInTransaction(tx, {
      commission: {
        id: scenario.commissionId,
        orderId: scenario.orderId,
        partnerId: scenario.partnerId,
        subtotalKopecks: 1_000_000n,
        earnedKopecks: 1_000_000n,
        itemSnapshot: [{ id: "item-1", quantity: 10, subtotalKopecks: 1_000_000, commissionKopecks: 1_000_000 }],
      },
      previousReturnedQuantities: [],
      nextReturnedQuantities: [{ id: "item-1", quantity: 8 }],
      refundId,
    });
    barrier?.ready();
    await barrier?.release;
  });
}

async function insertRefund(
  client: PrismaClient,
  adminUserId: string,
  orderId: string,
  refundId: string,
  suffix: string,
  label: string,
) {
  await client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const refund = await tx.orderRefund.create({
      data: {
        id: refundId,
        orderId,
        authorId: adminUserId,
        requestId: randomUUID(),
        requestFingerprint: "b".repeat(64),
        reference: `${label}-refund-${suffix}`,
        reason: "ordered refund",
        deliveryKopecks: 0n,
        totalKopecks: 800_000n,
        loyaltyPoints: 0n,
        items: {
          create: {
            productId: "item-1",
            title: "QA coloring",
            quantity: 8,
            previousQuantity: 0,
            amountKopecks: 800_000n,
            loyaltyPoints: 0n,
          },
        },
      },
    });
    await tx.orderRefundEvent.create({
      data: { refundId: refund.id, occurredAt: refund.createdAt },
    });
  });
}
