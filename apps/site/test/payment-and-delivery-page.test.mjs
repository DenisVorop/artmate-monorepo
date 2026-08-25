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

  assert.match(
    source,
    /(?:достав[а-яё]*|пункт[а-яё]*\s+выдачи|ПВЗ)(?=[^.!?]{0,240}СДЭК)(?=[^.!?]{0,240}\bOzon\b(?!\s+Pay\b))[^.!?]{0,240}[.!?]/iu,
  );
  assert.match(source, /\bT-Bank\b/);
  assert.match(source, /\bOzon Pay\b/);

  assert.match(
    source,
    /достав[а-яё]*\s+по России[^.!?]{0,180}(?:где|если)[^.!?]{0,120}доступн(?:ый|ые)\s+пункт(?:ы)?\s+выдачи/iu,
  );
  assert.doesNotMatch(source, /по\s+всей\s+России/iu);
  assert.match(
    source,
    /ориентировочн[а-яё]*\s+срок[^.!?]{0,120}только\s+если[^.!?]{0,120}(?:его\s+)?переда[её]т\s+служб[а-яё]*\s+доставки/iu,
  );

  const forbiddenRequisites = new RegExp(
    [
      String.raw`(?<![\p{L}\p{N}_])(?:companyDetails|legalName|shortName|legalAddress|taxId|inn|kpp|ogrn|ogrnip|registrationNumberLabel|registrationNumber|registrationDate|bankName|bankBik|bik|bankAccount|bankCorrespondentAccount|correspondentAccount|checkingAccount)(?![\p{L}\p{N}_])`,
      String.raw`Реквизиты\s+продавца`,
      String.raw`(?<![\p{L}\p{N}_])(?:ИНН|КПП|ОГРНИП|ОГРН|БИК)(?![\p{L}\p{N}_])`,
      String.raw`Юридическ(?:ий|ого)\s+адрес`,
      String.raw`Банк\s+получателя`,
      String.raw`Корреспондентск(?:ий|ого)\s+сч[её]т`,
      String.raw`Расч[её]тн(?:ый|ого)\s+сч[её]т`,
    ].join("|"),
    "iu",
  );

  assert.doesNotMatch(source, forbiddenRequisites);
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

test("payment and delivery metadata names supported providers", async () => {
  const registry = await readFile(
    new URL("../src/shared/lib/seo/registry.ts", import.meta.url),
    "utf8",
  );
  const start = registry.indexOf("paymentAndDelivery:");
  const end = registry.indexOf("\n  account:", start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const paymentAndDeliveryMetadata = registry.slice(start, end);

  for (const provider of ["СДЭК", "Ozon", "T-Bank", "Ozon Pay"]) {
    assert.match(paymentAndDeliveryMetadata, new RegExp(provider));
  }
});
