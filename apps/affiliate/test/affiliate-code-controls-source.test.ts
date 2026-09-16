import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const formSource = readFileSync(
  new URL("../src/features/affiliate-codes/ui/code-form.tsx", import.meta.url),
  "utf8",
);
const splitSource = readFileSync(
  new URL(
    "../src/features/affiliate-codes/ui/commission-split.tsx",
    import.meta.url,
  ),
  "utf8",
);
const cardSource = readFileSync(
  new URL("../src/features/affiliate-codes/ui/code-card.tsx", import.meta.url),
  "utf8",
);
const formValuesSource = readFileSync(
  new URL(
    "../src/features/affiliate-codes/lib/form-values.ts",
    import.meta.url,
  ),
  "utf8",
);
const textareaSource = readFileSync(
  new URL("../src/shared/ui/textarea.tsx", import.meta.url),
  "utf8",
);
const listSource = readFileSync(
  new URL(
    "../src/features/affiliate-codes/ui/affiliate-codes.tsx",
    import.meta.url,
  ),
  "utf8",
);

function readOptionalSource(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);

  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const codeStateSource = readOptionalSource(
  "../src/features/affiliate-codes/lib/code-state.ts",
);
const formStateSource = readOptionalSource(
  "../src/features/affiliate-codes/lib/form-state.ts",
);
const listStateSource = readOptionalSource(
  "../src/features/affiliate-codes/lib/list-state.ts",
);

test("uses shared shadcn form controls instead of native replacements", () => {
  assert.match(
    formSource,
    /import \{[^}]*Textarea[^}]*\} from "@\/shared\/ui"/s,
  );
  assert.match(formSource, /<Textarea/);
  assert.doesNotMatch(formSource, /<textarea/);
  assert.match(
    splitSource,
    /import \{[^}]*Slider[^}]*\} from "@\/shared\/ui"/s,
  );
  assert.match(splitSource, /<Slider/);
  assert.doesNotMatch(splitSource, /<input/);
});

test("exposes the keyboard slider value as both commission shares", () => {
  assert.match(splitSource, /["']?aria-valuetext["']?\s*[:=]/);
  assert.match(splitSource, /Вам.*покупателю/s);
  assert.match(splitSource, /onValueChange=/);
});

test("keeps an open edit form within the mobile card width", () => {
  assert.match(textareaSource, /field-sizing-fixed/);
  assert.match(textareaSource, /min-w-0/);
  assert.match(textareaSource, /max-w-full/);
  assert.doesNotMatch(textareaSource, /field-sizing-content/);
  assert.match(
    formSource,
    /<div className="min-w-0">\s*<label[\s\S]*?htmlFor=\{`\$\{formId\}-comment`\}/,
  );
  assert.match(
    cardSource,
    /<div className="min-w-0 max-w-full border-t px-5 pt-5">/,
  );
});

test("uses the affiliate actions public API and a mobile-safe placeholder", () => {
  assert.match(formValuesSource, /from "@\/shared\/actions\/affiliate"/);
  assert.doesNotMatch(formValuesSource, /\.\.\/\.\.\/\.\.\/shared\/actions/);
  assert.match(formSource, /placeholder="Например, ARTM-SUMMER"/);
  assert.match(formSource, /placeholder:normal-case/);
});

test("keeps UI state and submit orchestration out of affiliate code UI", () => {
  assert.match(formSource, /useAffiliateCodeForm/);
  assert.doesNotMatch(formSource, /use(Create|Update)AffiliateCode/);
  assert.doesNotMatch(formSource, /build(Create|Update)AffiliateCodeInput/);
  assert.doesNotMatch(formSource, /getAffiliateCodeErrorMessage/);

  assert.match(cardSource, /useAffiliateCodeCard/);
  assert.doesNotMatch(cardSource, /useState/);
  assert.doesNotMatch(cardSource, /navigator\.clipboard|setTimeout/);
  assert.doesNotMatch(cardSource, /useUpdateAffiliateCode/);

  assert.match(listSource, /useAffiliateCodeList/);
  assert.doesNotMatch(listSource, /useState|useAffiliateCodesData/);
});

test("keeps feature state hooks in lib and cleans up copy timers", () => {
  assert.match(codeStateSource, /^"use client";/);
  assert.match(codeStateSource, /useEffect/);
  assert.match(codeStateSource, /clearTimeout/);
  assert.match(codeStateSource, /return clearCopyTimer/);
  assert.match(formStateSource, /^"use client";/);
  assert.match(listStateSource, /^"use client";/);
});
