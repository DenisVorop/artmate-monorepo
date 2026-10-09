import assert from "node:assert/strict";
import test from "node:test";

import {
  buildImportInput,
  defaultValues,
  importSchema,
  maxSourceBytes,
} from "../src/features/material-sets-management/lib/form-values.ts";

const validValues = {
  ...defaultValues,
  title: "Набор маркеров",
  brand: "Artmate",
  slug: "artmate-markers",
  source: 'code,hex,name\n001,#FFFFFF,"Белый"\n',
};

test("the source limit counts UTF-8 bytes, including multibyte color names", () => {
  assert.equal(
    importSchema.safeParse({
      ...validValues,
      source: "a".repeat(maxSourceBytes),
    }).success,
    true,
  );
  assert.equal(
    importSchema.safeParse({
      ...validValues,
      source: "a".repeat(maxSourceBytes + 1),
    }).success,
    false,
  );
  assert.equal(
    importSchema.safeParse({
      ...validValues,
      source: "я".repeat(maxSourceBytes / 2 + 1),
    }).success,
    false,
  );
});

test("the form rejects empty sources and invalid identifiers before preview", () => {
  assert.equal(
    importSchema.safeParse({ ...validValues, source: "" }).success,
    false,
  );
  for (const slug of [
    "",
    "Artmate",
    "набор",
    "a--b",
    "-brand",
    "brand-",
    "a/b",
  ]) {
    assert.equal(
      importSchema.safeParse({ ...validValues, slug }).success,
      false,
      slug,
    );
  }
});

test("the preview payload preserves CSV text and leading zeros while normalizing metadata", () => {
  const input = buildImportInput({
    ...validValues,
    title: "  Маркеры  ",
    brand: " Artmate ",
    line: "  ",
  });
  assert.equal(input.source, validValues.source);
  assert.equal(input.title, "Маркеры");
  assert.equal(input.brand, "Artmate");
  assert.equal("line" in input, false);
});
