CREATE TABLE "product_categories" (
  "id" VARCHAR(32) NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "image" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

INSERT INTO "product_categories" ("id", "slug", "title", "image")
VALUES
  ('raskraski', 'raskraski', 'Раскраски', 'https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/1.webp'),
  ('cats', 'kotiki', 'Котики', 'https://basket-20.wbbasket.ru/vol3414/part341439/341439176/images/big/1.webp'),
  ('landscapes', 'peizazhi', 'Пейзажи', 'https://basket-21.wbbasket.ru/vol3625/part362516/362516234/images/big/1.webp'),
  ('pop-art', 'pop-art', 'Поп-арт', 'https://basket-24.wbbasket.ru/vol4261/part426101/426101848/images/big/1.webp'),
  ('city', 'gorod', 'Город', 'https://basket-27.wbbasket.ru/vol5072/part507212/507212193/images/big/1.webp'),
  ('anime', 'anime', 'Аниме', 'https://basket-28.wbbasket.ru/vol5236/part523638/523638625/images/big/1.webp'),
  ('winter', 'zima', 'Зима', 'https://basket-30.wbbasket.ru/vol6057/part605779/605779011/images/big/1.webp'),
  ('mystic-forest', 'misticheskiy-les', 'Мистический лес', 'https://basket-30.wbbasket.ru/vol6058/part605811/605811015/images/big/1.webp'),
  ('flowers', 'cvety', 'Цветы', 'https://basket-35.wbbasket.ru/vol7625/part762512/762512016/images/big/1.webp'),
  ('princesses', 'printsessy', 'Принцессы', 'https://basket-41.wbbasket.ru/vol9808/part980896/980896594/images/big/1.webp'),
  ('animals', 'zhivotnye', 'Животные', 'https://basket-41.wbbasket.ru/vol9781/part978180/978180831/images/big/1.webp');

ALTER TABLE "products"
  ADD COLUMN "category_id" VARCHAR(32),
  ADD COLUMN "is_hit" BOOLEAN NOT NULL DEFAULT false;

UPDATE "products"
SET "category_id" = 'raskraski'
WHERE "category_id" IS NULL;

ALTER TABLE "products"
  ALTER COLUMN "category_id" SET NOT NULL;

CREATE INDEX "products_category_id_idx" ON "products"("category_id");
CREATE INDEX "products_status_is_hit_created_at_idx" ON "products"("status", "is_hit", "created_at");

ALTER TABLE "products"
  ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "product_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
