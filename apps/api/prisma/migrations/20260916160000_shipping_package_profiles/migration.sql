BEGIN;

CREATE TABLE "shipping_package_profiles" (
  "id" VARCHAR(32) NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "weight_grams" INTEGER NOT NULL,
  "length_cm" INTEGER NOT NULL,
  "width_cm" INTEGER NOT NULL,
  "height_cm" INTEGER NOT NULL,
  CONSTRAINT "shipping_package_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_package_profiles_code_check"
    CHECK ("code" ~ '^[a-z][a-z0-9_-]{0,63}$'),
  CONSTRAINT "shipping_package_profiles_dimensions_check"
    CHECK (
      "weight_grams" > 0
      AND "length_cm" > 0
      AND "width_cm" > 0
      AND "height_cm" > 0
    )
);

CREATE UNIQUE INDEX "shipping_package_profiles_code_key"
  ON "shipping_package_profiles"("code");

-- Ready-to-ship marker package, measured values supplied by the owner on 2026-09-16.
INSERT INTO "shipping_package_profiles" (
  "id",
  "code",
  "weight_grams",
  "length_cm",
  "width_cm",
  "height_cm"
)
VALUES ('shipping_markers', 'markers', 2600, 31, 16, 11);

-- Preserve the running production album configuration verified on 2026-09-16.
-- These are package measurements, not sheet dimensions from characteristics.
INSERT INTO "shipping_package_profiles" (
  "id",
  "code",
  "weight_grams",
  "length_cm",
  "width_cm",
  "height_cm"
)
VALUES ('shipping_album', 'album', 400, 40, 30, 1);

ALTER TABLE "products"
  ADD COLUMN "shipping_package_profile_id" VARCHAR(32);

CREATE INDEX "products_shipping_package_profile_id_idx"
  ON "products"("shipping_package_profile_id");

ALTER TABLE "products"
  ADD CONSTRAINT "products_shipping_package_profile_id_fkey"
  FOREIGN KEY ("shipping_package_profile_id") REFERENCES "shipping_package_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "products"
SET "shipping_package_profile_id" = 'shipping_markers'
WHERE "id" = 'product_markers_artmate_168'
  AND "slug" = 'akrilovye-markery-artmate-168-cvetov';

UPDATE "products"
SET "shipping_package_profile_id" = 'shipping_album'
WHERE ("id", "slug") IN (
  ('cmpyaoifi000701qio3irdekb', 'raskraska-po-nomeram-fantasy'),
  ('cmougkcsm000501p79weu6w0i', 'raskraska-po-nomeram-zhivotnie'),
  ('cmougisyx000301p7w8m7rus8', 'raskraska-po-nomeram-kotiki-2'),
  ('cmouggbdz000001p7txxxmq6i', 'raskraska-po-nomeram-peizaji'),
  ('prod_otpusk_5741065761', 'raskraska-po-nomeram-otpusk'),
  ('cms7z2t4q003j01lg87klgqer', 'pixel-raskraska-po-nomeram-srednevekovie'),
  ('cmro3l37q003b01lgtmdgfa97', 'raskraska-po-nomeram-mandali'),
  ('prod_yaponiya_1232256239', 'raskraska-po-nomeram-yaponiya'),
  ('cmougm5r0000801p73xta4gkt', 'raskraska-po-nomeram-peizaji-2'),
  ('cmougll2i000701p7u90vr5w9', 'raskraska-po-nomeram-food'),
  ('cmougkzbp000601p7tp5c3puq', 'raskraska-po-nomeram-princesses'),
  ('cmougjoql000401p79un81qnf', 'raskraska-po-nomeram-flowers'),
  ('cmougi23d000201p70dnxtyg4', 'pixel-raskraska-po-nomeram-mystic-forest'),
  ('cmough56b000101p7h5au1d25', 'raskraska-po-nomeram-anime'),
  ('cmoslofsh000001qrj9mmaelu', 'raskraska-po-nomeram-kotiki')
);

COMMIT;
