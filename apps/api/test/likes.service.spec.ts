import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { blogLikeSubjects } from "../src/blog/contracts/like-subjects.contract";
import { workshopLikeSubjects } from "../src/workshops/contracts/like-subjects.contract";
import { LikesCleanupService } from "../src/likes/cleanup.service";
import { LikesService } from "../src/likes/likes.service";
import { LikeSubjectRegistry } from "../src/likes/subject-registry";
import { createLikesDatabase } from "./helpers/likes-database";

const work = { subjectType: "community-work", subjectId: "public-work" };
const post = { subjectType: "blog-post", subjectId: "post" };

describe("Universal likes: persisted behavior and owner publications", () => {
  let database: Awaited<ReturnType<typeof createLikesDatabase>>;
  let likes: LikesService;
  let cleanup: LikesCleanupService;
  before(async () => {
    database = await createLikesDatabase();
    const registry = new LikeSubjectRegistry([
      workshopLikeSubjects,
      blogLikeSubjects,
    ]);
    likes = new LikesService(database.prisma, registry);
    cleanup = new LikesCleanupService(database.prisma, registry);
  });
  beforeEach(async () => database.reset());
  after(async () => database?.db.close());

  it("makes repeated PUT/DELETE idempotent and scopes removal to the authenticated actor", async () => {
    assert.deepEqual(await likes.set(work, "alice", true), {
      ...work,
      count: 1,
      viewerHasLiked: true,
      canLike: true,
    });
    assert.equal((await likes.set(work, "alice", true)).count, 1);
    assert.equal((await likes.set(work, "bob", true)).count, 2);
    const state = await likes.set(work, "alice", false);
    assert.deepEqual(state, {
      ...work,
      count: 1,
      viewerHasLiked: false,
      canLike: true,
    });
    assert.equal((await likes.set(work, "alice", false)).count, 1);
    const rows = await database.db.query("SELECT actor_id FROM likes");
    assert.deepEqual(rows.rows, [{ actor_id: "bob" }]);
  });

  it("counts only active accounts, isolates viewers, and deduplicates batch input in order", async () => {
    await likes.set(work, "alice", true);
    await likes.set(post, "bob", true);
    await database.db.exec(
      "INSERT INTO likes (subject_type, subject_id, actor_id) VALUES ('community-work', 'public-work', 'blocked'), ('community-work', 'public-work', 'deleted')",
    );
    assert.deepEqual(await likes.batch([post, work, post]), {
      items: [
        { ...post, count: 1, viewerHasLiked: false, canLike: false },
        { ...work, count: 1, viewerHasLiked: false, canLike: false },
      ],
    });
    assert.deepEqual((await likes.batch([work], "alice")).items[0], {
      ...work,
      count: 1,
      viewerHasLiked: true,
      canLike: true,
    });
    assert.deepEqual((await likes.batch([work], "bob")).items[0], {
      ...work,
      count: 1,
      viewerHasLiked: false,
      canLike: true,
    });
    assert.deepEqual((await likes.batch([work], "author")).items[0], {
      ...work,
      count: 1,
      viewerHasLiked: false,
      canLike: false,
    });
  });

  it("denies self-likes, absent/blocked/deleted actors, and unregistered types before writes", async () => {
    await assert.rejects(likes.set(work, "author", true), ForbiddenException);
    for (const actor of ["absent", "blocked", "deleted"]) {
      await assert.rejects(likes.set(work, actor, true), UnauthorizedException);
      await assert.rejects(likes.batch([work], actor), UnauthorizedException);
    }
    await assert.rejects(
      likes.set({ ...work, subjectType: "anything" }, "alice", true),
      BadRequestException,
    );
    await assert.rejects(
      likes.batch([{ ...work, subjectType: "anything" }]),
      BadRequestException,
    );
    assert.equal(
      (await database.db.query("SELECT * FROM likes")).rows.length,
      0,
    );
  });

  it("does not reveal or mutate drafts, archived posts, missing IDs, or internal work IDs", async () => {
    for (const subject of [
      { ...post, subjectId: "draft" },
      { ...post, subjectId: "archive" },
      { ...post, subjectId: "absent" },
      { ...work, subjectId: "internal-work" },
    ]) {
      assert.deepEqual(await likes.batch([subject], "alice"), { items: [] });
      await assert.rejects(
        likes.set(subject, "alice", true),
        NotFoundException,
      );
      await assert.rejects(
        likes.set(subject, "alice", false),
        NotFoundException,
      );
    }
  });

  it("uses every visibility condition from Workshops without erasing hidden likes", async () => {
    for (const change of [
      "UPDATE workshop_works SET is_publication_enabled = FALSE",
      "UPDATE workshop_works SET published_at = NULL",
      "UPDATE workshop_works SET published_revision_id = NULL",
      "UPDATE workshop_work_revisions SET status = 'hidden'",
      "UPDATE colorings SET status = 'draft'",
      "UPDATE colorings SET published_revision_id = NULL",
      "UPDATE coloring_collections SET status = 'draft'",
      "UPDATE products SET status = 'draft'",
      "UPDATE workshops SET is_public = FALSE",
      "UPDATE users SET status = 'blocked' WHERE id = 'author'",
    ]) {
      await database.reset();
      await likes.set(work, "alice", true);
      await database.db.exec(change);
      assert.deepEqual(await likes.batch([work]), { items: [] }, change);
      await assert.rejects(
        likes.set(work, "bob", true),
        NotFoundException,
        change,
      );
      assert.equal((await cleanup.reconcile()).deleted, 0, change);
      assert.equal(
        (await database.db.query("SELECT * FROM likes")).rows.length,
        1,
        change,
      );
    }
    await database.db.exec(
      "UPDATE users SET status = 'active' WHERE id = 'author'",
    );
    assert.equal(
      (await likes.batch([work], "alice")).items[0]?.viewerHasLiked,
      true,
    );
  });

  it("keeps likes on the work when the published revision changes", async () => {
    await likes.set(work, "alice", true);
    await database.db.exec(
      "INSERT INTO workshop_work_revisions (id, work_id) VALUES ('new-revision', 'internal-work'); UPDATE workshop_works SET published_revision_id = 'new-revision'",
    );
    assert.equal(
      (await likes.batch([work], "alice")).items[0]?.viewerHasLiked,
      true,
    );
  });

  it("extends to a new registered type without altering the likes schema", async () => {
    await database.db.exec(
      "CREATE VIEW test_like_subjects_v1 AS SELECT 'example'::text AS subject_id, NULL::text AS owner_id, TRUE AS is_public, FALSE AS is_deleted",
    );
    try {
      const registry = new LikeSubjectRegistry([
        {
          subjectType: "new-type",
          view: "test_like_subjects_v1",
          denyOwnerLike: false,
        },
      ]);
      const service = new LikesService(database.prisma, registry);
      const subject = { subjectType: "new-type", subjectId: "example" };
      assert.deepEqual(await service.set(subject, "alice", true), {
        ...subject,
        count: 1,
        viewerHasLiked: true,
        canLike: true,
      });
    } finally {
      await database.db.exec("DROP VIEW test_like_subjects_v1");
    }
  });

  it("enforces uniqueness in SQL and rejects malformed identities", async () => {
    await likes.set(work, "alice", true);
    await assert.rejects(
      database.db.exec(
        "INSERT INTO likes (subject_type, subject_id, actor_id) VALUES ('community-work', 'public-work', 'alice')",
      ),
      /unique constraint/,
    );
    for (const values of [
      "('', 'post', 'alice')",
      "('blog-post', '', 'alice')",
      "('blog-post', 'post', '')",
      "('BAD TYPE', 'post', 'alice')",
    ]) {
      await assert.rejects(
        database.db.exec(
          `INSERT INTO likes (subject_type, subject_id, actor_id) VALUES ${values}`,
        ),
        /check constraint/,
      );
    }
  });

  it("serializes overlapping same-actor requests without duplicate rows", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => likes.set(work, "alice", true)),
    );
    assert.ok(
      results.every((state) => state.count === 1 && state.viewerHasLiked),
    );
    const removals = await Promise.all(
      Array.from({ length: 10 }, () => likes.set(work, "alice", false)),
    );
    assert.ok(
      removals.every((state) => state.count === 0 && !state.viewerHasLiked),
    );
  });

  it("enforces and recovers the persisted write limit without altering a like on rejection", async () => {
    await likes.set(work, "alice", true);
    await database.db.exec("UPDATE like_write_windows SET attempts = 120");
    await assert.rejects(
      likes.set(work, "alice", false),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 429,
    );
    assert.equal(
      (await likes.batch([work], "alice")).items[0]?.viewerHasLiked,
      true,
    );
    assert.equal((await likes.set(work, "bob", true)).count, 2);
    await database.db.exec(
      "UPDATE like_write_windows SET started_at = started_at - interval '1 minute' WHERE actor_id = 'alice'",
    );
    assert.equal((await likes.set(work, "alice", false)).viewerHasLiked, false);
  });

  it("reconciles deletions repeatedly, preserves blocked/hidden history, and removes stale throttle rows", async () => {
    await likes.set(work, "alice", true);
    await likes.set(work, "bob", true);
    await likes.set(post, "alice", true);
    await database.db.exec(
      "UPDATE users SET status = 'blocked' WHERE id = 'alice'; UPDATE blog_posts SET status = 'draft' WHERE id = 'post'; UPDATE like_write_windows SET started_at = started_at - interval '2 days'",
    );
    assert.equal((await cleanup.reconcile()).deleted, 0);
    assert.equal(
      (await database.db.query("SELECT * FROM like_write_windows")).rows.length,
      0,
    );
    await database.db.exec(
      "UPDATE users SET status = 'deleted' WHERE id = 'alice'; UPDATE workshop_works SET deleted_at = now()",
    );
    assert.equal((await cleanup.reconcile()).deleted, 3);
    assert.equal((await cleanup.reconcile()).deleted, 0);
    await database.reset();
    await likes.set(post, "alice", true);
    await database.db.exec("DELETE FROM blog_posts WHERE id = 'post'");
    assert.equal((await cleanup.reconcile()).deleted, 1);
  });

  it("rejects duplicate/unsafe registry definitions at startup", () => {
    assert.throws(
      () => new LikeSubjectRegistry([blogLikeSubjects, blogLikeSubjects]),
    );
    assert.throws(
      () =>
        new LikeSubjectRegistry([
          { ...blogLikeSubjects, view: "users; DROP TABLE likes" },
        ]),
    );
  });

  it("keeps namespaces separate even when subjects have the same identifier", async () => {
    await database.db.exec(
      "INSERT INTO blog_posts (id) VALUES ('public-work')",
    );
    await likes.set(work, "alice", true);
    const article = { ...post, subjectId: work.subjectId };
    assert.equal((await likes.set(article, "alice", true)).count, 1);
    await likes.set(work, "alice", false);
    assert.equal(
      (await likes.batch([article], "alice")).items[0]?.viewerHasLiked,
      true,
    );
  });

  it("bounds cleanup and resumes the remaining deletions on the next run", async () => {
    await database.db.exec(`
      INSERT INTO likes (subject_type, subject_id, actor_id)
      SELECT 'blog-post', 'post', 'removed-' || n FROM generate_series(1, 1001) n
    `);
    assert.equal((await cleanup.reconcile()).deleted, 1000);
    assert.equal((await cleanup.reconcile()).deleted, 1);
    assert.equal((await cleanup.reconcile()).deleted, 0);
  });

  it("rolls back cleanup when a publication is unavailable instead of losing likes", async () => {
    await likes.set(work, "alice", true);
    const definition = (
      await database.db.query<{ definition: string }>(
        "SELECT pg_get_viewdef('blog_like_subjects_v1'::regclass) AS definition",
      )
    ).rows[0]!.definition;
    await database.db.exec(
      "UPDATE users SET status = 'deleted' WHERE id = 'alice'; DROP VIEW blog_like_subjects_v1",
    );
    try {
      await assert.rejects(cleanup.reconcile(), /does not exist/);
      assert.equal(
        (await database.db.query("SELECT * FROM likes")).rows.length,
        1,
      );
      assert.equal(
        (await database.db.query("SELECT * FROM like_write_windows")).rows
          .length,
        1,
      );
    } finally {
      await database.db.exec(
        `CREATE VIEW blog_like_subjects_v1 AS ${definition}`,
      );
    }
  });

  it("never rolls a throttle window backwards when an older concurrent request resumes", async () => {
    await likes.set(work, "alice", true);
    await database.db.exec(
      "UPDATE like_write_windows SET started_at = started_at + interval '1 minute', attempts = 120",
    );
    await assert.rejects(
      likes.set(work, "alice", false),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 429,
    );
    assert.equal(
      (await likes.batch([work], "alice")).items[0]?.viewerHasLiked,
      true,
    );
  });
});
