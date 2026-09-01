import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { z } = require("zod");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    throw new Error(`Unexpected test module import: ${specifier}`);
  };
  new Function("require", "module", "exports", output)(
    localRequire,
    testModule,
    testModule.exports,
  );
  return testModule.exports;
}

test("editor RHF+Zod contract preserves marker strings, duplicates and partial mappings", async () => {
  const originalFile = globalThis.File;
  globalThis.File = File;
  const form = evaluateTypeScript(await readSource("src/features/work-editor/lib/editor-form.ts"), {
    zod: { z },
    "@/entities/workshop": {
      workshopMarkerNumberPattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/,
      workshopSymbolPattern: /^(?:[1-9]|[A-J])$/,
    },
  });
  const values = {
    photo: new File([new Uint8Array(64)], "photo.jpg", { type: "image/jpeg" }),
    crop: { rotation: 270, zoom: 1.5, x: -0.25, y: 0.25 },
    toolType: "CUSTOM",
    brand: "Copic",
    line: "Sketch",
    mappings: [
      { symbol: "1", markerNumber: "023" },
      { symbol: "2", markerNumber: "023" },
      { symbol: "A", markerNumber: "27A" },
      { symbol: "J", markerNumber: "" },
    ],
    caption: "Готовая работа",
    advertisingConsent: false,
  };

  try {
    const parsed = form.workEditorFormSchema.parse(values);
    const dto = form.toCreateRevisionInput(parsed, "SUBMIT", "a".repeat(32), []);

    assert.deepEqual(dto.symbolMappings, [
      { symbol: "1", markerNumber: "023", materialPosition: 1 },
      { symbol: "2", markerNumber: "023", materialPosition: 1 },
      { symbol: "A", markerNumber: "27A", materialPosition: 1 },
    ]);
    assert.deepEqual(dto.materials, [{ toolId: "a".repeat(32) }]);
    assert.equal(dto.advertisingConsent, false);
    assert.equal(dto.intent, "SUBMIT");
    assert.equal(dto.crop.rotation, 270);

    const artmateDto = form.toCreateRevisionInput(
      { ...parsed, toolType: "ARTMATE_168", brand: "Artmate", line: "168" },
      "SUBMIT",
      "b".repeat(32),
      [{ id: "marker-color-023", markerNumber: "023" }],
    );
    assert.equal(artmateDto.symbolMappings[0].officialMarkerColorId, "marker-color-023");

    assert.equal(
      form.workEditorFormSchema.safeParse({
        ...values,
        photo: new File(["x"], "photo.gif", { type: "image/gif" }),
      }).success,
      false,
    );
    assert.equal(
      form.workEditorFormSchema.safeParse({
        ...values,
        mappings: [{ symbol: "K", markerNumber: "001" }],
      }).success,
      false,
    );
  } finally {
    globalThis.File = originalFile;
  }
});

test("editor UI is a photo workflow with accessible crop and explicit publication choices", async () => {
  const editor = await readSource("src/features/work-editor/ui/work-editor.tsx");
  const preview = await readSource("src/features/work-editor/ui/photo-preview.tsx");
  const stepper = await readSource("src/features/work-editor/ui/stepper.tsx");

  assert.match(editor, /useForm<WorkEditorFormValues>/);
  assert.match(editor, /URL\.createObjectURL\(selectedPhoto\)/);
  assert.match(editor, /URL\.revokeObjectURL\(nextUrl\)/);
  assert.match(editor, /accept=\{acceptedWorkshopPhotoTypes\.join/);
  assert.match(editor, /Повернуть на 90°/);
  assert.match(editor, /Палитра Artmate для этой картины/);
  assert.match(editor, /SelectItem value="__none__"/);
  assert.match(editor, /officialMarkerOptions\.map/);
  assert.match(editor, /Оставить только себе/);
  assert.match(editor, /Опубликовать после модерации/);
  assert.match(editor, /advertisingConsent/);
  assert.match(editor, /Все введённые данные сохранены в форме/);
  assert.match(editor, /toCreateRevisionInput\(formValues, submissionIntent, tool\.id/);
  assert.match(editor, /officialColors/);
  assert.match(editor, /handleSubmit\(onSubmit, onInvalid\)/);
  assert.match(editor, /disabled=\{!canAdjustCrop\}/);
  assert.match(editor, /crop=\{objectUrl \? crop : undefined\}/);
  assert.match(editor, /Без нового фото сервер сохранит прежний кадр без изменений/);
  assert.match(editor, /currentRevision\?\.status === "PENDING"/);
  assert.match(preview, /getCropPreviewGeometry/);
  assert.match(preview, /naturalWidth/);
  assert.match(preview, /naturalHeight/);
  assert.match(preview, /geometry\.imageCenterXPercent/);
  assert.match(preview, /geometry\.imageCenterYPercent/);
  assert.doesNotMatch(`${editor}\n${preview}`, /canvas|getContext\(/i);
  assert.match(stepper, /aria-label="Шаги добавления работы"/);
  assert.match(stepper, /min-h-11/);
});

test("photo preview geometry matches the server crop rectangle", async () => {
  const geometry = evaluateTypeScript(
    await readSource("src/features/work-editor/lib/crop-preview.ts"),
    {},
  );

  const fullFrame = geometry.getCropPreviewGeometry(800, 1000, {
    rotation: 0,
    zoom: 1,
    x: 1,
    y: -1,
  });

  assert.deepEqual(fullFrame, {
    rotatedWidth: 800,
    rotatedHeight: 1000,
    cropWidth: 800,
    cropHeight: 1000,
    cropLeft: 0,
    cropTop: 0,
    imageCenterXPercent: 50,
    imageCenterYPercent: 50,
    imageWidthPercent: 100,
    imageHeightPercent: 100,
  });

  const leftEdge = geometry.getCropPreviewGeometry(1600, 1000, {
    rotation: 0,
    zoom: 1,
    x: -1,
    y: 0,
  });
  const rightEdge = geometry.getCropPreviewGeometry(1600, 1000, {
    rotation: 0,
    zoom: 1,
    x: 1,
    y: 0,
  });

  assert.equal(leftEdge.cropLeft, 0);
  assert.equal(leftEdge.imageCenterXPercent, 100);
  assert.equal(rightEdge.cropLeft, 800);
  assert.equal(rightEdge.imageCenterXPercent, 0);

  const quarterTurn = geometry.getCropPreviewGeometry(1600, 1000, {
    rotation: 90,
    zoom: 1,
    x: 0,
    y: 0,
  });

  assert.equal(quarterTurn.rotatedWidth, 1000);
  assert.equal(quarterTurn.rotatedHeight, 1600);
  assert.equal(quarterTurn.cropWidth, 1000);
  assert.equal(quarterTurn.cropHeight, 1250);
});

test("exact author-material warning is present beside public author data", async () => {
  const constants = await readSource("src/entities/community-work/lib/constants.ts");
  const publicWork = await readSource("src/features/public-work/ui/public-work.tsx");
  const warning =
    "Материалы и соответствие цветов указаны автором работы. Модерация проверяет публикацию и её связь с выбранной картиной, но не подтверждает фактическое использование указанных маркеров. Оттенки могут отличаться из-за бумаги, техники нанесения, освещения и цветопередачи экрана.";

  assert.ok(constants.includes(warning));
  assert.match(publicWork, /authorMaterialsWarning/);
  assert.match(publicWork, /work\.author\.name[\s\S]*authorMaterialsWarning/);
});
