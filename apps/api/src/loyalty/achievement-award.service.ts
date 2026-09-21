import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoyaltyWalletService } from "./wallet.service";

@Injectable()
export class LoyaltyAchievementAwardService {
  private readonly logger = new Logger(LoyaltyAchievementAwardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: LoyaltyWalletService,
  ) {}

  async processMember(
    memberId: string,
    limit = 50,
  ): Promise<{ processed: boolean; awards: number }> {
    assertBatchSize(limit, 100);
    let startedAt: Date | undefined;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [claim] = await tx.$queryRaw<
            Array<{ claimed: boolean; startedAt: Date }>
          >`
          SELECT pg_try_advisory_xact_lock(hashtextextended('loyalty-achievement:' || ${memberId}, 0)) AS claimed,
            clock_timestamp() AS "startedAt"
        `;
          if (!claim?.claimed) return { processed: false, awards: 0 };
          startedAt = claim.startedAt;
          const identity = await tx.loyaltyMember.findUnique({
            where: { id: memberId },
          });
          if (!identity) return { processed: false, awards: 0 };
          // Serialize owner status changes without blocking source/actor FK locks.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${identity.userId} FOR NO KEY UPDATE`;
          // Refunds lock their order before updating its published eligibility.
          // Locking the eligibility row detects refunds committed after our
          // serializable snapshot and makes that stale attempt retry.
          await tx.$queryRaw`SELECT id FROM orders WHERE user_id = ${identity.userId} ORDER BY id FOR UPDATE`;
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
            !["PENDING", "READY"].includes(member.historyState) ||
            member.user.status !== "ACTIVE" ||
            member.user.deletedAt
          ) {
            return { processed: false, awards: 0 };
          }
          const definitions = await tx.$queryRaw<
            Array<{
              id: string;
              activeVersion: number;
              points: number;
              publicationFactId: string | null;
              completionCollectionId: string | null;
              completionOrderId: string | null;
              qualifiedAt: Date;
            }>
          >`
          SELECT d.id, d.active_version AS "activeVersion", r.reward_points AS points,
            proof.publication_fact_id AS "publicationFactId", proof.qualified_at AS "qualifiedAt",
            proof.completion_collection_id AS "completionCollectionId",
            proof.completion_order_id AS "completionOrderId"
          FROM loyalty_achievement_definitions d
          JOIN loyalty_achievement_revisions r ON r.definition_id = d.id AND r.version = d.active_version
          JOIN LATERAL loyalty_achievement_qualification(${member.userId}, r.condition_kind, r.target) proof ON true
          WHERE d.archived_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM loyalty_achievement_awards a
              WHERE a.member_id = ${memberId} AND a.definition_id = d.id)
          ORDER BY d.id LIMIT ${limit} FOR SHARE OF d
        `;
          for (const definition of definitions) {
            const award = await tx.loyaltyAchievementAward.create({
              data: {
                memberId,
                definitionId: definition.id,
                revisionVersion: definition.activeVersion,
                publicationFactId: definition.publicationFactId,
                completionCollectionId: definition.completionCollectionId,
                completionOrderId: definition.completionOrderId,
                points: definition.points,
                qualifiedAt: definition.qualifiedAt,
              },
            });
            if (award.points > 0)
              await this.wallet.creditAchievementInTransaction(tx, {
                awardId: award.id,
              });
          }
          await tx.$executeRaw`
          INSERT INTO loyalty_achievement_syncs (member_id, attempts, next_attempt_at, updated_at)
          VALUES (${memberId}, 0, clock_timestamp(), clock_timestamp())
          ON CONFLICT (member_id) DO UPDATE SET attempts = 0, last_error = NULL,
            next_attempt_at = clock_timestamp(), updated_at = clock_timestamp()
        `;
          // This independent processor never marks membership history ready.
          return { processed: true, awards: definitions.length };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        },
      );
    } catch (error) {
      if (startedAt)
        await this.prisma.$executeRaw`
        INSERT INTO loyalty_achievement_syncs (member_id, attempts, next_attempt_at, last_error, updated_at)
        SELECT id, 1, clock_timestamp() + INTERVAL '15 seconds', 'achievement_processing_failed', clock_timestamp()
        FROM loyalty_members WHERE id = ${memberId}
        ON CONFLICT (member_id) DO UPDATE SET
          attempts = LEAST(loyalty_achievement_syncs.attempts + 1, 1000000),
          next_attempt_at = clock_timestamp() + LEAST(3600, 15 * power(2, LEAST(loyalty_achievement_syncs.attempts, 8))) * INTERVAL '1 second',
          last_error = 'achievement_processing_failed', updated_at = clock_timestamp()
        WHERE loyalty_achievement_syncs.updated_at < ${startedAt}
      `;
      throw error;
    }
  }

  async processDueMembers(limit = 10): Promise<number> {
    assertBatchSize(limit, 50);
    const members = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT m.id FROM loyalty_members m JOIN users u ON u.id = m.user_id
      LEFT JOIN loyalty_achievement_syncs s ON s.member_id = m.id
      WHERE m.status = 'active' AND m.history_state IN ('pending','ready')
        AND u.status = 'active' AND u.deleted_at IS NULL
        AND (s.member_id IS NULL OR s.next_attempt_at <= clock_timestamp())
        AND EXISTS (
          SELECT 1 FROM loyalty_achievement_definitions d
          JOIN loyalty_achievement_revisions r ON r.definition_id = d.id AND r.version = d.active_version
          WHERE d.archived_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM loyalty_achievement_awards a
              WHERE a.member_id = m.id AND a.definition_id = d.id)
            AND EXISTS (SELECT 1 FROM loyalty_achievement_qualification(m.user_id, r.condition_kind, r.target))
        )
      ORDER BY COALESCE(s.next_attempt_at, m.joined_at), m.id LIMIT ${limit}
    `;
    let processed = 0;
    for (const member of members) {
      try {
        if ((await this.processMember(member.id)).processed) processed += 1;
      } catch {
        this.logger.warn(
          "Achievement processing failed; automatic retry remains pending",
        );
      }
    }
    return processed;
  }
}

function assertBatchSize(limit: number, maximum: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum)
    throw new Error("Invalid achievement batch size");
}
