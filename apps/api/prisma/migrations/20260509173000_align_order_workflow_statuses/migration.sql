-- AlterEnum
ALTER TYPE "order_crm_status" ADD VALUE 'delivering';

-- Backfill already paid orders into the completed workflow column.
UPDATE "orders"
SET "crm_status" = 'completed'
WHERE "status" = 'paid';
