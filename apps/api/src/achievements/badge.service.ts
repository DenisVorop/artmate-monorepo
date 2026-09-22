import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Publishes immutable user-owned badges; has no loyalty dependency. */
@Injectable()
export class AchievementBadgeService {
  private readonly logger = new Logger(AchievementBadgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processUser(
    userId: string,
    limit = 50,
  ): Promise<{ processed: boolean; badges: number }> {
    assertBatchSize(limit, 100);
    let startedAt: Date | undefined;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [claim] = await tx.$queryRaw<
            Array<{ claimed: boolean; startedAt: Date }>
          >`
          SELECT pg_try_advisory_xact_lock(hashtextextended('achievement-badge:' || ${userId}, 0)) AS claimed,
            clock_timestamp() AS "startedAt"
        `;
          if (!claim?.claimed) return { processed: false, badges: 0 };
          startedAt = claim.startedAt;
          // Serialize identity and refunded-order eligibility with source publishers.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
          await tx.$queryRaw`SELECT id FROM orders WHERE user_id = ${userId} ORDER BY id FOR UPDATE`;
          await tx.$queryRaw`
          SELECT e.order_id FROM order_completion_eligibility e
          JOIN order_completion_facts f ON f.order_id = e.order_id
          WHERE f.user_id = ${userId} ORDER BY e.order_id FOR SHARE OF e
        `;
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (!user || user.status !== "ACTIVE" || user.deletedAt)
            return { processed: false, badges: 0 };
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
            proof.completion_collection_id AS "completionCollectionId", proof.completion_order_id AS "completionOrderId"
          FROM loyalty_achievement_definitions d
          JOIN loyalty_achievement_revisions r ON r.definition_id = d.id AND r.version = d.active_version
          JOIN LATERAL achievement_qualification(${userId}, r.condition_kind, r.target) proof ON true
          WHERE d.archived_at IS NULL AND NOT EXISTS (
            SELECT 1 FROM achievement_badges b WHERE b.user_id = ${userId} AND b.definition_id = d.id
          ) ORDER BY d.id LIMIT ${limit} FOR SHARE OF d
        `;
          for (const definition of definitions) {
            await tx.achievementBadge.create({
              data: {
                id: randomUUID(),
                userId,
                definitionId: definition.id,
                revisionVersion: definition.activeVersion,
                publicationFactId: definition.publicationFactId,
                completionCollectionId: definition.completionCollectionId,
                completionOrderId: definition.completionOrderId,
                rewardPoints: definition.points,
                qualifiedAt: definition.qualifiedAt,
              },
            });
          }
          await tx.$executeRaw`
          INSERT INTO achievement_syncs (user_id, attempts, next_attempt_at, updated_at)
          VALUES (${userId}, 0, clock_timestamp(), clock_timestamp())
          ON CONFLICT (user_id) DO UPDATE SET attempts = 0, last_error = NULL,
            next_attempt_at = clock_timestamp(), updated_at = clock_timestamp()
        `;
          return { processed: true, badges: definitions.length };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        },
      );
    } catch (error) {
      if (startedAt)
        await this.prisma.$executeRaw`
        INSERT INTO achievement_syncs (user_id, attempts, next_attempt_at, last_error, updated_at)
        SELECT id, 1, clock_timestamp() + INTERVAL '15 seconds', 'badge_processing_failed', clock_timestamp()
        FROM users WHERE id = ${userId}
        ON CONFLICT (user_id) DO UPDATE SET attempts = LEAST(achievement_syncs.attempts + 1, 1000000),
          next_attempt_at = clock_timestamp() + LEAST(3600, 15 * power(2, LEAST(achievement_syncs.attempts, 8))) * INTERVAL '1 second',
          last_error = 'badge_processing_failed', updated_at = clock_timestamp()
        WHERE achievement_syncs.updated_at < ${startedAt}
      `;
      throw error;
    }
  }

  async processDueUsers(limit = 10): Promise<number> {
    assertBatchSize(limit, 50);
    const users = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT u.id FROM users u LEFT JOIN achievement_syncs s ON s.user_id = u.id
      WHERE u.status = 'active' AND u.deleted_at IS NULL
        AND (s.user_id IS NULL OR s.next_attempt_at <= clock_timestamp())
        AND EXISTS (
          SELECT 1 FROM loyalty_achievement_definitions d
          JOIN loyalty_achievement_revisions r ON r.definition_id = d.id AND r.version = d.active_version
          WHERE d.archived_at IS NULL AND NOT EXISTS (
            SELECT 1 FROM achievement_badges b WHERE b.user_id = u.id AND b.definition_id = d.id
          ) AND EXISTS (SELECT 1 FROM achievement_qualification(u.id, r.condition_kind, r.target))
        )
      ORDER BY COALESCE(s.next_attempt_at, u.created_at), u.id LIMIT ${limit}
    `;
    let processed = 0;
    for (const user of users) {
      try {
        if ((await this.processUser(user.id)).processed) processed += 1;
      } catch {
        this.logger.warn(
          "Badge processing failed; automatic retry remains pending",
        );
      }
    }
    return processed;
  }
}

function assertBatchSize(limit: number, maximum: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum)
    throw new Error("Invalid badge batch size");
}
