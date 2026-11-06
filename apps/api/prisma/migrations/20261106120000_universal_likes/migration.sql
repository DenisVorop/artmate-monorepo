BEGIN;

CREATE TABLE "likes" (
  "subject_type" VARCHAR(64) NOT NULL,
  "subject_id" VARCHAR(128) NOT NULL,
  "actor_id" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "likes_pkey" PRIMARY KEY ("subject_type", "subject_id", "actor_id"),
  CONSTRAINT "likes_subject_type_check" CHECK (subject_type ~ '^[a-z][a-z0-9-]{0,63}$'),
  CONSTRAINT "likes_subject_id_check" CHECK (subject_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'),
  CONSTRAINT "likes_actor_id_check" CHECK (actor_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$')
);
CREATE INDEX "likes_actor_id_idx" ON "likes" ("actor_id");

CREATE TABLE "like_write_windows" (
  "actor_id" VARCHAR(128) PRIMARY KEY,
  "started_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL CHECK (attempts > 0)
);
CREATE INDEX "like_write_windows_started_at_idx" ON "like_write_windows" ("started_at");

-- Users-owned publication. No personal details or authentication secrets.
CREATE VIEW customer_like_actors_v1 AS
SELECT id AS actor_id,
       (status = 'active' AND deleted_at IS NULL) AS can_like,
       (status = 'deleted' OR deleted_at IS NOT NULL) AS is_deleted
FROM users;

-- Workshops owns the exact visibility policy. Keep aligned with
-- publicWorkshopWorkWhere; private/hidden rows remain for lifecycle reconciliation.
-- public_id is the stable identity already exposed to clients, never a revision ID.
CREATE VIEW workshop_like_subjects_v1 AS
SELECT w.public_id AS subject_id, shop.owner_id,
       (w.deleted_at IS NULL
        AND w.is_publication_enabled AND w.published_at IS NOT NULL
        AND r.status = 'approved'
        AND c.status = 'published' AND c.published_revision_id IS NOT NULL
        AND cc.status = 'published' AND p.status = 'published'
        AND shop.is_public AND u.status = 'active' AND u.deleted_at IS NULL
       ) IS TRUE AS is_public,
       (w.deleted_at IS NOT NULL OR u.status = 'deleted' OR u.deleted_at IS NOT NULL) AS is_deleted
FROM workshop_works w
JOIN workshops shop ON shop.id = w.workshop_id
JOIN users u ON u.id = shop.owner_id
JOIN colorings c ON c.id = w.coloring_id AND c.collection_id = w.collection_id
JOIN coloring_collections cc ON cc.id = c.collection_id
JOIN products p ON p.id = cc.product_id
LEFT JOIN workshop_work_revisions r ON r.id = w.published_revision_id AND r.work_id = w.id;

-- Blog owns publication. created_by_id is an editor, not the article's author.
CREATE VIEW blog_like_subjects_v1 AS
SELECT id AS subject_id, NULL::text AS owner_id,
       (status = 'published') AS is_public, FALSE AS is_deleted
FROM blog_posts;

COMMIT;
