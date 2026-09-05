import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("workshop cards expose every required state and mobile-visible actions", async () => {
  const card = await readSource("src/entities/workshop/ui/coloring-card.tsx");
  const collection = await readSource(
    "src/features/workshop-collection/ui/workshop-collection.tsx",
  );

  for (const text of [
    "Добавить работу",
    "На проверке",
    "Одобрено, не опубликовано",
    "Опубликовано",
    "Модератор запросил изменения",
    "Исправить",
    "Заменить фото",
    "Есть неопубликованные изменения",
    "Новая версия ожидает модерации",
    "После одобрения опубликуется автоматически",
    "Одобрено, ждёт открытия мастерской",
    "Опубликовать изменения",
    "Не публиковать",
    "Не публиковать после открытия",
  ]) {
    assert.ok(card.includes(text), `Missing card state/action: ${text}`);
  }

  assert.match(card, /opacity-55/);
  assert.match(card, /min-h-11/);
  assert.match(card, /currentStatus === "CHANGES_REQUESTED"/);
  assert.match(card, /currentRevision\?\.moderationReason/);
  assert.match(card, /currentStatus === "PENDING"/);
  assert.match(card, /currentStatus === "APPROVED"/);
  assert.match(card, /work\.publishedRevision\.id === work\.currentRevision\.id/);
  assert.match(
    card,
    /state === "PENDING" &&[\s\S]*work\.isPublicationEnabled &&[\s\S]*work\.currentRevision\?\.publicationConsent &&[\s\S]*onUnpublish/,
  );
  assert.match(card, /state === "AWAITING_WORKSHOP" && onUnpublish/);
  assert.match(collection, /isPendingAutomaticPublication\(action\)/);
  assert.match(
    collection,
    /currentRevision\?\.status === "PENDING"[\s\S]*currentRevision\.publicationConsent/,
  );
  assert.match(collection, /Не публиковать после открытия мастерской\?/);
  assert.match(collection, /не появится автоматически после открытия мастерской/);
  assert.doesNotMatch(card, /DRAFT|Черновик|Продолжить/);
  assert.doesNotMatch(card, /group-hover:(?:block|flex|visible)|hidden.*group-hover/);
});

test("overview only shows purchase badge for a paid order", async () => {
  const card = await readSource("src/entities/workshop/ui/collection-card.tsx");

  assert.match(card, /collection\.hasPaidOrder/);
  assert.match(card, /Куплено в Artmate/);
  assert.match(card, /workCount[\s\S]*expectedColoringCount/);
  assert.doesNotMatch(card, /купленн(?:ая|ые|ый) тематика/i);
});

test("account, menu and official digital pages integrate workshop without replacing content", async () => {
  const account = await readSource("src/features/account/ui/account.tsx");
  const menu = await readSource("src/features/auth/ui/session-menu.tsx");
  const collection = await readSource("src/features/coloring-collection-gallery/ui/gallery.tsx");
  const collectionPage = await readSource("src/_pages/coloring-collection/index.tsx");
  const coloringPage = await readSource("src/_pages/coloring/index.tsx");
  const addButton = await readSource("src/features/add-workshop-collection/ui/add-button.tsx");
  const detail = await readSource("src/features/coloring-details/ui/coloring-details.tsx");

  assert.match(account, /Моя мастерская/);
  assert.match(account, /Мои заказы/);
  assert.match(account, /TelegramLinkCard/);
  assert.match(menu, /href=\{routes\.workshop\}/);
  assert.match(collection, /workshopAction/);
  assert.match(collectionPage, /AddWorkshopCollectionButton/);
  assert.match(addButton, /\?next=/);
  assert.match(detail, /ComparisonViewer[\s\S]*PaletteSection[\s\S]*communityWorks/);
  assert.match(coloringPage, /CommunityWorks/);
});

test("public work order, report auth and moderated community copy are explicit", async () => {
  const publicWork = await readSource("src/features/public-work/ui/public-work.tsx");
  const publicWorkPage = await readSource("src/_pages/public-work/index.tsx");
  const materials = await readSource("src/entities/community-work/ui/materials.tsx");
  const report = await readSource("src/features/report-work/ui/report-dialog.tsx");
  const community = await readSource("src/features/community-works/ui/community-works.tsx");

  const orderedTokens = [
    "<Breadcrumb>",
    "work.author.name",
    "Фотография работы",
    "work.submission.caption",
    "CommunityWorkMaterials",
    "Официальная цифровая версия",
    "relatedProduct",
    "Другие работы по этой картине",
    "ShareWorkButton",
    "renderReportAction?.(work.revisionId)",
  ];
  let cursor = -1;
  for (const token of orderedTokens) {
    const index = publicWork.indexOf(token, cursor + 1);
    assert.ok(index > cursor, `Public work token is out of order: ${token}`);
    cursor = index;
  }

  assert.match(publicWorkPage, /ReportWorkDialog/);

  assert.match(report, /\?next=\$\{encodeURIComponent\(routes\.publicWork\(publicId\)\)\}/);
  assert.match(report, /COPYRIGHT/);
  assert.match(report, /OFFICIAL_COPY/);
  assert.match(report, /PERSONAL_DATA/);
  assert.match(report, /revisionId/);
  assert.match(report, /details/);
  assert.match(report, /maxLength=\{500\}/);
  assert.match(materials, /Палитра Artmate для этой картины/);
  assert.match(materials, /Материалы, указанные автором/);
  assert.match(materials, /work\.submission\.materials\.length > 0/);
  assert.match(materials, /Автор не указал материалы\./);
  assert.match(
    publicWork,
    /work\.submission\.materials\.length > 0 \|\| work\.submission\.symbolMappings\.length > 0/,
  );
  assert.match(publicWork, /hasAuthorMaterialDetails \? \([\s\S]*authorMaterialsWarning/);
  assert.match(community, /Только текущие публичные работы, одобренные модерацией/);
});
