import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { likeActorsPublication } from "../users/contracts/like-actors.contract";
import { LikeSubjectRegistry } from "./subject-registry";

/** Recoverable, bounded reconciliation. Hiding/blocking never deletes a like. */
@Injectable()
export class LikesCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subjects: LikeSubjectRegistry,
  ) {}

  async reconcile() {
    return this.prisma.$transaction(async (tx) => {
      // Keep the same lock order as mutations: write window before like rows.
      await tx.$executeRaw(Prisma.sql`
        WITH obsolete AS (
          SELECT w.actor_id FROM like_write_windows w
          WHERE w.started_at < (clock_timestamp() AT TIME ZONE 'UTC') - interval '1 day'
            OR NOT EXISTS (
              SELECT 1 FROM ${Prisma.raw(likeActorsPublication)} a
              WHERE a.actor_id = w.actor_id AND NOT a.is_deleted
            ) LIMIT 1000 FOR UPDATE OF w SKIP LOCKED
        )
        DELETE FROM like_write_windows w USING obsolete o WHERE w.actor_id = o.actor_id
      `);
      let deleted = await tx.$executeRaw(Prisma.sql`
        WITH obsolete AS (
          SELECT l.subject_type, l.subject_id, l.actor_id FROM likes l
          WHERE NOT EXISTS (
            SELECT 1 FROM ${Prisma.raw(likeActorsPublication)} a
            WHERE a.actor_id = l.actor_id AND NOT a.is_deleted
          ) LIMIT 1000 FOR UPDATE OF l SKIP LOCKED
        )
        DELETE FROM likes l USING obsolete o
        WHERE l.subject_type = o.subject_type AND l.subject_id = o.subject_id AND l.actor_id = o.actor_id
      `);
      for (const publication of this.subjects.all()) {
        deleted += await tx.$executeRaw(Prisma.sql`
          WITH obsolete AS (
            SELECT l.subject_type, l.subject_id, l.actor_id FROM likes l
            WHERE l.subject_type = ${publication.subjectType} AND NOT EXISTS (
              SELECT 1 FROM ${Prisma.raw(publication.view)} s
              WHERE s.subject_id = l.subject_id AND NOT s.is_deleted
            ) LIMIT 1000 FOR UPDATE OF l SKIP LOCKED
          )
          DELETE FROM likes l USING obsolete o
          WHERE l.subject_type = o.subject_type AND l.subject_id = o.subject_id AND l.actor_id = o.actor_id
        `);
      }
      return { deleted };
    });
  }
}
