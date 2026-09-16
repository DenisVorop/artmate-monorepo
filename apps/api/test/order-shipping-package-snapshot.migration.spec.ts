import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260916161000_order_shipping_package_snapshot/migration.sql",
);
const snapshot = {
  version: 1,
  id: "shipping_album",
  code: "album",
  weightGrams: 400,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 1,
};

describe("order shipping package snapshot migration", () => {
  it("keeps historical rows nullable and round-trips valid snapshots", async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE order_items (id TEXT PRIMARY KEY, title TEXT);
        INSERT INTO order_items VALUES ('legacy', 'Historical title');`);
      await db.exec(await readFile(migrationPath, "utf8"));
      assert.deepEqual((await db.query("SELECT * FROM order_items")).rows, [
        {
          id: "legacy",
          title: "Historical title",
          shipping_package_snapshot: null,
        },
      ]);
      await db.query(
        "INSERT INTO order_items (id, shipping_package_snapshot) VALUES ($1, $2::jsonb)",
        ["current", JSON.stringify(snapshot)],
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT shipping_package_snapshot FROM order_items WHERE id = 'current'",
          )
        ).rows,
        [{ shipping_package_snapshot: snapshot }],
      );
    } finally {
      await db.close();
    }
  });

  it("rejects incomplete, wrongly typed, unversioned and out-of-range JSON", async () => {
    const db = new PGlite();
    try {
      await db.exec("CREATE TABLE order_items (id TEXT PRIMARY KEY)");
      await db.exec(await readFile(migrationPath, "utf8"));
      const invalid: unknown[] = [
        null,
        [],
        "text",
        1,
        {},
        { ...snapshot, version: 2 },
        { ...snapshot, version: "1" },
        { ...snapshot, id: "" },
        { ...snapshot, id: " album " },
        { ...snapshot, id: "a".repeat(33) },
        { ...snapshot, id: 123 },
        { ...snapshot, code: "Album" },
        { ...snapshot, code: null },
        { ...snapshot, code: "a".repeat(65) },
      ];
      for (const key of Object.keys(snapshot)) {
        const missing = { ...snapshot } as Record<string, unknown>;
        delete missing[key];
        invalid.push(missing);
      }
      for (const key of ["weightGrams", "lengthCm", "widthCm", "heightCm"]) {
        for (const value of [
          null,
          "1",
          false,
          {},
          [],
          0,
          -1,
          0.5,
          1.5,
          2147483648,
        ]) {
          invalid.push({ ...snapshot, [key]: value });
        }
      }
      for (const [index, value] of invalid.entries()) {
        await assert.rejects(
          db.query(
            "INSERT INTO order_items (id, shipping_package_snapshot) VALUES ($1, $2::jsonb)",
            [`invalid-${index}`, JSON.stringify(value)],
          ),
          `Must reject ${JSON.stringify(value)}`,
        );
      }
    } finally {
      await db.close();
    }
  });
});
