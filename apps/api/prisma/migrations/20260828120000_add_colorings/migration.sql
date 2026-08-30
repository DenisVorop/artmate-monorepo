CREATE TYPE "coloring_status" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "colorings" (
  "id" VARCHAR(32) NOT NULL,
  "product_id" VARCHAR(32) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL,
  "status" "coloring_status" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "colorings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "colorings_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "coloring_theme_assignments" (
  "coloring_id" VARCHAR(32) NOT NULL,
  "tag_id" VARCHAR(32) NOT NULL,
  "tag_group" "product_tag_group" NOT NULL DEFAULT 'theme',

  CONSTRAINT "coloring_theme_assignments_pkey" PRIMARY KEY ("coloring_id", "tag_id"),
  CONSTRAINT "coloring_theme_assignments_tag_group_check" CHECK ("tag_group" = 'theme')
);

CREATE UNIQUE INDEX "colorings_slug_key" ON "colorings"("slug");
CREATE UNIQUE INDEX "colorings_product_id_position_key" ON "colorings"("product_id", "position");
CREATE UNIQUE INDEX "product_tags_id_group_key" ON "product_tags"("id", "group");
CREATE INDEX "coloring_theme_assignments_tag_id_idx" ON "coloring_theme_assignments"("tag_id");

ALTER TABLE "colorings"
  ADD CONSTRAINT "colorings_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "coloring_theme_assignments"
  ADD CONSTRAINT "coloring_theme_assignments_coloring_id_fkey"
  FOREIGN KEY ("coloring_id") REFERENCES "colorings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coloring_theme_assignments"
  ADD CONSTRAINT "coloring_theme_assignments_tag_id_tag_group_fkey"
  FOREIGN KEY ("tag_id", "tag_group") REFERENCES "product_tags"("id", "group")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
