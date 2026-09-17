import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import {
  AffiliatePartnerStatus,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  AffiliateAnalyticsQueryDTO,
  AffiliateLedgerQueryDTO,
} from "./dto";

const timeZone = "Europe/Moscow" as const;
const maxSignedInteger = 2_147_483_647;

type PeriodRow = { as_of: Date; period_start: Date };
type MetricsRow = {
  order_count: unknown;
  sales_kopecks: unknown;
  earned_kopecks: unknown;
  reversed_kopecks: unknown;
  net_kopecks: unknown;
};
type BalanceRow = {
  available_kopecks: unknown;
  pending_kopecks: unknown;
  held_kopecks: unknown;
  reversed_kopecks: unknown;
  min_remaining_kopecks: unknown;
  inconsistent_commission_count: unknown;
};
type DailyRow = MetricsRow & { date: string };
type CodeRow = MetricsRow & { code: string };
type CountRow = { total: unknown };
type LedgerRow = {
  id: string;
  code: string;
  kind: "credit" | "reversal";
  amount_kopecks: unknown;
  created_at: Date;
  available_at: Date | null;
  status: "pending" | "available" | "held" | "reversed" | "not_earned";
  hold_reason:
    | "order_cancelled"
    | "payment_not_confirmed"
    | "order_not_completed"
    | null;
  is_self_purchase: boolean;
  partner_percent: number;
  is_consistent: boolean;
};

