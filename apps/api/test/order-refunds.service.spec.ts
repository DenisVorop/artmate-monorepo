import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ConflictException } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";

import { AffiliateFinancialAccountingService } from "../src/affiliate/financial-accounting.service";
import { ResponseValidationInterceptor } from "../src/common/response-validation.interceptor";
import {
  AffiliateLedgerEntryKind,
  OrderCrmStatus,
  OrderPaymentStatus,
} from "../src/generated/prisma/client";
import { OrderRefundsService } from "../src/orders/refunds/order-refunds.service";
import { OrderRefundsDTO } from "../src/orders/dto";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("OrderRefundsService", () => {
  it("projects refundable groups before the next refund", async () => {
    const fixture = createFixture();

    const initial = await fixture.service.getOrderRefunds(fixture.order.id);
    assert.deepEqual(initial.items[0]?.remainingPriceGroups, [
      { unitPriceKopecks: 90, quantity: 3 },
    ]);
    assert.equal(initial.items[0]?.refundableKopecks, 270);
    assert.equal(
      fixture.transactionOptions[0]?.isolationLevel,
      "RepeatableRead",
    );
    assert.deepEqual(fixture.transactionModes, ["SET TRANSACTION READ ONLY"]);
    const validated = await firstValueFrom(
      new ResponseValidationInterceptor(OrderRefundsDTO).intercept(
        {
          switchToHttp: () => ({
            getRequest: () => ({ headers: {} }),
            getResponse: () => ({
              setHeader: () => undefined,
              statusCode: 200,
            }),
          }),
        } as never,
        { handle: () => of(initial) },
      ),
    );
    assert.ok(validated && !Array.isArray(validated));
    assert.equal(validated.orderId, fixture.order.id);

    const partial = await fixture.service.createOrderRefund(
      fixture.order.id,
      request(
        "00000000-0000-4000-8000-000000000000",
        "preview-parity",
        [{ productId: "product-1", quantity: 1 }],
        0,
      ),
      "admin-1",
    );
    assert.deepEqual(partial.items[0]?.remainingPriceGroups, [
      { unitPriceKopecks: 90, quantity: 2 },
    ]);
    assert.equal(partial.items[0]?.refundableKopecks, 180);
    assert.equal(partial.refunds[0]?.items[0]?.amountKopecks, 90);
  });

  it("records delivery-only then partial and full returns without rounding drift", async () => {
    const fixture = createFixture();

    const delivery = await fixture.service.createOrderRefund(
      fixture.order.id,
      request("00000000-0000-4000-8000-000000000001", "delivery", [], 50),
      "admin-1",
    );
    assert.equal(delivery.refunds[0]?.reversedCommissionKopecks, 0);
    assert.equal(delivery.delivery.returnedKopecks, 50);

    const partial = await fixture.service.createOrderRefund(
      fixture.order.id,
      request(
        "00000000-0000-4000-8000-000000000002",
        "partial",
        [{ productId: "product-1", quantity: 1 }],
        0,
      ),
      "admin-1",
    );
    assert.equal(partial.items[0]?.returnedQuantity, 1);
    assert.equal(partial.refunds[0]?.items[0]?.amountKopecks, 90);
    assert.deepEqual(
      partial.refunds.map((refund) => refund.reference),
      ["partial", "delivery"],
    );
    assert.equal(partial.commission?.reversedKopecks, 10);

    const full = await fixture.service.createOrderRefund(
      fixture.order.id,
      request(
        "00000000-0000-4000-8000-000000000003",
        "full",
        [{ productId: "product-1", quantity: 2 }],
        50,
      ),
      "admin-1",
    );
    assert.equal(full.items[0]?.remainingQuantity, 0);
    assert.equal(full.items[0]?.refundableKopecks, 0);
    assert.equal(full.delivery.refundableKopecks, 0);
    assert.equal(full.totalRefundedKopecks, 370);
    assert.equal(full.commission?.reversedKopecks, 30);
    assert.equal(full.commission?.remainingKopecks, 0);
    assert.equal(full.commission?.status, "reversed");
    assert.equal(fixture.history.length, 3);
  });

  it("makes matching request retries idempotent and rejects conflicting identifiers", async () => {
    const fixture = createFixture();
    const input = request(
      "00000000-0000-4000-8000-000000000010",
      "operation-10",
      [{ productId: "product-1", quantity: 1 }],
      0,
    );
    await fixture.service.createOrderRefund(fixture.order.id, input, "admin-1");
    await fixture.service.createOrderRefund(fixture.order.id, input, "admin-1");
    assert.equal(fixture.order.refunds.length, 1);
    assert.equal(fixture.order.affiliateCommission.ledgerEntries.length, 2);

    await assert.rejects(
      fixture.service.createOrderRefund(
        fixture.order.id,
        { ...input, reason: "different" },
        "admin-1",
      ),
      ConflictException,
    );
    await assert.rejects(
      fixture.service.createOrderRefund(
        fixture.order.id,
        request(
          "00000000-0000-4000-8000-000000000011",
          "operation-10",
          [{ productId: "product-1", quantity: 1 }],
          0,
        ),
        "admin-1",
      ),
      ConflictException,
    );
  });

  it("rejects merchandise and delivery over-refunds", async () => {
    const fixture = createFixture();
    await assert.rejects(
      fixture.service.createOrderRefund(
        fixture.order.id,
        request(
          "00000000-0000-4000-8000-000000000012",
          "too-many-items",
          [{ productId: "product-1", quantity: 4 }],
          0,
        ),
        "admin-1",
      ),
      ConflictException,
    );
    await assert.rejects(
      fixture.service.createOrderRefund(
        fixture.order.id,
        request(
          "00000000-0000-4000-8000-000000000013",
          "too-much-delivery",
          [],
          101,
        ),
        "admin-1",
      ),
      ConflictException,
    );
    assert.equal(fixture.order.refunds.length, 0);
  });

  it("allows a paid refund before completion but keeps commission pending", async () => {
    const fixture = createFixture();
    const result = await fixture.service.createOrderRefund(
      fixture.order.id,
      request(
        "00000000-0000-4000-8000-000000000020",
        "before-completion",
        [{ productId: "product-1", quantity: 1 }],
        0,
      ),
      "admin-1",
    );

    assert.equal(result.commission?.completedAt, null);
    assert.equal(result.commission?.availableAt, null);
    assert.equal(result.commission?.status, "pending");
  });

  it("blocks recording when persisted receipt group totals are malformed", async () => {
    const fixture = createFixture();
    fixture.order.promoPricingSnapshot.items[0]!.priceGroups[0]!.totalKopecks = 269;

    const projection = await fixture.service.getOrderRefunds(fixture.order.id);
    assert.equal(projection.canRecord, false);
    assert.match(projection.blockedReason ?? "", /повреждены/iu);
    await assert.rejects(
      fixture.service.createOrderRefund(
        fixture.order.id,
        request(
          "00000000-0000-4000-8000-000000000030",
          "malformed",
          [{ productId: "product-1", quantity: 1 }],
          0,
        ),
        "admin-1",
      ),
    );
  });

  it("blocks well-typed pricing snapshots inconsistent with the persisted order", async () => {
    const corruptions = [
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.order.promoPricingSnapshot.items[0]!.totalKopecks = 271;
      },
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.order.promoPricingSnapshot.totalKopecks = 271;
      },
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.order.promoPricingSnapshot.items[0]!.unitPriceKopecks = 101;
      },
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.order.total = { toString: () => "3.71" };
      },
    ];

    for (const corrupt of corruptions) {
      const fixture = createFixture();
      corrupt(fixture);
      const projection = await fixture.service.getOrderRefunds(
        fixture.order.id,
      );
      assert.equal(projection.canRecord, false);
      assert.match(projection.blockedReason ?? "", /повреждены/iu);
    }
  });
});

