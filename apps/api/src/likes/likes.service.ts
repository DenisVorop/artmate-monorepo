import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { likeActorsPublication } from "../users/contracts/like-actors.contract";
import type { LikeReader, LikeState, LikeSubject } from "./contracts";
import { LikeSubjectRegistry } from "./subject-registry";

const actorView = Prisma.raw(likeActorsPublication);

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subjects: LikeSubjectRegistry,
  ) {}

  async batch(input: readonly LikeSubject[], actorId?: string) {
    for (const subject of input) this.subjects.get(subject.subjectType);
    const unique = [
      ...new Map(
        input.map((item) => [
          JSON.stringify([item.subjectType, item.subjectId]),
          item,
        ]),
      ).values(),
    ];
    return this.prisma.$transaction(
      async (tx) => {
        if (actorId) await this.assertActor(tx, actorId);
        const items = await this.readStates(tx, unique, actorId);
        return { items };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async set(
    subject: LikeSubject,
    actorId: string,
    liked: boolean,
  ): Promise<LikeState> {
    const publication = this.subjects.get(subject.subjectType);
    return this.prisma.$transaction(async (tx) => {
      await this.assertActor(tx, actorId);
      const [target] = await this.subjects.read(tx, subject.subjectType, [
        subject.subjectId,
      ]);
      if (!target || target.isDeleted || !target.isPublic)
        throw new NotFoundException("Like subject not found");
      // Removal stays possible even if a future policy forbids adding this like.
      if (liked && publication.denyOwnerLike && target.ownerId === actorId)
        throw new ForbiddenException("You cannot like your own content");

      // The DB row serializes writes by the same actor across processes, including
      // concurrent PUT/DELETE. A rejected transaction leaves the full bucket intact.
      const [window] = await tx.$queryRaw<{ attempts: number }[]>(Prisma.sql`
        INSERT INTO like_write_windows (actor_id, started_at, attempts)
        VALUES (${actorId}, date_trunc('minute', clock_timestamp() AT TIME ZONE 'UTC'), 1)
        ON CONFLICT (actor_id) DO UPDATE SET
          attempts = CASE WHEN like_write_windows.started_at < EXCLUDED.started_at
            THEN 1 ELSE like_write_windows.attempts + 1 END,
          started_at = greatest(like_write_windows.started_at, EXCLUDED.started_at)
        RETURNING attempts
      `);
      if (!window || window.attempts > 120)
        throw new HttpException(
          "Too many like requests",
          HttpStatus.TOO_MANY_REQUESTS,
        );

      if (liked) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO likes (subject_type, subject_id, actor_id)
          VALUES (${subject.subjectType}, ${subject.subjectId}, ${actorId})
          ON CONFLICT (subject_type, subject_id, actor_id) DO NOTHING
        `);
      } else {
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM likes WHERE subject_type = ${subject.subjectType}
            AND subject_id = ${subject.subjectId} AND actor_id = ${actorId}
        `);
      }
      // Visibility may have changed while waiting for an actor's concurrent write.
      const [state] = await this.readStates(tx, [subject], actorId);
      if (!state) throw new NotFoundException("Like subject not found");
      await this.assertActor(tx, actorId);
      return state;
    });
  }

  private async assertActor(reader: LikeReader, actorId: string) {
    const [actor] = await reader.$queryRaw<{ canLike: boolean }[]>(Prisma.sql`
      SELECT can_like AS "canLike" FROM ${actorView} WHERE actor_id = ${actorId}
    `);
    if (!actor?.canLike)
      throw new UnauthorizedException("Active account required");
  }

  private async readStates(
    reader: LikeReader,
    input: readonly LikeSubject[],
    actorId?: string,
  ) {
    const result = new Map<string, LikeState>();
    for (const subjectType of new Set(input.map((item) => item.subjectType))) {
      const publication = this.subjects.get(subjectType);
      const ids = input
        .filter((item) => item.subjectType === subjectType)
        .map((item) => item.subjectId);
      const visible = (
        await this.subjects.read(reader, subjectType, ids)
      ).filter((item) => item.isPublic && !item.isDeleted);
      if (!visible.length) continue;
      const counts = await reader.$queryRaw<
        {
          subjectId: string;
          count: number;
          viewerHasLiked: boolean;
        }[]
      >(Prisma.sql`
        SELECT l.subject_id AS "subjectId", count(*)::integer AS count,
          coalesce(bool_or(l.actor_id = ${actorId ?? null}), FALSE) AS "viewerHasLiked"
        FROM likes l JOIN ${actorView} a ON a.actor_id = l.actor_id AND a.can_like
        WHERE l.subject_type = ${subjectType}
          AND l.subject_id IN (${Prisma.join(visible.map((item) => item.subjectId))})
        GROUP BY l.subject_id
      `);
      const byId = new Map(counts.map((row) => [row.subjectId, row]));
      for (const target of visible) {
        const state = byId.get(target.subjectId);
        result.set(JSON.stringify([subjectType, target.subjectId]), {
          subjectType,
          subjectId: target.subjectId,
          count: state?.count ?? 0,
          viewerHasLiked: state?.viewerHasLiked ?? false,
          canLike: Boolean(
            actorId &&
            !(publication.denyOwnerLike && target.ownerId === actorId),
          ),
        });
      }
    }
    return input.flatMap((item) => {
      const state = result.get(
        JSON.stringify([item.subjectType, item.subjectId]),
      );
      return state ? [state] : [];
    });
  }
}
