import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) =>
  readFile(new URL(path, import.meta.url), "utf8");

const [
  partnerQuerySource,
  partnerCodesSource,
  codeListStateSource,
  codeFormStateSource,
  codeMutationSource,
  partnersManagementSource,
  promoDetailsSource,
  promoListSource,
  promoTypesSource,
] = await Promise.all([
  readSource("../src/entities/affiliate-partners/model/query.ts"),
  readSource("../src/features/partners-management/ui/partner-codes.tsx"),
  readSource("../src/features/partners-management/lib/code-list-state.ts"),
  readSource("../src/features/partners-management/lib/code-form-state.ts"),
  readSource(
    "../src/features/partners-management/model/use-update-affiliate-code.ts",
  ),
  readSource("../src/features/partners-management/ui/partners-management.tsx"),
  readSource("../src/features/promocodes-management/ui/promo-code-details.tsx"),
  readSource(
    "../src/features/promocodes-management/ui/promo-codes-management.tsx",
  ),
  readSource("../src/shared/actions/promocodes/promocodes.types.ts"),
]);

test("affiliate code queries are private to a partner user id", () => {
  assert.match(
    partnerQuerySource,
    /codes:\s*\(userId: string, params:[\s\S]*?userId[\s\S]*?params/,
  );
});

test("partner profile renders code controls and copy action", () => {
  assert.match(partnersManagementSource, /<PartnerCodes/);
  assert.match(partnerCodesSource, /Коды партнёра/);
  assert.match(partnerCodesSource, /Комментарий/);
  assert.match(partnerCodesSource, /Доля партнёра/);
  assert.match(partnerCodesSource, /Скопировать код/);
  assert.match(partnerCodesSource, /Промокод активен/);
  assert.match(codeFormStateSource, /partnerPercent <= 15/);
  assert.match(partnerCodesSource, /Не удалось скопировать/);
  assert.match(partnerCodesSource, /aria-live="polite"/);
  assert.match(
    partnerCodesSource,
    /key=\{`\$\{code\.id\}-\$\{code\.updatedAt\}`\}/,
  );
});

test("partner codes UI delegates list and form orchestration to feature lib", () => {
  assert.match(partnerCodesSource, /useCodeListState/);
  assert.match(partnerCodesSource, /useAffiliateCodeFormState/);
  assert.doesNotMatch(partnerCodesSource, /\buseState\b/);
  assert.doesNotMatch(partnerCodesSource, /\buseForm\b/);
  assert.doesNotMatch(partnerCodesSource, /useUpdateAffiliateCode/);
  assert.doesNotMatch(partnerCodesSource, /navigator\.clipboard/);
  assert.doesNotMatch(partnerCodesSource, /form\.(?:handleSubmit|watch)/);
  assert.match(partnerCodesSource, /form\.register/);
  assert.match(partnerCodesSource, /<Controller/);
  assert.match(codeListStateSource, /\buseState\b/);
  assert.match(codeListStateSource, /navigator\.clipboard/);
  assert.match(codeFormStateSource, /\buseForm\b/);
  assert.match(codeFormStateSource, /useUpdateAffiliateCode/);
  assert.match(codeFormStateSource, /getUpdateAffiliateCodeInput/);
});

test("affiliate code mutation invalidates partner and common promo caches", () => {
  assert.match(codeMutationSource, /affiliatePartnersQueryKeys\.all/);
  assert.match(codeMutationSource, /promoCodesQueryKeys\.all/);
});

test("common promo editor marks affiliate codes and does not mutate them", () => {
  assert.match(promoTypesSource, /"standard"\s*\|\s*"welcome"\s*\|\s*"affiliate"/);
  assert.match(promoDetailsSource, /Партнёрский/);
  assert.match(promoDetailsSource, /routes\.partners/);
  assert.match(promoDetailsSource, /promoCode\.kind !== "affiliate"/);
  assert.match(promoListSource, /Партнёрский/);
  assert.match(promoListSource, /promoCode\.kind === "affiliate"/);
  assert.match(promoListSource, /href=\{routes\.partners\}/);
});
