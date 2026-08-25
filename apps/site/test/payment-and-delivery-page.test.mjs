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

function readPageFile(file) {
  return readFile(new URL(`../src/_pages/payment-and-delivery/${file}`, import.meta.url), "utf8");
}

test("payment and delivery labels and step numbers use accessible contrast classes", async () => {
  const [orderSteps, serviceDetails] = await Promise.all([
    readPageFile("ui/order-steps.tsx"),
    readPageFile("ui/service-details.tsx"),
  ]);

  assert.match(orderSteps, /<SectionLabel[^>]*className="text-rose-700"[^>]*>/u);
  assert.match(orderSteps, /className="[^"]*\btext-foreground\/70\b[^"]*"/u);
  assert.doesNotMatch(orderSteps, /text-foreground\/45/u);
  assert.match(serviceDetails, /<SectionLabel[^>]*className="text-emerald-700"[^>]*>/u);
});

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

test("payment and delivery page composes every page section", async () => {
  const composition = await readPageFile("index.tsx");

  for (const component of ["Hero", "OrderSteps", "ServiceDetails", "Help"]) {
    assert.match(
      composition,
      new RegExp(`<${component}\\s*/>`, "u"),
      `PaymentAndDeliveryPage must render <${component} />`,
    );
  }
});

test("payment and delivery description states supported providers and limits", async () => {
  const registry = await readFile(
    new URL("../src/shared/lib/seo/registry.ts", import.meta.url),
    "utf8",
  );
  const description =
    /paymentAndDelivery\s*:\s*\{\s*title\s*:\s*"[^"]*"\s*,\s*description\s*:\s*"([^"]*)"/u.exec(
      registry,
    )?.[1];

  assert.ok(description, "paymentAndDelivery.description must be a non-empty string");

  assert.match(description, /СДЭК/u);
  assert.match(description, /\bOzon\b(?!\s+Pay\b)/u);
  assert.match(description, /\bT-Bank\b/u);
  assert.match(description, /\bOzon Pay\b/u);
  assert.match(description, /по\s+России/iu);
  assert.match(description, /доступные\s+пункты\s+выдачи/iu);

  assert.doesNotMatch(description, /по\s+всей\s+России|(?:в\s+)?любо(?:й|го|м)\s+город(?:а|е)?/iu);
  assert.doesNotMatch(description, /срок[а-яё]*|завтра|доставим\s+за\s+\d+(?:\s+[а-яё]+)?/iu);
});

test("payment and delivery keywords identify every supported provider", async () => {
  const registry = await readFile(
    new URL("../src/shared/lib/seo/registry.ts", import.meta.url),
    "utf8",
  );
  const config = /paymentAndDelivery\s*:\s*\{([\s\S]*?)\n\s*\},\n\s*account\s*:/u.exec(
    registry,
  )?.[1];

  assert.ok(config, "paymentAndDelivery SEO config must exist");

  const keywordList = /keywords\s*:\s*\[([\s\S]*?)\]/u.exec(config)?.[1];

  assert.ok(keywordList, "paymentAndDelivery.keywords must be a non-empty array");

  const keywords = [...keywordList.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  const providerKeywords = [
    ["СДЭК", /достав[а-яё]*[^,]*СДЭК/iu],
    ["Ozon", /достав[а-яё]*[^,]*\bOzon\b(?!\s+Pay\b)/iu],
    ["T-Bank", /оплат[а-яё]*[^,]*\bT-Bank\b/iu],
    ["Ozon Pay", /оплат[а-яё]*[^,]*\bOzon Pay\b/iu],
  ];

  for (const [provider, pattern] of providerKeywords) {
    assert.ok(
      keywords.some((keyword) => pattern.test(keyword)),
      `paymentAndDelivery.keywords must include a provider-specific ${provider} keyword`,
    );
  }
});
