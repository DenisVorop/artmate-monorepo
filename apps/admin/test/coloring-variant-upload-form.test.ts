import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUploadFormData,
  createUploadDefaults,
  createUploadSchema,
  getUploadError,
  maxImageBytes,
  symbols,
  type UploadFormValues,
} from "../src/features/coloring-variants-management/lib/form-values.ts";

const emptyState = {
  coloringId: "coloring-1",
  token: "new",
  width: null,
  height: null,
  original: null,
  variants: [],
};
const originalState = {
  ...emptyState,
  token: "2026-09-27T10:00:00.000Z",
  original: {
    status: "draft" as const,
    updatedAt: "2026-09-27T10:00:00.000Z",
    imageUrl: "/colored",
    outlineUrl: "/original-outline",
    cardUrl: "/card",
    palette: [
      { symbolPosition: 1, hex: "#AABBCC" },
      { symbolPosition: 10, hex: "#112233" },
    ],
  },
};
const png = () => new File(["pixels"], "drawing.png", { type: "image/png" });
function values(state = originalState, target = "original"): UploadFormValues {
  return {
    ...createUploadDefaults(state, target),
    outline: png(),
    colored: png(),
    outlineAlt: "Контуры лисы",
    imageAlt: "Лиса в лесу",
  };
}

test("explicit symbols keep gaps and map 10 to A, 19 to J", () => {
  assert.equal(symbols[9], "A");
  assert.equal(symbols[18], "J");
  const input = values();
  assert.equal(
    createUploadSchema(originalState).safeParse(input).success,
    true,
  );
  assert.deepEqual(
    JSON.parse(String(buildUploadFormData(input).get("palette"))),
    [
      { symbolPosition: 1, hex: "#AABBCC" },
      { symbolPosition: 10, hex: "#112233" },
    ],
  );
});

test("adaptation requires exactly original symbols but allows repeated material colors", () => {
  const input = values(originalState, "set-1");
  input.palette.forEach((row) => {
    if (row.enabled) row.materialColorId = "color-001";
  });
  assert.equal(
    createUploadSchema(originalState).safeParse(input).success,
    true,
  );
  assert.deepEqual(
    JSON.parse(String(buildUploadFormData(input).get("palette"))),
    [
      { symbolPosition: 1, materialColorId: "color-001" },
      { symbolPosition: 10, materialColorId: "color-001" },
    ],
  );
  input.palette[9]!.enabled = false;
  assert.equal(
    createUploadSchema(originalState).safeParse(input).success,
    false,
  );
});

test("an adaptation cannot precede the original or repeat a symbol", () => {
  const input = values(originalState, "set-1");
  input.palette.forEach((row) => {
    row.materialColorId = "color-001";
  });
  assert.equal(createUploadSchema(emptyState).safeParse(input).success, false);
  input.palette[9]!.symbolPosition = 1;
  assert.equal(
    createUploadSchema(originalState).safeParse(input).success,
    false,
  );
});

test("existing adaptations lock the original symbol set", () => {
  const state = {
    ...originalState,
    variants: [
      {
        status: "draft" as const,
        materialSetId: "set-1",
        title: "Маркеры",
        updatedAt: originalState.token,
        imageUrl: "/adapted",
        outlineUrl: "/adapted-outline",
        cardUrl: "/card",
        palette: [],
      },
    ],
  };
  const input = values();
  input.palette[9]!.enabled = false;
  assert.equal(
    createUploadSchema(originalState).safeParse(input).success,
    true,
  );
  assert.equal(createUploadSchema(state).safeParse(input).success, false);
});

test("files and descriptions are validated before upload", () => {
  const input = values();
  for (const file of [
    new File([], "empty.png", { type: "image/png" }),
    new File(["svg"], "drawing.svg", { type: "image/svg+xml" }),
    new File([new Uint8Array(maxImageBytes + 1)], "large.png", {
      type: "image/png",
    }),
  ]) {
    assert.equal(
      createUploadSchema(originalState).safeParse({ ...input, outline: file })
        .success,
      false,
    );
  }
  assert.equal(
    createUploadSchema(originalState).safeParse({
      ...input,
      colored: undefined,
    }).success,
    false,
  );
  assert.equal(
    createUploadSchema(originalState).safeParse({ ...input, imageAlt: " " })
      .success,
    false,
  );
  assert.equal(
    createUploadSchema(originalState).safeParse({
      ...input,
      outlineAlt: "а".repeat(221),
    }).success,
    false,
  );
});

test("multipart preserves the captured token, both files and only relevant palette fields", () => {
  const input = values();
  const data = buildUploadFormData({ ...input, imageAlt: "  Лиса  " });
  assert.equal(data.get("expectedToken"), originalState.token);
  assert.equal(data.get("target"), "original");
  assert.equal((data.get("outline") as File).name, input.outline.name);
  assert.equal((data.get("colored") as File).size, input.colored.size);
  assert.equal(data.get("imageAlt"), "Лиса");
  assert.equal(String(data.get("palette")).includes("materialColorId"), false);
});

test("conflict messages distinguish stale data from mismatched outlines and symbols", () => {
  assert.match(getUploadError("STALE_UPLOAD", 409), /Обновите страницу/);
  assert.match(
    getUploadError("OUTLINE_IN_USE", 409),
    /размеры изображений и соответствие контуров/,
  );
  assert.match(getUploadError("SYMBOLS_IN_USE", 409), /прежний список/);
  assert.equal(
    getUploadError("SQL unexpected secret", 500).includes("SQL"),
    false,
  );
});
