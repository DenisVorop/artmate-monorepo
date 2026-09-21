import { ConflictException } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";

/** Read only published order/refund facts; checkout never grants rewards. */
export async function readPublishedPurchaseSpend(
  tx: Prisma.TransactionClient,
  input: { excludeOrderId?: string; userId: string },
) {
  if (!input.userId) {
    throw new ConflictException("Invalid buyer for purchase spending");
  }
  const rows = await tx.$queryRaw<
    Array<{ spendKopecks: string; invalid: boolean }>
  >(Prisma.sql`
    WITH received AS (
      SELECT id, currency, total * 100 AS total_cash, delivery_price * 100 AS delivery_cash
      FROM orders
      WHERE user_id = ${input.userId}
        ${input.excludeOrderId === undefined ? Prisma.empty : Prisma.sql`AND id <> ${input.excludeOrderId}`}
        AND payment_status::text = 'paid' AND paid_at IS NOT NULL
        AND crm_status::text = 'completed' AND completed_at IS NOT NULL
    ), refunded AS (
      SELECT r.order_id,
        sum(r.total_kopecks::numeric - r.delivery_kopecks::numeric) AS item_cash,
        sum(r.delivery_kopecks::numeric) AS delivery_cash,
        sum(r.total_kopecks::numeric) AS total_cash,
        bool_or(r.total_kopecks IS NULL OR r.delivery_kopecks IS NULL OR r.total_kopecks < 0 OR r.delivery_kopecks < 0 OR r.delivery_kopecks > r.total_kopecks) AS invalid
      FROM order_refunds r JOIN received o ON o.id = r.order_id
      GROUP BY r.order_id
    )
    SELECT trunc(coalesce(sum(o.total_cash - o.delivery_cash - coalesce(r.item_cash, 0)), 0))::text AS "spendKopecks",
      coalesce(bool_or(
        o.currency IS DISTINCT FROM 'RUB' OR o.total_cash IS NULL OR o.delivery_cash IS NULL
        OR o.total_cash < 0 OR o.delivery_cash < 0 OR o.delivery_cash > o.total_cash
        OR trunc(o.total_cash) <> o.total_cash OR trunc(o.delivery_cash) <> o.delivery_cash
        OR coalesce(r.invalid, false)
        OR coalesce(r.item_cash, 0) > o.total_cash - o.delivery_cash
        OR coalesce(r.delivery_cash, 0) > o.delivery_cash
        OR coalesce(r.total_cash, 0) > o.total_cash
      ), false) AS invalid
    FROM received o LEFT JOIN refunded r ON r.order_id = o.id
  `);
  const result = rows[0];
  if (
    rows.length !== 1 ||
    !result ||
    result.invalid !== false ||
    typeof result.spendKopecks !== "string" ||
    !/^\d+$/.test(result.spendKopecks)
  ) {
    throw new ConflictException(
      "Received order spending facts are inconsistent",
    );
  }
  return BigInt(result.spendKopecks);
}
