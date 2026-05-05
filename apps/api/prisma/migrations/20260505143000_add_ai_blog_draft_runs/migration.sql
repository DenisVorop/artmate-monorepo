-- CreateEnum
CREATE TYPE "ai_blog_draft_source_type" AS ENUM ('mixed', 'product_news', 'internet_research');

-- CreateEnum
CREATE TYPE "ai_blog_draft_run_status" AS ENUM ('topic_review', 'outline_review', 'draft_review', 'draft_created', 'rejected', 'failed');

-- CreateTable
CREATE TABLE "ai_blog_draft_runs" (
    "id" TEXT NOT NULL,
    "source_type" "ai_blog_draft_source_type" NOT NULL DEFAULT 'mixed',
    "status" "ai_blog_draft_run_status" NOT NULL DEFAULT 'topic_review',
    "prompt" TEXT,
    "topics" JSONB,
    "selected_topic_index" INTEGER,
    "outline" JSONB,
    "draft" JSONB,
    "sources" JSONB,
    "error_message" TEXT,
    "blog_post_id" TEXT,
    "created_by_id" TEXT,
    "telegram_chat_id" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_blog_draft_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_blog_draft_runs_status_updated_at_idx" ON "ai_blog_draft_runs"("status", "updated_at");

-- CreateIndex
CREATE INDEX "ai_blog_draft_runs_source_type_created_at_idx" ON "ai_blog_draft_runs"("source_type", "created_at");

-- CreateIndex
CREATE INDEX "ai_blog_draft_runs_blog_post_id_idx" ON "ai_blog_draft_runs"("blog_post_id");

-- CreateIndex
CREATE INDEX "ai_blog_draft_runs_created_by_id_idx" ON "ai_blog_draft_runs"("created_by_id");

-- AddForeignKey
ALTER TABLE "ai_blog_draft_runs" ADD CONSTRAINT "ai_blog_draft_runs_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_blog_draft_runs" ADD CONSTRAINT "ai_blog_draft_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
