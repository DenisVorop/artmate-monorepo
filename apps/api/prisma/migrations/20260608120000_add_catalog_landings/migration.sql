CREATE TYPE "product_tag_group" AS ENUM ('format', 'theme', 'audience', 'mood', 'difficulty');

CREATE TYPE "catalog_landing_status" AS ENUM ('draft', 'published', 'archived');

CREATE TYPE "catalog_landing_product_source" AS ENUM ('manual', 'tags', 'mixed');

CREATE TYPE "catalog_landing_tag_rule_mode" AS ENUM ('required', 'optional', 'excluded');

CREATE TYPE "catalog_landing_product_override_mode" AS ENUM ('included', 'excluded');

CREATE TABLE "product_tags" (
  "id" VARCHAR(32) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "group" "product_tag_group" NOT NULL DEFAULT 'theme',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_tag_assignments" (
  "product_id" VARCHAR(32) NOT NULL,
  "tag_id" VARCHAR(32) NOT NULL,

  CONSTRAINT "product_tag_assignments_pkey" PRIMARY KEY ("product_id", "tag_id")
);

CREATE TABLE "catalog_landing_pages" (
  "id" VARCHAR(32) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "status" "catalog_landing_status" NOT NULL DEFAULT 'draft',
  "is_indexable" BOOLEAN NOT NULL DEFAULT true,
  "h1" VARCHAR(220) NOT NULL,
  "meta_title" VARCHAR(260) NOT NULL,
  "meta_description" VARCHAR(500) NOT NULL,
  "intro_html" TEXT,
  "seo_title" VARCHAR(220),
  "seo_html" TEXT,
  "product_source" "catalog_landing_product_source" NOT NULL DEFAULT 'tags',
  "min_products" INTEGER NOT NULL DEFAULT 2,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "catalog_landing_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_landing_tag_rules" (
  "landing_id" VARCHAR(32) NOT NULL,
  "tag_id" VARCHAR(32) NOT NULL,
  "mode" "catalog_landing_tag_rule_mode" NOT NULL,

  CONSTRAINT "catalog_landing_tag_rules_pkey" PRIMARY KEY ("landing_id", "tag_id")
);

CREATE TABLE "catalog_landing_product_overrides" (
  "landing_id" VARCHAR(32) NOT NULL,
  "product_id" VARCHAR(32) NOT NULL,
  "mode" "catalog_landing_product_override_mode" NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "catalog_landing_product_overrides_pkey" PRIMARY KEY ("landing_id", "product_id")
);

CREATE TABLE "catalog_landing_faq_items" (
  "id" VARCHAR(32) NOT NULL,
  "landing_id" VARCHAR(32) NOT NULL,
  "question" VARCHAR(300) NOT NULL,
  "answer_html" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "catalog_landing_faq_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_tags_slug_key" ON "product_tags"("slug");
CREATE INDEX "product_tags_group_title_idx" ON "product_tags"("group", "title");
CREATE INDEX "product_tag_assignments_tag_id_idx" ON "product_tag_assignments"("tag_id");

CREATE UNIQUE INDEX "catalog_landing_pages_slug_key" ON "catalog_landing_pages"("slug");
CREATE INDEX "catalog_landing_pages_status_updated_at_idx" ON "catalog_landing_pages"("status", "updated_at");
CREATE INDEX "catalog_landing_pages_is_indexable_status_idx" ON "catalog_landing_pages"("is_indexable", "status");
CREATE INDEX "catalog_landing_tag_rules_tag_id_idx" ON "catalog_landing_tag_rules"("tag_id");
CREATE INDEX "catalog_landing_product_overrides_product_id_idx" ON "catalog_landing_product_overrides"("product_id");
CREATE INDEX "catalog_landing_product_overrides_landing_id_sort_order_idx" ON "catalog_landing_product_overrides"("landing_id", "sort_order");
CREATE INDEX "catalog_landing_faq_items_landing_id_sort_order_idx" ON "catalog_landing_faq_items"("landing_id", "sort_order");

ALTER TABLE "product_tag_assignments"
  ADD CONSTRAINT "product_tag_assignments_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_tag_assignments"
  ADD CONSTRAINT "product_tag_assignments_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "product_tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_landing_tag_rules"
  ADD CONSTRAINT "catalog_landing_tag_rules_landing_id_fkey"
  FOREIGN KEY ("landing_id") REFERENCES "catalog_landing_pages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_landing_tag_rules"
  ADD CONSTRAINT "catalog_landing_tag_rules_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "product_tags"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "catalog_landing_product_overrides"
  ADD CONSTRAINT "catalog_landing_product_overrides_landing_id_fkey"
  FOREIGN KEY ("landing_id") REFERENCES "catalog_landing_pages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_landing_product_overrides"
  ADD CONSTRAINT "catalog_landing_product_overrides_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_landing_faq_items"
  ADD CONSTRAINT "catalog_landing_faq_items_landing_id_fkey"
  FOREIGN KEY ("landing_id") REFERENCES "catalog_landing_pages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