function request(
  requestId: string,
  reference: string,
  items: Array<{ productId: string; quantity: number }>,
  deliveryKopecks: number,
) {
  return {
    requestId,
    reference,
    reason: "Возврат подтверждён оператором",
    items,
    deliveryKopecks,
    confirmed: true,
  };
}

type FixtureRefundItem = {
  amountKopecks: bigint;
  productId: string;
  quantity: number;
  refundId: string;
  title: string;
};

type FixtureLedgerEntry = {
  amountKopecks: bigint;
  id: string;
  kind: AffiliateLedgerEntryKind;
  refundId: string | null;
};

type FixtureRefund = {
  author: { id: string; name: string | null };
  authorId: string;
  createdAt: Date;
  deliveryKopecks: bigint;
  id: string;
  items: FixtureRefundItem[];
  ledgerEntry: FixtureLedgerEntry | null;
  orderId: string;
  reason: string;
  reference: string;
  requestFingerprint: string;
  requestId: string;
  totalKopecks: bigint;
};

type RefundCreateData = Omit<
  FixtureRefund,
  "author" | "createdAt" | "id" | "items" | "ledgerEntry"
> & {
  items: {
    create: Array<Omit<FixtureRefundItem, "refundId">>;
  };
};

type LedgerCreateData = Omit<FixtureLedgerEntry, "id"> & {
  commissionId: string;
  operationKey: string;
  orderId: string;
  partnerId: string;
};

