import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const schemaPath = resolve(
  __dirname,
  "../prisma/migrations/20260916090000_product_characteristics/migration.sql",
);
const backfillPath = resolve(
  __dirname,
  "../prisma/migrations/20260916091000_backfill_product_characteristics/migration.sql",
);

const markers = {
  id: "product_markers_artmate_168",
  slug: "akrilovye-markery-artmate-168-cvetov",
  title: "Акриловые маркеры Artmate, 168 цветов",
};
const markerInstructions =
  "Перед использованием хорошо встряхните маркер с закрытым колпачком. Направьте наконечник вниз и аккуратно нажимайте им на поверхность до появления краски. После работы плотно закрывайте колпачок. Заправка не предусмотрена.";
const markerDescription = `<p>Гибкий нейлоновый наконечник-кисть позволяет менять толщину линии от 1 до 5 мм в зависимости от нажима и наклона.</p><p>Акриловая краска на водной основе обеспечивает яркое плотное покрытие.</p><p>${markerInstructions}</p><p>Комплектация: 168 акриловых маркеров и коробка для хранения.</p>`;
const anime = {
  id: "cmough56b000101p7h5au1d25",
  slug: "raskraska-po-nomeram-anime",
  title: "Раскраска по номерам «Аниме», 25 картин",
};
const cats = {
  id: "cmoslofsh000001qrj9mmaelu",
  slug: "raskraska-po-nomeram-kotiki",
  title: "Раскраска по номерам «Котики», 25 картин",
};
const medieval = {
  id: "cms7z2t4q003j01lg87klgqer",
  slug: "pixel-raskraska-po-nomeram-srednevekovie",
  title: "Раскраска по номерам, по пикселям, средневековье, 25 картин",
};
const mandalas = {
  id: "cmro3l37q003b01lgtmdgfa97",
  slug: "raskraska-po-nomeram-mandali",
  title: "Раскраска по номерам «Мандалы», 25 картин",
};
const medievalInstructions =
  "Каждая страница представляет собой сетку из клеточек с цифровыми и буквенными обозначениями, а внизу размещена готовая цветовая палитра. Следуйте подсказкам, подбирайте соответствующие оттенки и клеточка за клеточкой собирайте цельную картину.";
const mandalaInstructions =
  "Каждая иллюстрация разделена на пронумерованные области, а внизу страницы размещена готовая палитра из 8–17 оттенков. Следуйте цветовым подсказкам или создавайте собственные сочетания.";
const detailedAlbumDescription =
  "Плотная бумага 190 г/м² подходит для акриловых маркеров. Иллюстрации напечатаны с одной стороны листа, а металлическая пружина позволяет раскрывать альбом на 360 градусов. Формат А4 удобен для проработки мелких деталей.";

