import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import { deriveAffiliatePayoutBalance } from "./payout-balance";

type BalanceRow = {
  gross_available_kopecks: unknown;
  pending_kopecks: unknown;
  held_kopecks: unknown;
  reversed_kopecks: unknown;
  min_remaining_kopecks: unknown;
  inconsistent_commission_count: unknown;
  reserved_kopecks: unknown;
  paid_kopecks: unknown;
  inconsistent_payout_count: unknown;
};

@Injectable()
export class AffiliatePayoutBalanceService {
  async calculateInTransaction(
    tx: Prisma.TransactionClient,
    partnerId: string,
  ) {
    const [row] = await tx.$queryRaw<BalanceRow[]>(balanceQuery(partnerId));
    if (!row) throw new Error("Affiliate balance query returned no aggregate row");
    const minRemaining = integer(row.min_remaining_kopecks, "Affiliate remaining balance");
    if (minRemaining < 0n) throw new RangeError("Affiliate remaining balance is negative");
    if (
      integer(row.inconsistent_commission_count, "Inconsistent commission count") !== 0n ||
      integer(row.inconsistent_payout_count, "Inconsistent payout count") !== 0n
    ) {
      throw new Error("Affiliate financial ledger is inconsistent");
    }
    return {
      ...deriveAffiliatePayoutBalance({
        grossAvailableKopecks: integer(row.gross_available_kopecks, "Gross available balance"),
        reservedKopecks: integer(row.reserved_kopecks, "Reserved balance"),
        paidKopecks: integer(row.paid_kopecks, "Paid balance"),
      }),
      pendingKopecks: safeNonnegative(row.pending_kopecks, "Pending balance"),
      heldKopecks: safeNonnegative(row.held_kopecks, "Held balance"),
      reversedKopecks: safeNonnegative(row.reversed_kopecks, "Reversed balance"),
    };
  }
}

