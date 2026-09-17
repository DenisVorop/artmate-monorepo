import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readSource(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const overviewSource = readSource(
  "../src/features/partner-overview/ui/partner-overview.tsx",
);
const balanceSource = readSource(
  "../src/features/partner-overview/ui/balance-card.tsx",
);
const chartSource = readSource(
  "../src/features/partner-overview/ui/earnings-chart.tsx",
);
const codesSource = readSource(
  "../src/features/partner-overview/ui/code-performance.tsx",
);
const ledgerSource = readSource(
  "../src/features/partner-overview/ui/ledger-list.tsx",
);
const statusHintSource = readSource(
  "../src/features/partner-overview/ui/status-hint.tsx",
);
const globalsSource = readSource("../app/globals.css");

test("renders a real finance overview without unavailable payout promises", () => {
  assert.match(overviewSource, /Финансовый обзор/);
  assert.match(balanceSource, /Доступно/);
  assert.match(overviewSource, /Обновить/);
  assert.doesNotMatch(
    `${overviewSource}${balanceSource}`,
    /Вывести|Заказать выплату|следующ(ий|ем) этап|только для чтения|не заменён нулями/i,
  );
});

test("provides an accessible chart and a textual daily data equivalent", () => {
  assert.match(chartSource, /<svg/);
  assert.match(chartSource, /role="img"/);
  assert.match(chartSource, /aria-labelledby=/);
  assert.match(chartSource, /useId/);
  assert.match(chartSource, /<table/);
  assert.match(chartSource, /Чистый доход/);
  assert.match(chartSource, /Максимум/);
  assert.match(chartSource, /Нулевая линия/);
  assert.match(chartSource, /Минимум/);
  assert.match(chartSource, /focus-visible:stroke/);
  assert.doesNotMatch(chartSource, /<text/);
});

test("keeps long codes and large financial values within mobile cards", () => {
  assert.match(codesSource, /\[overflow-wrap:anywhere\]/);
  assert.match(codesSource, /tabular-nums/);
  assert.match(ledgerSource, /\[overflow-wrap:anywhere\]/);
  assert.match(ledgerSource, /tabular-nums/);
});

test("uses shadcn Card and keeps feature styling out of globals", () => {
  assert.match(
    balanceSource,
    /import \{[^}]*Card[^}]*\} from "@\/shared\/ui"/s,
  );
  assert.match(balanceSource, /<Card/);
  assert.doesNotMatch(balanceSource, /<article/);
  assert.doesNotMatch(globalsSource, /finance-/);
});

test("keeps ledger wording human and hides reward status on returns", () => {
  assert.doesNotMatch(ledgerSource, /Сторнировано|Будет доступно/);
  assert.match(ledgerSource, /presentation\.statusLabel/);
});

test("uses opaque shared popover colors backed by existing card tokens", () => {
  assert.match(globalsSource, /--color-popover:\s*var\(--popover\)/);
  assert.match(
    globalsSource,
    /--color-popover-foreground:\s*var\(--popover-foreground\)/,
  );
  assert.match(globalsSource, /--popover:\s*var\(--card\)/);
  assert.match(globalsSource, /--popover-foreground:\s*var\(--card-foreground\)/);
});

test("uses desktop popover and mobile drawer without hydration branching", () => {
  assert.match(
    statusHintSource,
    /import \{[^}]*Popover[^}]*PopoverContent[^}]*PopoverTrigger[^}]*\} from "@\/shared\/ui"/s,
  );
  assert.match(
    statusHintSource,
    /import \{[^}]*Drawer[^}]*DrawerClose[^}]*DrawerContent[^}]*DrawerDescription[^}]*DrawerTitle[^}]*DrawerTrigger[^}]*\} from "@\/shared\/ui"/s,
  );
  assert.match(statusHintSource, /matchMedia\("\(min-width: 640px\)"\)/);
  assert.match(statusHintSource, /addEventListener\("change"/);
  assert.match(statusHintSource, /className="hidden max-w-full sm:inline-flex"/);
  assert.match(statusHintSource, /className="inline-flex max-w-full sm:hidden"/);
  assert.doesNotMatch(statusHintSource, /window\.innerWidth/);
});

test("keeps both status triggers accessible and mobile-safe", () => {
  assert.match(statusHintSource, /<PopoverTrigger asChild>/);
  assert.match(statusHintSource, /<DrawerTrigger asChild>/);
  assert.match(statusHintSource, /const statusTrigger = \(\s*<Button/s);
  assert.match(
    statusHintSource,
    /<PopoverTrigger asChild>\s*\{statusTrigger\}\s*<\/PopoverTrigger>/s,
  );
  assert.match(
    statusHintSource,
    /<DrawerTrigger asChild>\s*\{statusTrigger\}\s*<\/DrawerTrigger>/s,
  );
  assert.doesNotMatch(statusHintSource, /function StatusTrigger/);
  assert.match(statusHintSource, /type="button"/);
  assert.match(statusHintSource, /aria-label=.*\$\{label\}/s);
  assert.match(statusHintSource, /<Info[^>]*aria-hidden="true"/);
  assert.match(statusHintSource, /max-w-full/);
  assert.match(statusHintSource, /whitespace-normal/);
  assert.match(statusHintSource, /collisionPadding=\{16\}/);
  assert.doesNotMatch(statusHintSource, /<Button[^>]*\stitle=/s);
});

test("renders a compact dismissible mobile status drawer", () => {
  assert.match(statusHintSource, /<Drawer\s+autoFocus/s);
  assert.match(statusHintSource, /<DrawerTitle[^>]*>\s*\{label\}/s);
  assert.match(statusHintSource, /<DrawerDescription[^>]*>\s*\{hint\}/s);
  assert.match(statusHintSource, /<DrawerClose asChild>/);
  assert.match(statusHintSource, />\s*Понятно\s*<\/Button>/s);
  assert.match(statusHintSource, /max-h-\[min\(80dvh,32rem\)\]/);
  assert.match(statusHintSource, /overflow-y-auto/);
  assert.match(statusHintSource, /env\(safe-area-inset-bottom\)/);
});

test("shows isolated loading, error, and empty states for codes and ledger", () => {
  assert.match(codesSource, /DataState/);
  assert.match(codesSource, /Нет продаж по кодам/);
  assert.match(ledgerSource, /DataState/);
  assert.match(ledgerSource, /Операций пока нет/);
  assert.match(codesSource, /Повторить/);
  assert.match(ledgerSource, /Повторить/);
});