describe("Product characteristics backfill", () => {
  it("fills verified per-SKU facts without assigning album properties to markers", async () => {
    const db = await createDatabase();
    try {
      await insertProduct(db, markers, markerDescription);
      await insertProduct(
        db,
        anime,
        "Формат А4 и плотная бумага 190 г/м² позволяют использовать самые разные материалы.",
      );
      await insertProduct(db, cats, "Плотная бумага подходит для карандашей.");
      await insertProduct(
        db,
        medieval,
        `<p>${medievalInstructions}</p><p>${detailedAlbumDescription}</p>`,
      );
      await insertProduct(
        db,
        mandalas,
        `<p>${mandalaInstructions}</p><p>${detailedAlbumDescription}</p>`,
      );

      await runBackfill(db);

      const markerFacts = await characteristics(db, markers.id);
      assert.deepEqual(
        markerFacts.map(({ name, value }) => [name, value]),
        [
          ["Количество цветов", "168"],
          ["Тип краски", "Акриловая"],
          ["Основа", "Водная"],
          ["Наконечник", "Гибкая нейлоновая кисть"],
          ["Толщина линии", "1–5 мм"],
          ["Комплектация", "168 акриловых маркеров и коробка для хранения"],
          ["Заправка", "Не предусмотрена"],
        ],
      );
      assert.deepEqual(
        markerFacts
          .filter((fact) => fact.is_highlighted)
          .map((fact) => fact.name),
        ["Количество цветов", "Наконечник"],
      );
      assert.deepEqual(
        (await characteristics(db, anime.id)).map(({ name, value }) => [
          name,
          value,
        ]),
        [
          ["Количество картин", "25"],
          ["Формат", "А4"],
          ["Плотность бумаги", "190 г/м²"],
        ],
      );
      assert.deepEqual(
        (await characteristics(db, cats.id)).map(({ name, value }) => [
          name,
          value,
        ]),
        [["Количество картин", "25"]],
      );
      for (const album of [medieval, mandalas]) {
        const facts = await characteristics(db, album.id);
        assert.deepEqual(
          facts.map((fact) => fact.sort_order),
          [0, 1, 2, 3, 4],
        );
        assert.equal(facts.filter((fact) => fact.is_highlighted).length, 2);
        assert.deepEqual(
          facts.slice(3).map(({ name, value }) => [name, value]),
          [
            ["Печать", "Односторонняя"],
            ["Переплёт", "Металлическая пружина, раскрытие на 360°"],
          ],
        );
      }
      assert.equal(await instructions(db, markers.id), markerInstructions);
      assert.equal(await instructions(db, medieval.id), medievalInstructions);
      assert.equal(await instructions(db, mandalas.id), mandalaInstructions);
      assert.equal(await instructions(db, cats.id), null);
      assert.equal(await instructions(db, anime.id), null);

      const before = await db.query(
        "SELECT * FROM product_characteristics ORDER BY id",
      );
      await runBackfill(db);
      assert.deepEqual(
        (await db.query("SELECT * FROM product_characteristics ORDER BY id"))
          .rows,
        before.rows,
      );
    } finally {
      await db.close();
    }
  });

  it("skips changed evidence, unrelated IDs/slugs/titles and unverified album defaults", async () => {
    const db = await createDatabase();
    try {
      await insertProduct(
        db,
        markers,
        markerDescription
          .replace("от 1 до 5 мм", "от 2 до 6 мм")
          .replace(markerInstructions, "Используйте новый наконечник."),
      );
      await insertProduct(db, anime, "Формат A4, бумага 160 г/м².");
      await insertProduct(db, cats, detailedAlbumDescription);
      await insertProduct(
        db,
        { ...medieval, slug: "changed-slug" },
        detailedAlbumDescription,
      );
      await insertProduct(
        db,
        { ...mandalas, title: "Раскраска по номерам «Мандалы», 20 картин" },
        detailedAlbumDescription,
      );
      await insertProduct(
        db,
        { ...medieval, id: "unknown-product" },
        detailedAlbumDescription,
      );

      await runBackfill(db);

      const markerFacts = await characteristics(db, markers.id);
      assert.equal(
        markerFacts.some((fact) => fact.name === "Толщина линии"),
        false,
      );
      assert.equal(
        markerFacts.some((fact) => fact.name === "Заправка"),
        false,
      );
      assert.deepEqual(
        markerFacts.map((fact) => fact.sort_order),
        [0, 1, 2, 3, 4],
      );
      assert.equal(await instructions(db, markers.id), null);
      assert.deepEqual(
        (await characteristics(db, anime.id)).map((fact) => fact.name),
        ["Количество картин", "Формат"],
      );
      assert.deepEqual(
        (await characteristics(db, cats.id)).map((fact) => fact.name),
        ["Количество картин"],
      );
      for (const id of [medieval.id, mandalas.id, "unknown-product"]) {
        assert.deepEqual(await characteristics(db, id), []);
        assert.equal(await instructions(db, id), null);
      }
    } finally {
      await db.close();
    }
  });

  it("preserves manually entered characteristics and instructions", async () => {
    const db = await createDatabase();
    try {
      await insertProduct(db, markers, markerDescription);
      await db.query(
        "UPDATE products SET usage_instructions = $1 WHERE id = $2",
        ["Инструкция редактора.", markers.id],
      );
      await db.query(
        "INSERT INTO product_characteristics (id, product_id, name, value, is_highlighted, sort_order) VALUES ('manual', $1, 'Материал', 'Выбран редактором', true, 0)",
        [markers.id],
      );

      await runBackfill(db);

      assert.deepEqual(await characteristics(db, markers.id), [
        {
          name: "Материал",
          value: "Выбран редактором",
          is_highlighted: true,
          sort_order: 0,
        },
      ]);
      assert.equal(await instructions(db, markers.id), "Инструкция редактора.");
    } finally {
      await db.close();
    }
  });

  it("keeps intentionally empty instructions on an already edited product", async () => {
    const db = await createDatabase();
    try {
      await insertProduct(db, markers, markerDescription);
      await db.query(
        "INSERT INTO product_characteristics (id, product_id, name, value, is_highlighted, sort_order) VALUES ('manual', $1, 'Количество цветов', '168', true, 0)",
        [markers.id],
      );

      await runBackfill(db);

      assert.equal((await characteristics(db, markers.id)).length, 1);
      assert.equal(await instructions(db, markers.id), null);
    } finally {
      await db.close();
    }
  });

  it("rolls back instructions when inserting characteristics fails", async () => {
    const db = await createDatabase();
    try {
      await insertProduct(db, markers, markerDescription);
      await db.exec(`ALTER TABLE product_characteristics
        ADD CONSTRAINT injected_backfill_failure
        CHECK (name <> 'Количество цветов');`);

      const sql = await readFile(backfillPath, "utf8");
      await assert.rejects(async () => {
        // Execute individually so the test does not rely on the query protocol's
        // implicit transaction around a multi-statement batch. This migration
        // contains no semicolons inside string literals or comments.
        for (const statement of sql.split(";").filter((part) => part.trim())) {
          await db.exec(statement);
        }
      }, /injected_backfill_failure/);
      await db.exec("ROLLBACK");

      assert.equal(await instructions(db, markers.id), null);
      assert.deepEqual(await characteristics(db, markers.id), []);
    } finally {
      await db.close();
    }
  });
});

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE products (
    id VARCHAR(32) PRIMARY KEY,
    slug VARCHAR(180) NOT NULL UNIQUE,
    title VARCHAR(220) NOT NULL,
    description TEXT
  );`);
  await db.exec(await readFile(schemaPath, "utf8"));
  return db;
}

async function insertProduct(
  db: PGlite,
  product: typeof markers,
  description: string,
) {
  await db.query(
    "INSERT INTO products (id, slug, title, description) VALUES ($1, $2, $3, $4)",
    [product.id, product.slug, product.title, description],
  );
}

async function runBackfill(db: PGlite) {
  await db.exec(await readFile(backfillPath, "utf8"));
}

async function characteristics(db: PGlite, productId: string) {
  return (
    await db.query<{
      name: string;
      value: string;
      is_highlighted: boolean;
      sort_order: number;
    }>(
      "SELECT name, value, is_highlighted, sort_order FROM product_characteristics WHERE product_id = $1 ORDER BY sort_order",
      [productId],
    )
  ).rows;
}

async function instructions(db: PGlite, productId: string) {
  return (
    await db.query<{ usage_instructions: string | null }>(
      "SELECT usage_instructions FROM products WHERE id = $1",
      [productId],
    )
  ).rows[0]?.usage_instructions;
}
