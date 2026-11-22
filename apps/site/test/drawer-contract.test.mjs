import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const sourceRoot = new URL("../src/", import.meta.url);

test("site sheets cannot reintroduce local height limits or scroll the entire panel", async () => {
  const files = await readdir(sourceRoot, { recursive: true });
  const violations = [];
  let checked = 0;
  for (const file of files.filter(
    (name) => name.endsWith(".tsx") && name !== "shared/ui/drawer.tsx",
  )) {
    const source = await readFile(new URL(file, sourceRoot), "utf8");
    if (!source.includes("<DrawerContent")) continue;
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(tree) === "DrawerContent"
      ) {
        checked++;
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
          const name = attribute.name.getText(tree);
          const value = attribute.initializer.getText(tree);
          if (
            (name === "className" &&
              /(?:^|[\s:"'`])(?:[\w[\]=()-]+:)*(?:!?(?:min-|max-)?h-|overflow-(?:auto|scroll|hidden)|overflow-y-(?:auto|scroll))/.test(
                value,
              )) ||
            (name === "style" &&
              /\b(?:height|minHeight|maxHeight|overflow|overflowY)\b/.test(value))
          )
            violations.push(`${file}: DrawerContent ${name} overrides the shared contract`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.match(source, /<DrawerBody\b/, `${file} must use the shared scrolling body`);
  }
  assert.ok(checked >= 9, "Exercise all existing sheet scenarios");
  assert.deepEqual(violations, []);
});
