import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const snapshotSchemaPath = resolve(
  __dirname,
  "../prisma/migrations/20260916161000_order_shipping_package_snapshot/migration.sql",
);
const backfillPath = resolve(
  __dirname,
  "../prisma/migrations/20260916162000_backfill_legacy_order_shipping_package/migration.sql",
);

const targetOrderId = "AM-D22C13FE";
const snapshot = {
  version: 1,
  id: "shipping_album",
  code: "album",
  weightGrams: 400,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 1,
};
const targetItems = [
  {
    productId: "cmouggbdz000001p7txxxmq6i",
    slug: "raskraska-po-nomeram-peizaji",
  },
  {
    productId: "cmougm5r0000801p73xta4gkt",
    slug: "raskraska-po-nomeram-peizaji-2",
  },
  {
    productId: "prod_yaponiya_1232256239",
    slug: "raskraska-po-nomeram-yaponiya",
  },
] as const;

type OrderOptions = Partial<{
  id: string;
  deliveryProvider: string;
  status: string;
  crmStatus: string;
}>;

type ItemOptions = Partial<{
  productId: string;
  slug: string;
  quantity: number;
  price: number;
  lineTotal: number;
  shippingPackageSnapshot: unknown;
}>;

describe("legacy order shipping package backfill", () => {
  it("fills only the approved unpaid CDEK order, preserves fields, and is idempotent", async () => {
    const db = await createDatabase();
    try {
      await insertOrder(db);
      await insertOrder(db, { id: "unrelated-order" });
      await insertItems(db, targetOrderId);
      await insertItems(db, "unrelated-order");
      const beforeOrders = await db.query("SELECT * FROM orders ORDER BY id");
      const beforeItems = await db.query(
        "SELECT order_id, product_id, slug, quantity, price, line_total FROM order_items ORDER BY order_id, product_id",
      );

      await runBackfill(db);

      assert.deepEqual(await snapshots(db, targetOrderId), [
        snapshot,
        snapshot,
        snapshot,
      ]);
      assert.deepEqual(await snapshots(db, "unrelated-order"), [
        null,
        null,
        null,
      ]);
      assert.deepEqual(
        (await db.query("SELECT * FROM orders ORDER BY id")).rows,
        beforeOrders.rows,
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT order_id, product_id, slug, quantity, price, line_total FROM order_items ORDER BY order_id, product_id",
          )
        ).rows,
        beforeItems.rows,
      );

      const afterFirstRun = await db.query(
        "SELECT * FROM order_items ORDER BY order_id, product_id",
      );
      await runBackfill(db);
      assert.deepEqual(
        (
          await db.query(
            "SELECT * FROM order_items ORDER BY order_id, product_id",
          )
        ).rows,
        afterFirstRun.rows,
      );
    } finally {
      await db.close();
    }
  });

  it("does nothing when the approved order is missing", async () => {
    const db = await createDatabase();
    try {
      await insertOrder(db, { id: "another-order" });
      await insertItems(db, "another-order");
      const before = await db.query(
        "SELECT * FROM order_items ORDER BY order_id, product_id",
      );
      await runBackfill(db);
      assert.deepEqual(
        (
          await db.query(
            "SELECT * FROM order_items ORDER BY order_id, product_id",
          )
        ).rows,
        before.rows,
      );
    } finally {
      await db.close();
    }
  });

  it("honors payment, provider, and shipment guards", async () => {
    const guards: Array<[string, OrderOptions, boolean]> = [
      ["paid", { status: "paid" }, false],
      ["cancelled", { crmStatus: "cancelled" }, false],
      ["wrong-provider", { deliveryProvider: "ozon" }, false],
      ["has-shipment", {}, true],
    ];
    for (const [label, options, hasShipment] of guards) {
      const db = await createDatabase();
      try {
        await insertOrder(db, options);
        await insertItems(db, targetOrderId);
        if (hasShipment) {
          await db.query(
            "INSERT INTO order_shipments (id, order_id) VALUES ($1, $2)",
            [`shipment-${label}`, targetOrderId],
          );
        }
        await runBackfill(db);
        assert.deepEqual(
          await snapshots(db, targetOrderId),
          [null, null, null],
          label,
        );
      } finally {
        await db.close();
      }
    }
  });

  it("requires the exact three-item composition before updating any item", async () => {
    const variants: Array<[string, ItemOptions[]]> = [
      ["missing", targetItems.slice(0, 2)],
      [
        "extra",
        [...targetItems, { productId: "other-product", slug: "other-slug" }],
      ],
      [
        "wrong-slug",
        [{ ...targetItems[0], slug: "changed-slug" }, ...targetItems.slice(1)],
      ],
      [
        "wrong-product",
        [
          { ...targetItems[0], productId: "changed-product" },
          ...targetItems.slice(1),
        ],
      ],
      [
        "wrong-quantity",
        [{ ...targetItems[0], quantity: 2 }, ...targetItems.slice(1)],
      ],
    ];
    for (const [label, items] of variants) {
      const db = await createDatabase();
      try {
        await insertOrder(db);
        await insertItems(db, targetOrderId, items);
        await runBackfill(db);
        assert.deepEqual(
          await snapshots(db, targetOrderId),
          Array(items.length).fill(null),
          label,
        );
      } finally {
        await db.close();
      }
    }
  });

  it("preserves existing snapshots while filling only NULL snapshots", async () => {
    const db = await createDatabase();
    const existingSnapshot = { ...snapshot, weightGrams: 777, lengthCm: 41 };
    try {
      await insertOrder(db);
      await insertItems(db, targetOrderId, [
        { ...targetItems[0], shippingPackageSnapshot: existingSnapshot },
        targetItems[1],
        targetItems[2],
      ]);
      await runBackfill(db);
      assert.deepEqual(await snapshots(db, targetOrderId), [
        existingSnapshot,
        snapshot,
        snapshot,
      ]);
    } finally {
      await db.close();
    }
  });
});

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      delivery_provider TEXT NOT NULL,
      status TEXT NOT NULL,
      crm_status TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      total INTEGER NOT NULL,
      note TEXT NOT NULL
    );
    CREATE TABLE order_items (
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      PRIMARY KEY (order_id, product_id)
    );
    CREATE TABLE order_shipments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL);
  `);
  await db.exec(await readFile(snapshotSchemaPath, "utf8"));
  return db;
}

async function insertOrder(db: PGlite, options: OrderOptions = {}) {
  await db.query(
    "INSERT INTO orders (id, delivery_provider, status, crm_status, subtotal, total, note) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      options.id ?? targetOrderId,
      options.deliveryProvider ?? "cdek",
      options.status ?? "pending_payment",
      options.crmStatus ?? "waiting_payment",
      1200,
      1450,
      "legacy order metadata",
    ],
  );
}

async function insertItems(
  db: PGlite,
  orderId: string,
  items: readonly ItemOptions[] = targetItems,
) {
  for (const [index, item] of items.entries()) {
    const defaults = targetItems[index] ?? targetItems[0];
    await db.query(
      "INSERT INTO order_items (order_id, product_id, slug, quantity, price, line_total, shipping_package_snapshot) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)",
      [
        orderId,
        item.productId ?? defaults.productId,
        item.slug ?? defaults.slug,
        item.quantity ?? 1,
        item.price ?? 400,
        item.lineTotal ?? 400,
        item.shippingPackageSnapshot === undefined
          ? null
          : JSON.stringify(item.shippingPackageSnapshot),
      ],
    );
  }
}

async function runBackfill(db: PGlite) {
  await db.exec(await readFile(backfillPath, "utf8"));
}

async function snapshots(db: PGlite, orderId: string) {
  const result = await db.query<{ shipping_package_snapshot: unknown }>(
    "SELECT shipping_package_snapshot FROM order_items WHERE order_id = $1 ORDER BY product_id",
    [orderId],
  );
  return result.rows.map((row) => row.shipping_package_snapshot);
}