function createFixture() {
  let nextRefundId = 1;
  const history: unknown[] = [];
  const transactionOptions: Array<{ isolationLevel?: string }> = [];
  const transactionModes: string[] = [];
  const order = {
    id: "order-1",
    promoCode: "ARTM-SAVED",
    promoPricingSnapshot: {
      subtotalKopecks: 300,
      discountKopecks: 30,
      totalKopecks: 270,
      items: [
        {
          id: "product-1",
          unitPriceKopecks: 100,
          quantity: 3,
          subtotalKopecks: 300,
          discountKopecks: 30,
          totalKopecks: 270,
          priceGroups: [
            { unitPriceKopecks: 90, quantity: 3, totalKopecks: 270 },
          ],
        },
      ],
    },
    paymentStatus: OrderPaymentStatus.PAID,
    crmStatus: OrderCrmStatus.PAID,
    completedAt: null as Date | null,
    deliveryPrice: { toString: () => "1.00" },
    subtotal: { toString: () => "3.00" },
    discount: { toString: () => "0.30" },
    total: { toString: () => "3.70" },
    items: [
      {
        productId: "product-1",
        title: "Product",
        quantity: 3,
        price: { toString: () => "1.00" },
        lineTotal: { toString: () => "3.00" },
        createdAt: new Date(),
      },
    ],
    refunds: [] as FixtureRefund[],
    affiliateCommission: {
      id: "commission-1",
      orderId: "order-1",
      partnerId: "partner-1",
      partnerPercent: 10,
      buyerPercent: 10,
      isSelfPurchase: false,
      subtotalKopecks: 300n,
      earnedKopecks: 30n,
      itemSnapshot: [
        {
          id: "product-1",
          quantity: 3,
          subtotalKopecks: 300,
          commissionKopecks: 30,
        },
      ],
      availableAt: null,
      ledgerEntries: [
        {
          id: "credit-1",
          kind: AffiliateLedgerEntryKind.CREDIT,
          amountKopecks: 30n,
          refundId: null,
        },
      ] as FixtureLedgerEntry[],
    },
  };
  const tx = {
    $queryRaw: async () => [{ id: order.id }],
    $executeRawUnsafe: async (statement: string) => {
      transactionModes.push(statement);
      return 0;
    },
    order: { findUnique: async () => sortedOrder() },
    orderRefund: {
      create: async ({ data }: { data: RefundCreateData }) => {
        const refund = {
          id: `refund-${nextRefundId++}`,
          ...data,
          createdAt: new Date("2026-09-16T00:00:00.000Z"),
          author: { id: data.authorId, name: "Admin" },
          items: data.items.create.map((item) => ({
            ...item,
            refundId: `refund-${nextRefundId - 1}`,
          })),
          ledgerEntry: null,
        };
        order.refunds.push(refund);
        return refund;
      },
    },
    affiliateLedgerEntry: {
      findUnique: async ({ where }: { where: { refundId: string } }) =>
        order.affiliateCommission.ledgerEntries.find(
          (entry) => entry.refundId === where.refundId,
        ) ?? null,
      create: async ({ data }: { data: LedgerCreateData }) => {
        const entry = { id: `entry-${data.refundId}`, ...data };
        order.affiliateCommission.ledgerEntries.push(entry);
        const refund = order.refunds.find((item) => item.id === data.refundId);
        if (refund) refund.ledgerEntry = entry;
        return entry;
      },
    },
    orderHistory: {
      create: async ({ data }: { data: unknown }) => history.push(data),
    },
  };
  const sortedOrder = () => ({
    ...order,
    refunds: [...order.refunds].sort((left, right) =>
      left.createdAt.getTime() === right.createdAt.getTime()
        ? right.id.localeCompare(left.id)
        : right.createdAt.getTime() - left.createdAt.getTime(),
    ),
  });
  const prisma = {
    $transaction: async (
      callback: (client: typeof tx) => unknown,
      options?: { isolationLevel?: string },
    ) => {
      transactionOptions.push(options ?? {});
      return callback(tx);
    },
    order: { findUnique: async () => sortedOrder() },
  } as unknown as PrismaService;
  const accounting = new AffiliateFinancialAccountingService();
  const service = new OrderRefundsService(prisma, accounting);
  return { history, order, service, transactionModes, transactionOptions };
}
