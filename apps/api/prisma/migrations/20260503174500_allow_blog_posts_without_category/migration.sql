ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_category_id_fkey";

ALTER TABLE "blog_posts" ALTER COLUMN "category_id" DROP NOT NULL;

ALTER TABLE "blog_posts"
  ADD CONSTRAINT "blog_posts_category_id_fkey"
  FOREIGN KEY ("category_id")
  REFERENCES "blog_categories"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
