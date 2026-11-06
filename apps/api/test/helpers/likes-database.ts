import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite, type PGliteInterface } from "@electric-sql/pglite";
import { Prisma } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/prisma/prisma.service";

/** Execute the production SQL and services against PostgreSQL (WASM), not map mocks. */
export async function createLikesDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id text PRIMARY KEY, status text NOT NULL DEFAULT 'active', deleted_at timestamp);
    CREATE TABLE products (id text PRIMARY KEY, status text NOT NULL DEFAULT 'published');
    CREATE TABLE coloring_collections (id text PRIMARY KEY, product_id text NOT NULL, status text NOT NULL DEFAULT 'published');
    CREATE TABLE colorings (id text PRIMARY KEY, collection_id text NOT NULL, status text NOT NULL DEFAULT 'published', published_revision_id text);
    CREATE TABLE workshops (id text PRIMARY KEY, owner_id text NOT NULL, is_public boolean NOT NULL DEFAULT TRUE);
    CREATE TABLE workshop_works (
      id text PRIMARY KEY, public_id text UNIQUE NOT NULL, workshop_id text NOT NULL,
      coloring_id text NOT NULL, collection_id text NOT NULL, published_revision_id text,
      deleted_at timestamp, is_publication_enabled boolean NOT NULL DEFAULT TRUE,
      published_at timestamp DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE workshop_work_revisions (id text PRIMARY KEY, work_id text NOT NULL, status text NOT NULL DEFAULT 'approved');
    CREATE TABLE blog_posts (id text PRIMARY KEY, status text NOT NULL DEFAULT 'published');
  `);
  await db.exec(
    await readFile(
      resolve(
        __dirname,
        "../../prisma/migrations/20261106120000_universal_likes/migration.sql",
      ),
      "utf8",
    ),
  );

  function reader(database: Pick<PGliteInterface, "query">) {
    return {
      $queryRaw: async (sql: Prisma.Sql) =>
        (await database.query(sql.text, [...sql.values])).rows,
      $executeRaw: async (sql: Prisma.Sql) =>
        (await database.query(sql.text, [...sql.values])).affectedRows ?? 0,
    };
  }
  const prisma = {
    ...reader(db),
    $transaction: async <T>(
      callback: (tx: ReturnType<typeof reader>) => Promise<T>,
    ) => db.transaction((tx) => callback(reader(tx))),
  } as unknown as PrismaService;

  async function reset() {
    await db.exec(`
      TRUNCATE likes, like_write_windows, users, products, coloring_collections,
        colorings, workshops, workshop_works, workshop_work_revisions, blog_posts;
      INSERT INTO users (id, status) VALUES
        ('author', 'active'), ('alice', 'active'), ('bob', 'active'),
        ('blocked', 'blocked'), ('deleted', 'deleted');
      INSERT INTO products (id) VALUES ('album');
      INSERT INTO coloring_collections (id, product_id) VALUES ('collection', 'album');
      INSERT INTO colorings (id, collection_id, published_revision_id) VALUES ('coloring', 'collection', 'official-revision');
      INSERT INTO workshops (id, owner_id) VALUES ('workshop', 'author');
      INSERT INTO workshop_works (id, public_id, workshop_id, coloring_id, collection_id, published_revision_id)
        VALUES ('internal-work', 'public-work', 'workshop', 'coloring', 'collection', 'revision');
      INSERT INTO workshop_work_revisions (id, work_id) VALUES ('revision', 'internal-work');
      INSERT INTO blog_posts (id, status) VALUES ('post', 'published'), ('draft', 'draft'), ('archive', 'archived');
    `);
  }

  return { db, prisma, reset };
}
