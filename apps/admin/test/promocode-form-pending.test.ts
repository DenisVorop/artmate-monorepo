import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL(
    "../src/features/promocodes-management/ui/promo-code-form.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("promo code form disables every editable control while submit is pending", () => {
  const fieldsetStart = source.indexOf("<fieldset");
  const fieldsetEnd = source.indexOf("</fieldset>");

  assert.ok(fieldsetStart >= 0);
  assert.ok(fieldsetEnd > fieldsetStart);

  const fieldset = source.slice(fieldsetStart, fieldsetEnd);

  assert.match(fieldset, /disabled=\{submitPending\}/);
  assert.match(fieldset, /<Input/);
  assert.match(fieldset, /<Textarea/);
  assert.match(fieldset, /<NativeSelect/);
  assert.match(fieldset, /<Checkbox/);
  assert.match(fieldset, /type="submit"/);
});
