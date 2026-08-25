import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

async function readPageSource() {
  const directory = new URL("../src/_pages/payment-and-delivery/", import.meta.url);
  const entries = await readdir(directory, { recursive: true });
  const files = entries.filter((entry) => entry.endsWith(".tsx")).sort();
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, directory), "utf8")),
  );

  return sources.join("\n");
}

test("payment and delivery page names every supported provider and omits requisites", async () => {
  const source = await readPageSource();

  for (const provider of ["СДЭК", "Ozon", "T-Bank", "Ozon Pay"]) {
    assert.match(source, new RegExp(provider));
  }

  assert.match(source, /по России/);
  assert.match(source, /доступн(?:ый|ые)\s+пункт(?:ы)?\s+выдачи/);

  assert.doesNotMatch(
    source,
    /companyDetails|Реквизиты продавца|ИНН|БИК|Корреспондентский счет|Расчетный счет/,
  );
});

test("payment and delivery page exposes a semantic journey and support routes", async () => {
  const source = await readPageSource();

  assert.match(source, /<ol/);
  assert.match(source, /aria-labelledby=/);
  assert.match(source, /routes\.catalog/);
  assert.match(source, /routes\.legal\.returnPolicy/);
  assert.match(source, /routes\.faq/);
  assert.match(source, /routes\.contacts/);
});
