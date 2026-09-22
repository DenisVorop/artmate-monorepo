import { Prisma } from "../generated/prisma/client";
import type { AchievementDTO, AchievementsDTO } from "./dto";

/** A coherent read of earned badges and current progress; never processes rewards. */
export async function readAchievements(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<AchievementsDTO> {
  const achievements = await tx.$queryRaw<
    Array<Omit<AchievementDTO, "earnedAt"> & { earnedAt: Date | null }>
  >(Prisma.sql`
    WITH coloring_facts AS (
      SELECT DISTINCT ON (coloring_id) id, coloring_id, collection_id, qualified_at
      FROM workshop_publication_facts WHERE owner_id = ${userId}
      ORDER BY coloring_id, qualified_at, id
    ), progress AS (
      SELECT
        (SELECT count(*) FROM coloring_facts) AS colorings,
        (SELECT count(DISTINCT collection_id) FROM coloring_facts) AS collections,
        (SELECT count(*) FROM coloring_collection_manifests m
          WHERE EXISTS (SELECT 1 FROM coloring_collection_manifest_items i WHERE i.collection_id = m.collection_id)
          AND NOT EXISTS (
            SELECT 1 FROM coloring_collection_manifest_items i WHERE i.collection_id = m.collection_id
              AND NOT EXISTS (SELECT 1 FROM coloring_facts f
                WHERE f.coloring_id = i.coloring_id AND f.collection_id = i.collection_id)
          )) AS completed_collections,
        (SELECT count(*) FROM order_completion_facts f
          JOIN order_completion_eligibility e ON e.order_id = f.order_id
          JOIN LATERAL order_completion_eligibility_snapshot(f.order_id) current_source ON true
          WHERE f.user_id = ${userId} AND e.is_eligible AND e.retained_quantity > 0
            AND current_source.is_eligible AND current_source.retained_quantity > 0) AS orders
    )
    SELECT d.id, r.title, r.description, r.image_url AS "imageUrl",
      r.condition_kind AS "conditionKind", r.target, r.reward_points AS "rewardPoints",
      CASE WHEN a.id IS NOT NULL THEN r.target ELSE least(r.target, CASE r.condition_kind
        WHEN 'published_coloring_count' THEN p.colorings
        WHEN 'distinct_collection_count' THEN p.collections
        WHEN 'completed_collection_count' THEN p.completed_collections
        WHEN 'completed_order_count' THEN p.orders END)::integer END AS progress,
      a.earned_at AS "earnedAt"
    FROM loyalty_achievement_definitions d
    LEFT JOIN achievement_badges a ON a.definition_id = d.id AND a.user_id = ${userId}
    JOIN loyalty_achievement_revisions r ON r.definition_id = d.id
      AND r.version = coalesce(a.revision_version, d.active_version)
    CROSS JOIN progress p
    WHERE a.id IS NOT NULL OR (d.archived_at IS NULL AND d.active_version IS NOT NULL)
    ORDER BY r.sort_order, d.id
  `);
  return {
    achievements: achievements.map((achievement) => ({
      ...achievement,
      earnedAt: achievement.earnedAt?.toISOString() ?? null,
    })),
  };
}