function balanceQuery(partnerId: string) {
  return Prisma.sql`
    WITH commission_state AS (
      SELECT c."earned_kopecks", c."available_at", o."completed_at",
        o."payment_status"::text AS "payment_status", o."crm_status"::text AS "crm_status",
        COUNT(*) FILTER (WHERE le."kind"::text = 'credit')::bigint AS "credit_count",
        COALESCE(SUM(le."amount_kopecks") FILTER (WHERE le."kind"::text = 'credit'), 0)::bigint AS "credited_kopecks",
        COALESCE(SUM(-le."amount_kopecks") FILTER (WHERE le."kind"::text = 'reversal'), 0)::bigint AS "reversed_kopecks"
      FROM "affiliate_commissions" c
      JOIN "orders" o ON o."id" = c."order_id"
      LEFT JOIN "affiliate_ledger_entries" le ON le."commission_id" = c."id"
        AND le."partner_id" = ${partnerId}
      WHERE c."partner_id" = ${partnerId}
      GROUP BY c."id", o."id"
    ), classified AS (
      SELECT *, ("credited_kopecks" - "reversed_kopecks")::bigint AS "remaining_kopecks",
        CASE
          WHEN "earned_kopecks" = 0 THEN 'not_earned'
          WHEN "reversed_kopecks" >= "earned_kopecks" THEN 'reversed'
          WHEN ("payment_status" <> 'paid' OR "crm_status" <> 'completed')
            AND ("completed_at" IS NOT NULL OR "crm_status" = 'cancelled') THEN 'held'
          WHEN "completed_at" IS NULL OR "available_at" IS NULL OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') < "available_at" THEN 'pending'
          WHEN "payment_status" = 'paid' AND "crm_status" = 'completed' THEN 'available'
          ELSE 'pending'
        END AS "commission_status"
      FROM commission_state
    ), commission_totals AS (
      SELECT
        COALESCE(SUM("remaining_kopecks") FILTER (WHERE "commission_status" = 'available' AND "remaining_kopecks" > 0), 0)::bigint AS "gross_available_kopecks",
        COALESCE(SUM("remaining_kopecks") FILTER (WHERE "commission_status" = 'pending' AND "remaining_kopecks" > 0), 0)::bigint AS "pending_kopecks",
        COALESCE(SUM("remaining_kopecks") FILTER (WHERE "commission_status" = 'held' AND "remaining_kopecks" > 0), 0)::bigint AS "held_kopecks",
        COALESCE(SUM("reversed_kopecks"), 0)::bigint AS "reversed_kopecks",
        COALESCE(MIN("remaining_kopecks"), 0)::bigint AS "min_remaining_kopecks",
        COUNT(*) FILTER (WHERE "credit_count" <> 1 OR "credited_kopecks" <> "earned_kopecks")::bigint AS "inconsistent_commission_count"
      FROM classified
    ), payout_journal AS (
      SELECT j."payout_id",
        COUNT(*) FILTER (WHERE j."kind"::text = 'reserve')::bigint AS "reserve_count",
        COUNT(*) FILTER (WHERE j."kind"::text = 'release')::bigint AS "release_count",
        COUNT(*) FILTER (WHERE j."kind"::text = 'pay')::bigint AS "pay_count",
        COALESCE(SUM(j."amount_kopecks") FILTER (WHERE j."kind"::text = 'reserve'), 0)::bigint AS "reserve_amount",
        COALESCE(SUM(j."amount_kopecks") FILTER (WHERE j."kind"::text = 'release'), 0)::bigint AS "release_amount",
        COALESCE(SUM(j."amount_kopecks") FILTER (WHERE j."kind"::text = 'pay'), 0)::bigint AS "pay_amount"
      FROM "affiliate_payout_journal_entries" j
      WHERE j."partner_id" = ${partnerId}
      GROUP BY j."payout_id"
    ), payout_event_state AS (
      SELECT e."payout_id",
        COUNT(*) FILTER (WHERE e."status"::text = 'pending')::bigint AS "pending_event_count",
        COUNT(*) FILTER (WHERE e."status"::text = 'paid')::bigint AS "paid_event_count",
        COUNT(*) FILTER (WHERE e."status"::text = 'rejected')::bigint AS "rejected_event_count",
        COUNT(*) FILTER (WHERE e."status"::text = 'cancelled')::bigint AS "cancelled_event_count"
      FROM "affiliate_payout_events" e
      WHERE e."partner_id" = ${partnerId}
      GROUP BY e."payout_id"
    ), payout_state AS (
      SELECT p."id", p."status"::text AS "payout_status", p."amount_kopecks",
        COALESCE(j."reserve_count", 0)::bigint AS "reserve_count",
        COALESCE(j."release_count", 0)::bigint AS "release_count",
        COALESCE(j."pay_count", 0)::bigint AS "pay_count",
        COALESCE(j."reserve_amount", 0)::bigint AS "reserve_amount",
        COALESCE(j."release_amount", 0)::bigint AS "release_amount",
        COALESCE(j."pay_amount", 0)::bigint AS "pay_amount",
        COALESCE(e."pending_event_count", 0)::bigint AS "pending_event_count",
        COALESCE(e."paid_event_count", 0)::bigint AS "paid_event_count",
        COALESCE(e."rejected_event_count", 0)::bigint AS "rejected_event_count",
        COALESCE(e."cancelled_event_count", 0)::bigint AS "cancelled_event_count"
      FROM "affiliate_payouts" p
      LEFT JOIN payout_journal j ON j."payout_id" = p."id"
      LEFT JOIN payout_event_state e ON e."payout_id" = p."id"
      WHERE p."partner_id" = ${partnerId}
    ), payout_totals AS (
      SELECT
        COALESCE(SUM("amount_kopecks") FILTER (WHERE "payout_status" = 'pending'), 0)::bigint AS "reserved_kopecks",
        COALESCE(SUM("amount_kopecks") FILTER (WHERE "payout_status" = 'paid'), 0)::bigint AS "paid_kopecks",
        COUNT(*) FILTER (WHERE NOT (
          "reserve_count" = 1 AND "reserve_amount" = "amount_kopecks" AND "pending_event_count" = 1
          AND (("payout_status" = 'pending' AND "release_count" = 0 AND "pay_count" = 0 AND "paid_event_count" = 0 AND "rejected_event_count" = 0 AND "cancelled_event_count" = 0)
            OR ("payout_status" = 'paid' AND "release_count" = 0 AND "pay_count" = 1 AND "pay_amount" = "amount_kopecks" AND "paid_event_count" = 1 AND "rejected_event_count" = 0 AND "cancelled_event_count" = 0)
            OR ("payout_status" = 'rejected' AND "release_count" = 1 AND "release_amount" = "amount_kopecks" AND "pay_count" = 0 AND "paid_event_count" = 0 AND "rejected_event_count" = 1 AND "cancelled_event_count" = 0)
            OR ("payout_status" = 'cancelled' AND "release_count" = 1 AND "release_amount" = "amount_kopecks" AND "pay_count" = 0 AND "paid_event_count" = 0 AND "rejected_event_count" = 0 AND "cancelled_event_count" = 1))
        ))::bigint AS "inconsistent_payout_count"
      FROM payout_state
    )
    SELECT commission_totals.*, payout_totals.* FROM commission_totals CROSS JOIN payout_totals
  `;
}

function integer(value: unknown, label: string) {
  try {
    return typeof value === "bigint" ? value : BigInt(String(value));
  } catch {
    throw new TypeError(`${label} is not an integer`);
  }
}

function safeNonnegative(value: unknown, label: string) {
  const result = integer(value, label);
  if (result < 0n) throw new RangeError(`${label} is negative`);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${label} exceeds safe integer range`);
  return Number(result);
}
