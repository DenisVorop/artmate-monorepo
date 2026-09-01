import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync(
  new URL("../src/features/workshop-moderation/ui/detail.tsx", import.meta.url),
  "utf8",
);
const reasonDialog = readFileSync(
  new URL(
    "../src/features/workshop-moderation/ui/reason-dialog.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("detail renders comparison, consent, materials, mappings and history", () => {
  assert.match(detail, /Фото автора/);
  assert.match(detail, /Официальная цветная версия Artmate/);
  assert.match(detail, /Рекламное согласие/);
  assert.match(detail, /Согласие получено/);
  assert.match(detail, /Зафиксировано сервером/);
  assert.doesNotMatch(detail, /не влияет на решение/);
  assert.match(detail, /Материалы, указанные автором/);
  assert.match(detail, /Соответствие символов и маркеров/);
  assert.match(detail, /Официальная палитра Artmate/);
  assert.match(detail, /WorkshopModerationHistory/);
});

test("detail shows suspected-copy warning and required admin links", () => {
  assert.match(detail, /Подозрение на копию официальной версии/);
  assert.match(detail, /routes\.users\}\?userId=/);
  assert.match(detail, /routes\.digitalVersionColoring\(/);
  assert.match(detail, /detail\.isPublishedRevision/);
});

test("pending and changes-requested revisions can be hidden", () => {
  assert.match(detail, /detail\.status === "PENDING" \|\|/);
  assert.match(detail, /detail\.status === "CHANGES_REQUESTED"/);
  assert.match(detail, /<HideRevisionDialog revisionId=\{detail\.revisionId\}/);
  assert.match(reasonDialog, /Скрыть эту ревизию\?/);
  assert.doesNotMatch(reasonDialog, /Скрыть опубликованную работу\?/);
});

test("reason form resets after success and when a cancelled dialog closes", () => {
  const changeOpenStart = reasonDialog.indexOf("function changeOpen");
  const changeOpenEnd = reasonDialog.indexOf("\n  return", changeOpenStart);
  const changeOpen = reasonDialog.slice(changeOpenStart, changeOpenEnd);

  assert.match(reasonDialog, /mutation\.mutate\([\s\S]*\{ onSuccess \}/);
  assert.match(
    reasonDialog,
    /onSubmit\(values, \(\) => \{[\s\S]*form\.reset\(\{ reason: "" \}\)/,
  );
  assert.match(changeOpen, /else \{[\s\S]*form\.reset\(\{ reason: "" \}\)/);
  assert.match(reasonDialog, /role="alert"/);
});
