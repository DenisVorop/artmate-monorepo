import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/auth/lib/phone-mask.ts", import.meta.url),
  "utf8",
);
const loaded = { exports: {} };
new Function(
  "require",
  "module",
  "exports",
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(require, loaded, loaded.exports);
const { PhoneMask } = loaded.exports;

test("phone mask accepts Russian national, +7, 8 and pasted formatted values", () => {
  for (const value of [
    "9161926406",
    "79161926406",
    "89161926406",
    "+7 (916) 192-64-06",
    "+7 (916) 192 64 06",
  ]) {
    assert.equal(PhoneMask.format(value), "+7 (916) 192 64 06");
  }
  assert.equal(PhoneMask.format(""), "");
  assert.equal(PhoneMask.format("7"), "+7");
  assert.equal(PhoneMask.format("9"), "+7 (9");
  assert.equal(PhoneMask.format("+7 (916) 192 64 06123"), "+7 (916) 192 64 06");
});

test("mask can be typed and backspaced to an empty value without separator traps", () => {
  let value = "";
  let caret = 0;
  for (const char of "9161926406") {
    const result = PhoneMask.edit(
      value.slice(0, caret) + char + value.slice(caret),
      caret + 1,
      value,
      "insertText",
    );
    value = result.value;
    caret = result.caret;
  }
  assert.equal(value, "+7 (916) 192 64 06");
  for (let i = 0; i < 25 && value; i++) {
    const previous = value;
    const result = PhoneMask.edit(
      value.slice(0, -1),
      value.length - 1,
      previous,
      "deleteContentBackward",
    );
    value = result.value;
  }
  assert.equal(value, "");
});

test("mask preserves middle editing and deletion around punctuation", () => {
  assert.deepEqual(
    PhoneMask.edit("+7 (916) 92 64 06", 9, "+7 (916) 192 64 06", "deleteContentForward"),
    { value: "+7 (916) 926 40 6", caret: 7 },
  );
  const result = PhoneMask.edit("+7 (916", 7, "+7 (916)", "deleteContentBackward");
  assert.equal(result.value, "+7 (91");
  assert.equal(result.caret, 6);
});
