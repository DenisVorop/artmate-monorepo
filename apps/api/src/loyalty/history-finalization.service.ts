import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoyaltyHistoryPreviewService } from "./history-preview.service";

/** Finalizes restored history from committed facts; never issues domain commands. */
@Injectable()
export class LoyaltyHistoryFinalizationService {
  private readonly logger = new Logger(LoyaltyHistoryFinalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preview: LoyaltyHistoryPreviewService,
  ) {}

  async processMember(
    memberId: string,
  ): Promise<{ processed: boolean; ready: boolean }> {
    let startedAt: Date | undefined;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [claim] = await tx.$queryRaw<
            Array<{ claimed: boolean; startedAt: Date }>
          >`
            SELECT pg_try_advisory_xact_lock(hashtextextended('loyalty-history-finalization:' || ${memberId}, 0)) AS claimed,
              clock_timestamp() AS "startedAt"
          `;
          if (!claim?.claimed) return { processed: false, ready: false };
          startedAt = claim.startedAt;
          const identity = await tx.loyaltyMember.findUnique({
            where: { id: memberId },
          });
          if (!identity) return { processed: false, ready: false };
          // Match source consumers: User -> ordered Orders -> eligibility -> Member.
          // Include reservation orders even if their beneficiary is another user.
          // NO KEY UPDATE permits source writers' actor/owner FK checks.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${identity.userId} FOR NO KEY UPDATE`;
          await tx.$queryRaw`
            SELECT o.id FROM orders o
            WHERE o.user_id = ${identity.userId} OR EXISTS (
              SELECT 1 FROM loyalty_reservations r WHERE r.order_id = o.id AND r.member_id = ${memberId}
            ) ORDER BY o.id FOR UPDATE OF o
          `;
          await tx.$queryRaw`
            SELECT e.order_id FROM order_completion_eligibility e
            JOIN order_completion_facts f ON f.order_id = e.order_id
            WHERE f.user_id = ${identity.userId} ORDER BY e.order_id FOR SHARE OF e
          `;
          await tx.$queryRaw`SELECT id FROM loyalty_members WHERE id = ${memberId} FOR UPDATE`;
          const member = await tx.loyaltyMember.findUnique({
            where: { id: memberId },
            include: { user: true },
          });
          if (
            !member ||
            member.userId !== identity.userId ||
            member.status !== "ACTIVE" ||
            member.user.status !== "ACTIVE" ||
            member.user.deletedAt
          )
            return { processed: false, ready: false };
          if (member.historyState === "READY")
            return { processed: false, ready: true };
          if (member.historyState !== "PENDING")
            return { processed: false, ready: false };

          // READ COMMITTED is intentional: all evidence is read AFTER acquiring
          // source locks, including a refund committed while we waited for Order.
          const report = await this.preview.previewMemberInTransaction(
            tx,
            memberId,
          );
          if (
            !report.complete ||
            report.memberId !== memberId ||
            report.scope !== "purchases" ||
            report.rulesVersion !== "purchase-history-v1" ||
            report.entries.some((entry) => !entry.accounted)
          ) {
            await this.defer(
              tx,
              memberId,
              "history_finalization_pending",
              startedAt,
            );
            return { processed: true, ready: false };
          }

          // One final statement checks current published obligations and changes
          // readiness. Source/ledger guards already validate each reward's amounts.
          // Later publications and activations belong to the normal live workers.
          const finalized = await tx.$executeRaw`
            UPDATE loyalty_members m SET history_state = 'ready'
            WHERE m.id = ${memberId} AND m.user_id = ${member.userId}
              AND m.status = 'active' AND m.history_state = 'pending'
              AND EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id AND u.status = 'active' AND u.deleted_at IS NULL)
              AND EXISTS (
                SELECT 1 FROM loyalty_purchase_history_syncs s WHERE s.member_id = m.id
                  AND s.completed_at IS NOT NULL AND s.active_transaction_id IS NULL AND s.last_error IS NULL
              )
              AND NOT EXISTS (
                SELECT 1 FROM orders o WHERE o.user_id = m.user_id
                  AND o.payment_status = 'paid' AND o.crm_status = 'completed'
                  AND NOT EXISTS (SELECT 1 FROM loyalty_purchase_accounts a WHERE a.order_id = o.id AND a.member_id = m.id)
              )
              AND NOT EXISTS (
                SELECT 1 FROM loyalty_purchase_accounts a WHERE a.member_id = m.id
                  AND a.refunded_kopecks <> (
                    SELECT COALESCE(SUM(r.total_kopecks - r.delivery_kopecks), 0)
                    FROM order_refunds r JOIN order_refund_events e ON e.refund_id = r.id
                    WHERE r.order_id = a.order_id
                  )
              )
              AND NOT EXISTS (
                SELECT 1 FROM workshop_publication_facts f WHERE f.owner_id = m.user_id
                  AND NOT EXISTS (SELECT 1 FROM loyalty_work_rewards r WHERE r.member_id = m.id AND r.coloring_id = f.coloring_id)
              )
              AND NOT EXISTS (
                SELECT 1 FROM loyalty_achievement_definitions d
                JOIN loyalty_achievement_revisions r ON r.definition_id = d.id AND r.version = d.active_version
                WHERE d.archived_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM achievement_badges b WHERE b.user_id = m.user_id AND b.definition_id = d.id)
                  AND EXISTS (SELECT 1 FROM achievement_qualification(m.user_id, r.condition_kind, r.target))
              )
              AND NOT EXISTS (
                SELECT 1 FROM achievement_badges b WHERE b.user_id = m.user_id
                  AND NOT EXISTS (SELECT 1 FROM loyalty_achievement_awards a WHERE a.badge_id = b.id AND a.member_id = m.id)
              )
              AND NOT EXISTS (
                SELECT 1 FROM loyalty_reservations r JOIN order_payment_events e ON e.order_id = r.order_id
                LEFT JOIN loyalty_payment_receipts receipt ON receipt.event_id = e.id
                WHERE r.member_id = m.id AND receipt.processed_at IS NULL
              )
              AND NOT EXISTS (
                SELECT 1 FROM loyalty_reservations r JOIN order_refunds refund ON refund.order_id = r.order_id
                LEFT JOIN order_refund_events e ON e.refund_id = refund.id
                LEFT JOIN loyalty_refund_receipts receipt ON receipt.event_id = e.id
                WHERE r.member_id = m.id AND refund.loyalty_points > 0 AND receipt.processed_at IS NULL
              )
              AND EXISTS (
                SELECT 1 FROM loyalty_wallets w
                CROSS JOIN LATERAL (
                  SELECT COUNT(*) AS operation_count, COALESCE(MAX(sequence), 0) AS last_sequence,
                    COALESCE(SUM(balance_delta), 0) AS balance, COALESCE(SUM(reserved_delta), 0) AS reserved
                  FROM loyalty_operations WHERE member_id = m.id
                ) ledger
                WHERE w.member_id = m.id AND w.balance_points >= w.reserved_points AND w.reserved_points >= 0
                  AND w.balance_points = ledger.balance AND w.reserved_points = ledger.reserved
                  AND w.revision = ledger.operation_count AND ledger.last_sequence = ledger.operation_count
                  AND w.reserved_points = (SELECT COALESCE(SUM(points), 0) FROM loyalty_reservations
                    WHERE member_id = m.id AND status = 'reserved')
              )
          `;
          if (finalized !== 1) {
            await this.defer(
              tx,
              memberId,
              "history_finalization_pending",
              startedAt,
            );
            return { processed: true, ready: false };
          }
          await tx.$executeRaw`
            INSERT INTO loyalty_history_syncs (member_id, completed_at, attempts, next_attempt_at, updated_at)
            VALUES (${memberId}, clock_timestamp(), 0, clock_timestamp(), clock_timestamp())
            ON CONFLICT (member_id) DO UPDATE SET completed_at = clock_timestamp(), attempts = 0,
              last_error = NULL, next_attempt_at = clock_timestamp(), updated_at = clock_timestamp()
          `;
          return { processed: true, ready: true };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 30_000,
        },
      );
    } catch (error) {
      if (startedAt)
        await this.defer(
          this.prisma,
          memberId,
          "history_finalization_failed",
          startedAt,
        );
      throw error;
    }
  }

  async processDueMembers(limit = 10): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
      throw new Error("Invalid history finalization batch size");
    const members = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT m.id FROM loyalty_members m JOIN users u ON u.id = m.user_id
      LEFT JOIN loyalty_history_syncs s ON s.member_id = m.id
      WHERE m.status = 'active' AND m.history_state = 'pending'
        AND u.status = 'active' AND u.deleted_at IS NULL
        AND (s.member_id IS NULL OR s.next_attempt_at <= clock_timestamp())
      ORDER BY COALESCE(s.next_attempt_at, m.joined_at), m.id LIMIT ${limit}
    `;
    let ready = 0;
    for (const member of members) {
      try {
        const result = await this.processMember(member.id);
        if (result.processed && result.ready) ready += 1;
      } catch {
        this.logger.warn(
          "History finalization failed; automatic retry remains pending",
        );
      }
    }
    return ready;
  }

  private async defer(
    tx: Prisma.TransactionClient,
    memberId: string,
    error: "history_finalization_pending" | "history_finalization_failed",
    startedAt: Date,
  ) {
    const pending = error === "history_finalization_pending";
    const lastError = pending ? null : error;
    // Normal waiting polls every 15 seconds; only actual failures back off.
    // Either kind moves behind other due members, even with limit=1.
    // A stale failure cannot overwrite a newer checkpoint or a READY transition.
    await tx.$executeRaw`
      INSERT INTO loyalty_history_syncs (member_id, attempts, next_attempt_at, last_error, updated_at)
      SELECT m.id, ${pending ? 0 : 1}, clock_timestamp() + INTERVAL '15 seconds', ${lastError}, clock_timestamp()
      FROM loyalty_members m JOIN users u ON u.id = m.user_id
      WHERE m.id = ${memberId} AND m.status = 'active' AND m.history_state = 'pending'
        AND u.status = 'active' AND u.deleted_at IS NULL
      ON CONFLICT (member_id) DO UPDATE SET
        attempts = CASE WHEN ${pending} THEN 0 ELSE LEAST(loyalty_history_syncs.attempts + 1, 1000000) END,
        next_attempt_at = clock_timestamp() + (CASE WHEN ${pending} THEN 15
          ELSE LEAST(3600, 15 * power(2, LEAST(loyalty_history_syncs.attempts, 8))) END) * INTERVAL '1 second',
        last_error = ${lastError}, updated_at = clock_timestamp()
      WHERE loyalty_history_syncs.completed_at IS NULL AND loyalty_history_syncs.updated_at < ${startedAt}
    `;
  }
}
