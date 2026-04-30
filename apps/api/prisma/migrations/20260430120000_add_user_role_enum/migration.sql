-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('customer', 'admin');

-- Backfill
UPDATE "users"
SET "roles" = ARRAY['customer']::TEXT[]
WHERE "roles" IS NULL OR cardinality("roles") = 0;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "roles" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "roles" TYPE "user_role"[]
  USING "roles"::"user_role"[];
ALTER TABLE "users" ALTER COLUMN "roles" SET DEFAULT ARRAY['customer']::"user_role"[];