@Injectable()
export class AffiliateAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  getOwnAnalytics(user: AuthUser, query: AffiliateAnalyticsQueryDTO) {
    this.assertPartnerRole(user);
    return this.getAnalytics(user.id, query, true);
  }

  getAdminAnalytics(userId: string, query: AffiliateAnalyticsQueryDTO) {
    return this.getAnalytics(userId, query, false);
  }

  getOwnLedger(user: AuthUser, query: AffiliateLedgerQueryDTO) {
    this.assertPartnerRole(user);
    return this.getLedger(user.id, query, true);
  }

  getAdminLedger(userId: string, query: AffiliateLedgerQueryDTO) {
    return this.getLedger(userId, query, false);
  }

  private async getAnalytics(
    userId: string,
    query: AffiliateAnalyticsQueryDTO,
    requireActive: boolean,
  ) {
    const offset = getOffset(query.codePage, query.codePageSize);

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const partnerId = await this.getPartnerId(tx, userId, requireActive);
        const period = await this.getPeriod(tx, query.days);
        const [balance] = await tx.$queryRaw<BalanceRow[]>(
          balanceQuery(partnerId, period.as_of),
        );
        const [totals] = await tx.$queryRaw<MetricsRow[]>(
          totalsQuery(partnerId, period.period_start, period.as_of),
        );
        const daily = await tx.$queryRaw<DailyRow[]>(
          dailyQuery(
            partnerId,
            query.days,
            period.period_start,
            period.as_of,
          ),
        );
        const codes = await tx.$queryRaw<CodeRow[]>(
          codesQuery(
            partnerId,
            period.period_start,
            period.as_of,
            query.codePageSize,
            offset,
          ),
        );
        const [codeCount] = await tx.$queryRaw<CountRow[]>(
          codeCountQuery(partnerId, period.period_start, period.as_of),
        );

        if (!balance || !totals || !codeCount) {
          throw new Error("Affiliate analytics query returned no aggregate row");
        }

        const minRemaining = toSafeInteger(
          balance.min_remaining_kopecks,
          "Affiliate remaining balance",
        );
        if (minRemaining < 0) {
          throw new RangeError("Affiliate remaining balance is negative");
        }
        if (
          toSafeNonnegativeInteger(
            balance.inconsistent_commission_count,
            "Inconsistent commission count",
          ) > 0
        ) {
          throw new Error("Affiliate commission ledger is inconsistent");
        }

        return {
          asOf: period.as_of.toISOString(),
          period: mapPeriod(query.days, period),
          balance: {
            availableKopecks: toSafeNonnegativeInteger(
              balance.available_kopecks,
              "Available balance",
            ),
            pendingKopecks: toSafeNonnegativeInteger(
              balance.pending_kopecks,
              "Pending balance",
            ),
            heldKopecks: toSafeNonnegativeInteger(
              balance.held_kopecks,
              "Held balance",
            ),
            reversedKopecks: toSafeNonnegativeInteger(
              balance.reversed_kopecks,
              "Reversed balance",
            ),
          },
          totals: mapMetrics(totals),
          daily: daily.map((row) => ({ date: row.date, ...mapMetrics(row) })),
          codes: {
            items: codes.map((row) => ({
              code: row.code,
              ...mapMetrics(row),
            })),
            total: toSafeNonnegativeInteger(codeCount.total, "Code total"),
            page: query.codePage,
            pageSize: query.codePageSize,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async getLedger(
    userId: string,
    query: AffiliateLedgerQueryDTO,
    requireActive: boolean,
  ) {
    const offset = getOffset(query.page, query.pageSize);

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const partnerId = await this.getPartnerId(tx, userId, requireActive);
        const period = await this.getPeriod(tx, query.days);
        const items = await tx.$queryRaw<LedgerRow[]>(
          ledgerQuery(
            partnerId,
            period.period_start,
            period.as_of,
            query.pageSize,
            offset,
          ),
        );
        const [count] = await tx.$queryRaw<CountRow[]>(
          ledgerCountQuery(partnerId, period.period_start, period.as_of),
        );

        if (!count) {
          throw new Error("Affiliate ledger query returned no aggregate row");
        }

        return {
          asOf: period.as_of.toISOString(),
          period: mapPeriod(query.days, period),
          items: items.map((row) => {
            assertConsistentLedgerRow(row);
            return {
              id: row.id,
              code: row.code,
              kind: row.kind,
              amountKopecks: toSafeInteger(
                row.amount_kopecks,
                "Ledger amount",
              ),
              createdAt: row.created_at.toISOString(),
              availableAt: row.available_at?.toISOString() ?? null,
              status: row.status,
              holdReason: row.hold_reason,
              isSelfPurchase: row.is_self_purchase,
              partnerPercent: row.partner_percent,
            };
          }),
          total: toSafeNonnegativeInteger(count.total, "Ledger total"),
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async getPartnerId(
    tx: Prisma.TransactionClient,
    userId: string,
    requireActive: boolean,
  ) {
    const partner = await tx.affiliatePartner.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });

    if (requireActive) {
      if (!partner || partner.status !== AffiliatePartnerStatus.ACTIVE) {
        throw new ForbiddenException("Active partner profile required");
      }
    } else if (!partner) {
      throw new NotFoundException("Affiliate partner not found");
    }

    return partner.id;
  }

  private async getPeriod(
    tx: Prisma.TransactionClient,
    days: 7 | 30 | 90,
  ) {
    const [period] = await tx.$queryRaw<PeriodRow[]>(Prisma.sql`
      SELECT
        CURRENT_TIMESTAMP AS "as_of",
        (((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Moscow')::date - ${days - 1}::integer)::timestamp
          AT TIME ZONE 'Europe/Moscow') AS "period_start"
    `);
    if (!period) throw new Error("Could not capture analytics period");
    return period;
  }

  private assertPartnerRole(user: AuthUser) {
    if (!user.roles.includes("partner")) {
      throw new ForbiddenException("Active partner profile required");
    }
  }
}

function balanceQuery(partnerId: string, asOf: Date) {
  return Prisma.sql`
    WITH commission_state AS (
      SELECT
        c."earned_kopecks",
        c."available_at",
        o."completed_at",
        o."payment_status"::text AS "payment_status",
        o."crm_status"::text AS "crm_status",
        COUNT(*) FILTER (
          WHERE le."kind"::text = 'credit'
        )::bigint AS "credit_count",
        COALESCE(SUM(le."amount_kopecks") FILTER (
          WHERE le."kind"::text = 'credit'
        ), 0)::bigint AS "credited_kopecks",
        COALESCE(SUM(-le."amount_kopecks") FILTER (
          WHERE le."kind"::text = 'reversal'
        ), 0)::bigint AS "reversed_kopecks"
      FROM "affiliate_commissions" c
      JOIN "orders" o ON o."id" = c."order_id"
      LEFT JOIN "affiliate_ledger_entries" le
        ON le."commission_id" = c."id"
        AND le."partner_id" = ${partnerId}
        AND le."created_at" <= ${utcTimestamp(asOf)}
      WHERE c."partner_id" = ${partnerId}
        AND c."created_at" <= ${utcTimestamp(asOf)}
      GROUP BY c."id", o."id"
    ), classified AS (
      SELECT *,
        ("credited_kopecks" - "reversed_kopecks")::bigint AS "remaining_kopecks",
        ${commissionStatusSql(asOf)} AS "status"
      FROM commission_state
    )
    SELECT
      COALESCE(SUM("remaining_kopecks") FILTER (
        WHERE "status" = 'available' AND "remaining_kopecks" > 0
      ), 0)::bigint AS "available_kopecks",
      COALESCE(SUM("remaining_kopecks") FILTER (
        WHERE "status" = 'pending' AND "remaining_kopecks" > 0
      ), 0)::bigint AS "pending_kopecks",
      COALESCE(SUM("remaining_kopecks") FILTER (
        WHERE "status" = 'held' AND "remaining_kopecks" > 0
      ), 0)::bigint AS "held_kopecks",
      COALESCE(SUM("reversed_kopecks"), 0)::bigint AS "reversed_kopecks",
      COALESCE(MIN("remaining_kopecks"), 0)::bigint AS "min_remaining_kopecks",
      COUNT(*) FILTER (
        WHERE "credit_count" <> 1 OR "credited_kopecks" <> "earned_kopecks"
      )::bigint AS "inconsistent_commission_count"
    FROM classified
  `;
}

function totalsQuery(partnerId: string, from: Date, asOf: Date) {
  return Prisma.sql`
    SELECT ${metricsSelect()}
    FROM "affiliate_ledger_entries" le
    JOIN "affiliate_commissions" c ON c."id" = le."commission_id"
    WHERE le."partner_id" = ${partnerId}
      AND le."created_at" >= ${utcTimestamp(from)}
      AND le."created_at" <= ${utcTimestamp(asOf)}
  `;
}

function dailyQuery(partnerId: string, days: number, from: Date, asOf: Date) {
  return Prisma.sql`
    WITH calendar AS (
      SELECT generate_series(
        ${moscowDate(from)},
        ${moscowDate(from)} + ${days - 1}::integer,
        interval '1 day'
      )::date AS "date"
    ), daily AS (
      SELECT
        ((le."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date AS "date",
        ${metricsSelect()}
      FROM "affiliate_ledger_entries" le
      JOIN "affiliate_commissions" c ON c."id" = le."commission_id"
      WHERE le."partner_id" = ${partnerId}
        AND le."created_at" >= ${utcTimestamp(from)}
        AND le."created_at" <= ${utcTimestamp(asOf)}
      GROUP BY 1
    )
    SELECT
      to_char(calendar."date", 'YYYY-MM-DD') AS "date",
      COALESCE(daily."order_count", 0)::bigint AS "order_count",
      COALESCE(daily."sales_kopecks", 0)::bigint AS "sales_kopecks",
      COALESCE(daily."earned_kopecks", 0)::bigint AS "earned_kopecks",
      COALESCE(daily."reversed_kopecks", 0)::bigint AS "reversed_kopecks",
      COALESCE(daily."net_kopecks", 0)::bigint AS "net_kopecks"
    FROM calendar
    LEFT JOIN daily USING ("date")
    ORDER BY calendar."date" ASC
  `;
}

function codesQuery(
  partnerId: string,
  from: Date,
  asOf: Date,
  limit: number,
  offset: number,
) {
  return Prisma.sql`
    SELECT c."code_snapshot" AS "code", ${metricsSelect()}
    FROM "affiliate_ledger_entries" le
    JOIN "affiliate_commissions" c ON c."id" = le."commission_id"
    WHERE le."partner_id" = ${partnerId}
      AND le."created_at" >= ${utcTimestamp(from)}
      AND le."created_at" <= ${utcTimestamp(asOf)}
    GROUP BY c."code_snapshot"
    ORDER BY c."code_snapshot" ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

function codeCountQuery(partnerId: string, from: Date, asOf: Date) {
  return Prisma.sql`
    SELECT COUNT(DISTINCT c."code_snapshot")::bigint AS "total"
    FROM "affiliate_ledger_entries" le
    JOIN "affiliate_commissions" c ON c."id" = le."commission_id"
    WHERE le."partner_id" = ${partnerId}
      AND le."created_at" >= ${utcTimestamp(from)}
      AND le."created_at" <= ${utcTimestamp(asOf)}
  `;
}

function ledgerQuery(
  partnerId: string,
  from: Date,
  asOf: Date,
  limit: number,
  offset: number,
) {
  return Prisma.sql`
    WITH page_entries AS (
      SELECT le.*
      FROM "affiliate_ledger_entries" le
      WHERE le."partner_id" = ${partnerId}
        AND le."created_at" >= ${utcTimestamp(from)}
        AND le."created_at" <= ${utcTimestamp(asOf)}
      ORDER BY le."created_at" DESC, le."id" DESC
      LIMIT ${limit} OFFSET ${offset}
    ), page_commission_ids AS (
      SELECT DISTINCT "commission_id" FROM page_entries
    ), commission_state AS (
      SELECT
        c."id" AS "commission_id",
        c."earned_kopecks",
        c."available_at",
        o."completed_at",
        o."payment_status"::text AS "payment_status",
        o."crm_status"::text AS "crm_status",
        COUNT(*) FILTER (
          WHERE all_le."kind"::text = 'credit'
        )::bigint AS "credit_count",
        COALESCE(SUM(all_le."amount_kopecks") FILTER (
          WHERE all_le."kind"::text = 'credit'
        ), 0)::bigint AS "credited_kopecks",
        COALESCE(SUM(-all_le."amount_kopecks") FILTER (
          WHERE all_le."kind"::text = 'reversal'
        ), 0)::bigint AS "reversed_kopecks"
      FROM "affiliate_commissions" c
      JOIN page_commission_ids page_ids ON page_ids."commission_id" = c."id"
      JOIN "orders" o ON o."id" = c."order_id"
      LEFT JOIN "affiliate_ledger_entries" all_le
        ON all_le."commission_id" = c."id"
        AND all_le."partner_id" = ${partnerId}
        AND all_le."created_at" <= ${utcTimestamp(asOf)}
      WHERE c."partner_id" = ${partnerId}
        AND c."created_at" <= ${utcTimestamp(asOf)}
      GROUP BY c."id", o."id"
    ), classified AS (
      SELECT *,
        ${commissionStatusSql(asOf)} AS "status",
        (
          "credit_count" = 1
          AND "credited_kopecks" = "earned_kopecks"
          AND "reversed_kopecks" <= "credited_kopecks"
        ) AS "is_consistent"
      FROM commission_state
    )
    SELECT
      le."id",
      c."code_snapshot" AS "code",
      le."kind"::text AS "kind",
      le."amount_kopecks",
      le."created_at" AT TIME ZONE 'UTC' AS "created_at",
      c."available_at" AT TIME ZONE 'UTC' AS "available_at",
      state."status",
      CASE
        WHEN le."kind"::text = 'credit' AND state."status" = 'held' THEN
          CASE
            WHEN state."crm_status" = 'cancelled' THEN 'order_cancelled'
            WHEN state."payment_status" <> 'paid' THEN 'payment_not_confirmed'
            WHEN state."crm_status" <> 'completed' THEN 'order_not_completed'
            ELSE NULL
          END
        ELSE NULL
      END AS "hold_reason",
      c."is_self_purchase",
      c."partner_percent",
      state."is_consistent"
    FROM page_entries le
    JOIN "affiliate_commissions" c ON c."id" = le."commission_id"
    JOIN classified state ON state."commission_id" = c."id"
    ORDER BY le."created_at" DESC, le."id" DESC
  `;
}

function ledgerCountQuery(partnerId: string, from: Date, asOf: Date) {
  return Prisma.sql`
    SELECT COUNT(*)::bigint AS "total"
    FROM "affiliate_ledger_entries"
    WHERE "partner_id" = ${partnerId}
      AND "created_at" >= ${utcTimestamp(from)}
      AND "created_at" <= ${utcTimestamp(asOf)}
  `;
}

function metricsSelect() {
  return Prisma.sql`
    COUNT(*) FILTER (WHERE le."kind"::text = 'credit')::bigint AS "order_count",
    COALESCE(SUM(c."subtotal_kopecks") FILTER (
      WHERE le."kind"::text = 'credit'
    ), 0)::bigint AS "sales_kopecks",
    COALESCE(SUM(le."amount_kopecks") FILTER (
      WHERE le."kind"::text = 'credit'
    ), 0)::bigint AS "earned_kopecks",
    COALESCE(SUM(-le."amount_kopecks") FILTER (
      WHERE le."kind"::text = 'reversal'
    ), 0)::bigint AS "reversed_kopecks",
    COALESCE(SUM(le."amount_kopecks"), 0)::bigint AS "net_kopecks"
  `;
}

function commissionStatusSql(asOf: Date) {
  return Prisma.sql`
    CASE
      WHEN "earned_kopecks" = 0 THEN 'not_earned'
      WHEN "reversed_kopecks" >= "earned_kopecks" THEN 'reversed'
      WHEN ("payment_status" <> 'paid' OR "crm_status" <> 'completed')
        AND ("completed_at" IS NOT NULL OR "crm_status" = 'cancelled') THEN 'held'
      WHEN "completed_at" IS NULL OR "available_at" IS NULL OR ${utcTimestamp(asOf)} < "available_at" THEN 'pending'
      WHEN "payment_status" = 'paid' AND "crm_status" = 'completed' THEN 'available'
      ELSE 'pending'
    END
  `;
}

function mapPeriod(days: 7 | 30 | 90, period: PeriodRow) {
  return {
    days,
    from: period.period_start.toISOString(),
    to: period.as_of.toISOString(),
    timeZone,
  };
}

function mapMetrics(row: MetricsRow) {
  return {
    orderCount: toSafeNonnegativeInteger(row.order_count, "Order count"),
    salesKopecks: toSafeNonnegativeInteger(row.sales_kopecks, "Sales"),
    earnedKopecks: toSafeNonnegativeInteger(row.earned_kopecks, "Earnings"),
    reversedKopecks: toSafeNonnegativeInteger(
      row.reversed_kopecks,
      "Reversals",
    ),
    netKopecks: toSafeInteger(row.net_kopecks, "Net earnings"),
  };
}

function getOffset(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > maxSignedInteger) {
    throw new BadRequestException("Pagination offset is too large");
  }
  return offset;
}

function toSafeNonnegativeInteger(value: unknown, label: string) {
  const result = toSafeInteger(value, label);
  if (result < 0) throw new RangeError(`${label} is negative`);
  return result;
}

function toSafeInteger(value: unknown, label: string) {
  let integer: bigint;
  try {
    integer = typeof value === "bigint" ? value : BigInt(String(value));
  } catch {
    throw new TypeError(`${label} is not an integer`);
  }
  const result = Number(integer);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} exceeds safe integer range`);
  }
  return result;
}

function utcTimestamp(value: Date) {
  return Prisma.sql`${value}::timestamp`;
}

function moscowDate(value: Date) {
  return Prisma.sql`((${utcTimestamp(value)} AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date`;
}

function assertConsistentLedgerRow(row: LedgerRow) {
  if (!row.is_consistent) {
    throw new Error("Affiliate commission ledger is inconsistent");
  }
}
