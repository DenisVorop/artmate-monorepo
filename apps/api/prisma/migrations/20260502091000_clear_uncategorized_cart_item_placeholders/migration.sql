UPDATE "cart_items"
SET
  "category" = NULL,
  "category_slug" = NULL
WHERE "category_slug" = 'bez-kategorii';

UPDATE "order_items"
SET
  "category" = NULL,
  "category_slug" = NULL
WHERE "category_slug" = 'bez-kategorii';
