import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoyaltyWalletService } from "./wallet.service";

/** Reads durable workshop facts; owns only loyalty rewards and wallet operations. */
@Injectable()
export class LoyaltyWorkRewardService {
  private readonly logger = new Logger(LoyaltyWorkRewardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: LoyaltyWalletService,
  ) {}

  async processMember(
    memberId: string,
    limit = 50,
  ): Promise<{ processed: boolean; rewards: number }> {
    assertBatchSize(limit, 100);
    let startedAt: Date | undefined;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [claim] = await tx.$queryRaw<
            Array<{ claimed: boolean; startedAt: Date }>
          >`
            SELECT pg_try_advisory_xact_lock(hashtextextended('loyalty-work-reward:' || ${memberId}, 0)) AS claimed,
              clock_timestamp() AS "startedAt"
          `;
          if (!claim?.claimed) return { processed: false, rewards: 0 };
          startedAt = claim.startedAt;
          const identity = await tx.loyaltyMember.findUnique({
            where: { id: memberId },
          });
          if (!identity) return { processed: false, rewards: 0 };
          // Enrollment and purchase history use the same User -> Member lock order.
          // Publication facts are immutable; current visibility is not a reversal source.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${identity.userId} FOR UPDATE`;
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
          )
            return { processed: false, rewards: 0 };

          // No high-water cursor: late commits, old works and later enrollment all
          // use the same source query and member+coloring uniqueness constraint.
          const facts = await tx.$queryRaw<
            Array<{ id: string; coloringId: string; qualifiedAt: Date }>
          >`
            SELECT DISTINCT ON (f.coloring_id) f.id, f.coloring_id AS "coloringId",
              f.qualified_at AS "qualifiedAt"
            FROM workshop_publication_facts f
            WHERE f.owner_id = ${member.userId}
              AND NOT EXISTS (
                SELECT 1 FROM loyalty_work_rewards r
                WHERE r.member_id = ${memberId} AND r.coloring_id = f.coloring_id
              )
            ORDER BY f.coloring_id, f.qualified_at, f.id LIMIT ${limit}
          `;
          for (const fact of facts) {
            const reward = await tx.loyaltyWorkReward.create({
              data: {
                memberId,
                coloringId: fact.coloringId,
                publicationFactId: fact.id,
                points: 25,
                rulesVersion: "work-v1",
                occurredAt: fact.qualifiedAt,
              },
            });
            await this.wallet.creditWorkInTransaction(tx, {
              rewardId: reward.id,
            });
          }
          await tx.$executeRaw`
            INSERT INTO loyalty_work_reward_syncs (member_id, attempts, next_attempt_at, updated_at)
            VALUES (${memberId}, 0, clock_timestamp(), clock_timestamp())
            ON CONFLICT (member_id) DO UPDATE SET attempts = 0, last_error = NULL,
              next_attempt_at = clock_timestamp(), updated_at = clock_timestamp()
          `;
          // This slice restores work rewards, not achievements or complete membership history.
          return { processed: true, rewards: facts.length };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        },
      );
    } catch (error) {
      if (startedAt)
        await this.prisma.$executeRaw`
          INSERT INTO loyalty_work_reward_syncs (member_id, attempts, next_attempt_at, last_error, updated_at)
          SELECT id, 1, clock_timestamp() + INTERVAL '15 seconds', 'work_reward_processing_failed', clock_timestamp()
          FROM loyalty_members WHERE id = ${memberId}
          ON CONFLICT (member_id) DO UPDATE SET
            attempts = LEAST(loyalty_work_reward_syncs.attempts + 1, 1000000),
            next_attempt_at = clock_timestamp() + LEAST(3600, 15 * power(2, LEAST(loyalty_work_reward_syncs.attempts, 8))) * INTERVAL '1 second',
            last_error = 'work_reward_processing_failed', updated_at = clock_timestamp()
          WHERE loyalty_work_reward_syncs.updated_at < ${startedAt}
        `;
      throw error;
    }
  }

  async processDueMembers(limit = 10): Promise<number> {
    assertBatchSize(limit, 50);
    const members = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT m.id FROM loyalty_members m JOIN users u ON u.id = m.user_id
      LEFT JOIN loyalty_work_reward_syncs s ON s.member_id = m.id
      WHERE m.status = 'active' AND m.history_state IN ('pending', 'ready')
        AND u.status = 'active' AND u.deleted_at IS NULL
        AND (s.member_id IS NULL OR s.next_attempt_at <= clock_timestamp())
        AND EXISTS (
          SELECT 1 FROM workshop_publication_facts f
          WHERE f.owner_id = m.user_id AND NOT EXISTS (
            SELECT 1 FROM loyalty_work_rewards r
            WHERE r.member_id = m.id AND r.coloring_id = f.coloring_id
          )
        )
      ORDER BY COALESCE(s.next_attempt_at, m.joined_at), m.id LIMIT ${limit}
    `;
    let processed = 0;
    for (const member of members) {
      try {
        if ((await this.processMember(member.id)).processed) processed += 1;
      } catch {
        this.logger.warn(
          "Work reward processing failed; automatic retry remains pending",
        );
      }
    }
    return processed;
  }
}

function assertBatchSize(limit: number, maximum: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum)
    throw new Error("Invalid work reward batch size");
}
