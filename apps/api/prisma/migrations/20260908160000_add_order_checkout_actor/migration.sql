-- AlterTable
ALTER TABLE "orders" ADD COLUMN "checkout_actor_user_id" TEXT;

-- Preserve the authenticated checkout identity while leaving historical guest
-- orders null, including orders that were attached to an account after payment.
UPDATE "orders" AS "order"
SET "checkout_actor_user_id" = "order"."user_id"
WHERE "order"."user_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "order_history" AS "history"
    WHERE "history"."order_id" = "order"."id"
      AND "history"."event_type" = 'status_changed'
      AND "history"."payload"->>'source' = 'order_created'
      AND "history"."author_id" IS NULL
  );
