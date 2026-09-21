import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoyaltyHistoryPreviewService } from "./history-preview.service";
import { LoyaltyPurchaseSettlementService } from "./purchase-settlement.service";

/** Restores purchase history only. It never enrolls users or declares all history READY. */
@Injectable()
export class LoyaltyPurchaseHistoryService {
  private readonly logger = new Logger(LoyaltyPurchaseHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preview: LoyaltyHistoryPreviewService,
    private readonly purchases: LoyaltyPurchaseSettlementService,
  ) {}

  async processMember(
    memberId: string,
  ): Promise<{ processed: boolean; orders: number }> {
    let startedAt: Date | undefined;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // A nonblocking transaction-scoped claim prevents two API instances
          // from building stale histories for the same member simultaneously.
          const [claim] = await tx.$queryRaw<
            Array<{ claimed: boolean; startedAt: Date }>
          >`
            SELECT pg_try_advisory_xact_lock(hashtextextended('loyalty-purchase-history:' || ${memberId}, 0)) AS claimed,
              clock_timestamp() AS "startedAt"
          `;
          if (!claim?.claimed) return { processed: false, orders: 0 };
          startedAt = claim.startedAt;
          const identity = await tx.loyaltyMember.findUnique({
            where: { id: memberId },
          });
          if (!identity) return { processed: false, orders: 0 };
          // Same order as enrollment/checkout. Lock all source orders before Member;
          // published refunds and status writers already serialize on Order.
          // Preserve status serialization while allowing source/actor FK checks.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${identity.userId} FOR NO KEY UPDATE`;
          await tx.$queryRaw`SELECT id FROM orders WHERE user_id = ${identity.userId} ORDER BY id FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM loyalty_members WHERE id = ${memberId} FOR UPDATE`;
          const member = await tx.loyaltyMember.findUnique({
            where: { id: memberId },
            include: { user: true },
          });
          if (
            !member ||
            member.userId !== identity.userId ||
            member.status !== "ACTIVE" ||
            (member.historyState !== "PENDING" &&
              member.historyState !== "READY") ||
            member.user.status !== "ACTIVE" ||
            member.user.deletedAt
          )
            return { processed: false, orders: 0 };

          // Read the report in THIS serializable transaction, never apply an old preview.
          const report = await this.preview.previewMemberInTransaction(
            tx,
            memberId,
          );
          if (
            !report.complete ||
            report.memberId !== memberId ||
            report.scope !== "purchases" ||
            report.rulesVersion !== "purchase-history-v1"
          )
            throw new ConflictException(
              "Purchase history sources are incomplete",
            );

          // This transaction-scoped capability lets purchase commands credit PENDING
          // members without enabling their spending or weakening generic wallet rules.
          await tx.$executeRaw`
          INSERT INTO loyalty_purchase_history_syncs (member_id, active_transaction_id, attempts, next_attempt_at, updated_at)
          VALUES (${memberId}, txid_current(), 0, clock_timestamp(), clock_timestamp())
            ON CONFLICT (member_id) DO UPDATE SET active_transaction_id = txid_current(), completed_at = NULL, updated_at = clock_timestamp()
        `;
          let orders = 0;
          for (const entry of report.entries) {
            const result = await this.purchases.processOrderInTransaction(
              tx,
              entry.orderId,
              { memberId, entry },
            );
            if (!result.processed)
              throw new ConflictException(
                "Purchase history source changed during settlement",
              );
            orders += 1;
          }
          const finalized = await tx.$executeRaw`
            UPDATE loyalty_purchase_history_syncs SET active_transaction_id = NULL,
            completed_at = clock_timestamp(), attempts = 0, last_error = NULL,
            next_attempt_at = clock_timestamp() + INTERVAL '30 seconds', updated_at = clock_timestamp()
            WHERE member_id = ${memberId} AND active_transaction_id = txid_current()
          `;
          if (finalized !== 1)
            throw new ConflictException(
              "Purchase history transaction lost its checkpoint",
            );
          return { processed: true, orders };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        },
      );
    } catch (error) {
      // Includes serialization conflicts: repeat from a fresh snapshot automatically.
      // No partial credits survive; existing source orders and payments stay intact.
      if (startedAt)
        await this.prisma.$executeRaw`
        INSERT INTO loyalty_purchase_history_syncs (member_id, attempts, next_attempt_at, last_error, updated_at)
        SELECT id, 1, clock_timestamp() + INTERVAL '15 seconds', 'purchase_history_processing_failed', clock_timestamp()
        FROM loyalty_members WHERE id = ${memberId}
        ON CONFLICT (member_id) DO UPDATE SET active_transaction_id = NULL,
          attempts = LEAST(loyalty_purchase_history_syncs.attempts + 1, 1000000),
          next_attempt_at = clock_timestamp() + LEAST(3600, 15 * power(2, LEAST(loyalty_purchase_history_syncs.attempts, 8))) * INTERVAL '1 second',
          last_error = 'purchase_history_processing_failed', updated_at = clock_timestamp()
          WHERE loyalty_purchase_history_syncs.completed_at IS NULL
            OR loyalty_purchase_history_syncs.completed_at < ${startedAt}
      `;
      throw error;
    }
  }

  async processDueMembers(limit = 10): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
      throw new Error("Invalid purchase history batch size");
    const members = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT m.id FROM loyalty_members m JOIN users u ON u.id = m.user_id
      LEFT JOIN loyalty_purchase_history_syncs s ON s.member_id = m.id
      WHERE m.status = 'active' AND m.history_state IN ('pending', 'ready')
        AND u.status = 'active' AND u.deleted_at IS NULL
        AND (s.member_id IS NULL OR s.next_attempt_at <= clock_timestamp())
        AND (s.completed_at IS NULL OR s.last_error IS NOT NULL OR EXISTS (
          SELECT 1 FROM orders o LEFT JOIN loyalty_purchase_accounts a ON a.order_id = o.id
          WHERE o.user_id = m.user_id AND o.payment_status = 'paid' AND o.crm_status = 'completed'
            AND a.order_id IS NULL
        ))
      ORDER BY COALESCE(s.next_attempt_at, m.joined_at), m.id LIMIT ${limit}
    `;
    let processed = 0;
    for (const member of members) {
      try {
        if ((await this.processMember(member.id)).processed) processed += 1;
      } catch {
        this.logger.warn(
          "Purchase history processing failed; automatic retry remains pending",
        );
      }
    }
    return processed;
  }
}
