-- Historical orders remain nullable; never reconstruct their package from a
-- current product profile. New CDEK orders require a snapshot in application code.
ALTER TABLE "order_items" ADD COLUMN "shipping_package_snapshot" JSONB;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_shipping_package_snapshot_check"
CHECK (
  "shipping_package_snapshot" IS NULL OR COALESCE(
    jsonb_typeof("shipping_package_snapshot") = 'object'
    AND "shipping_package_snapshot" ?& ARRAY[
      'version', 'id', 'code', 'weightGrams', 'lengthCm', 'widthCm', 'heightCm'
    ]
    AND "shipping_package_snapshot"->'version' = '1'::jsonb
    AND jsonb_typeof("shipping_package_snapshot"->'id') = 'string'
    AND char_length("shipping_package_snapshot"->>'id') BETWEEN 1 AND 32
    AND ("shipping_package_snapshot"->>'id') !~ '^[[:space:]]|[[:space:]]$'
    AND jsonb_typeof("shipping_package_snapshot"->'code') = 'string'
    AND ("shipping_package_snapshot"->>'code') ~ '^[a-z][a-z0-9_-]{0,63}$'
    AND CASE WHEN jsonb_typeof("shipping_package_snapshot"->'weightGrams') = 'number'
      THEN ("shipping_package_snapshot"->>'weightGrams')::numeric BETWEEN 1 AND 2147483647
        AND trunc(("shipping_package_snapshot"->>'weightGrams')::numeric)
          = ("shipping_package_snapshot"->>'weightGrams')::numeric
      ELSE FALSE END
    AND CASE WHEN jsonb_typeof("shipping_package_snapshot"->'lengthCm') = 'number'
      THEN ("shipping_package_snapshot"->>'lengthCm')::numeric BETWEEN 1 AND 2147483647
        AND trunc(("shipping_package_snapshot"->>'lengthCm')::numeric)
          = ("shipping_package_snapshot"->>'lengthCm')::numeric
      ELSE FALSE END
    AND CASE WHEN jsonb_typeof("shipping_package_snapshot"->'widthCm') = 'number'
      THEN ("shipping_package_snapshot"->>'widthCm')::numeric BETWEEN 1 AND 2147483647
        AND trunc(("shipping_package_snapshot"->>'widthCm')::numeric)
          = ("shipping_package_snapshot"->>'widthCm')::numeric
      ELSE FALSE END
    AND CASE WHEN jsonb_typeof("shipping_package_snapshot"->'heightCm') = 'number'
      THEN ("shipping_package_snapshot"->>'heightCm')::numeric BETWEEN 1 AND 2147483647
        AND trunc(("shipping_package_snapshot"->>'heightCm')::numeric)
          = ("shipping_package_snapshot"->>'heightCm')::numeric
      ELSE FALSE END,
    FALSE
  )
);
