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

test("editor RHF+Zod contract maps a separate material for every color", async () => {
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

    materials: [
      { type: "ARTMATE_168", brand: "Artmate", line: "168" },
      { type: "CUSTOM", brand: "Copic", line: "Sketch" },
      { type: "CUSTOM", brand: "Winsor & Newton", line: "Promarker" },
    ],
    mappings: [
      { symbol: "1", materialIndex: 1, markerNumber: "023" },
      { symbol: "2", materialIndex: 1, markerNumber: "023" },
      { symbol: "A", materialIndex: 0, markerNumber: "027" },
      { symbol: "J", materialIndex: 2, markerNumber: "" },
    ],
    caption: "Готовая работа",
  };

  try {
    const parsed = form.workEditorFormSchema.parse(values);
    const tools = [
      { id: "a".repeat(32), ...values.materials[0] },
      { id: "b".repeat(32), ...values.materials[1] },
      { id: "c".repeat(32), ...values.materials[2] },
    ];
    const dto = form.toCreateRevisionInput(parsed, tools, [
      { id: "marker-color-027", markerNumber: "027" },
    ]);

    assert.deepEqual(dto.symbolMappings, [
      { symbol: "1", markerNumber: "023", materialPosition: 2 },
      { symbol: "2", markerNumber: "023", materialPosition: 2 },
      {
        symbol: "A",
        markerNumber: "027",
        materialPosition: 1,
        officialMarkerColorId: "marker-color-027",
      },
      { symbol: "J", markerNumber: "", materialPosition: 3 },
    ]);
    assert.deepEqual(dto.materials, [
      { toolId: "a".repeat(32) },
      { toolId: "b".repeat(32) },
      { toolId: "c".repeat(32) },
    ]);
    assert.equal(dto.advertisingConsent, true);
    assert.equal(dto.publicationConsent, true);
    assert.equal("intent" in dto, false);
    assert.equal("crop" in dto, false);

    const photoOnlyValues = form.workEditorFormSchema.parse({
      ...values,
      materials: [],
      mappings: [],
    });
    const photoOnlyDto = form.toCreateRevisionInput(photoOnlyValues, [], []);
    assert.deepEqual(photoOnlyDto.materials, []);
    assert.deepEqual(photoOnlyDto.symbolMappings, []);
    assert.equal(photoOnlyDto.publicationConsent, true);
    assert.equal(photoOnlyDto.advertisingConsent, true);

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
        mappings: [{ symbol: "K", materialIndex: 0, markerNumber: "001" }],
      }).success,
      false,
    );
    assert.equal(
      form.workEditorFormSchema.safeParse({
        ...values,
        materials: [...values.materials, values.materials[1]],
      }).success,
      false,
    );
    assert.equal(
      form.workEditorFormSchema.safeParse({
        ...values,
        mappings: [{ symbol: "1", materialIndex: null, markerNumber: "001" }],
      }).success,
      false,
    );
  } finally {
    globalThis.File = originalFile;
  }
});

test("editor defaults restore mixed material positions from an existing revision", async () => {
  const defaults = evaluateTypeScript(
    await readSource("src/features/work-editor/lib/default-values.ts"),
    {},
  );
  const data = {
    coloring: {
      officialRevision: {
        palette: {
          colors: [
            { symbol: "1", markerNumber: "001" },
            { symbol: "2", markerNumber: "002" },
            { symbol: "A", markerNumber: "010" },
          ],
        },
      },
    },
    work: {
      currentRevision: {
        materials: [
          { position: 1, type: "ARTMATE_168", brand: "Artmate", line: "168" },
          { position: 2, type: "CUSTOM", brand: "Copic", line: "Sketch" },
        ],
        symbolMappings: [
          { symbol: "1", materialPosition: 2, markerNumber: "C5" },
          { symbol: "A", materialPosition: 1, markerNumber: "010" },
        ],
        caption: "Смешанная техника",
        publicationConsent: true,
        advertisingConsent: true,
      },
    },
  };

  const values = defaults.getEditorDefaultValues(data);

  assert.deepEqual(values.materials, [
    { type: "ARTMATE_168", brand: "Artmate", line: "168" },
    { type: "CUSTOM", brand: "Copic", line: "Sketch" },
  ]);
  assert.deepEqual(values.mappings, [
    { symbol: "1", materialIndex: 1, markerNumber: "C5" },
    { symbol: "2", materialIndex: null, markerNumber: "" },
    { symbol: "A", materialIndex: 0, markerNumber: "010" },
  ]);
  assert.equal("advertisingConsent" in values, false);
  assert.equal("publicationConsent" in values, false);
});

test("new editor starts without materials or mappings", async () => {
  const defaults = evaluateTypeScript(
    await readSource("src/features/work-editor/lib/default-values.ts"),
    {},
  );
  const values = defaults.getEditorDefaultValues({
    coloring: {
      officialRevision: {
        palette: {
          colors: [
            { symbol: "1", markerNumber: "001" },
            { symbol: "A", markerNumber: "010" },
          ],
        },
      },
    },
  });

  assert.deepEqual(values.materials, []);
  assert.deepEqual(values.mappings, [
    { symbol: "1", materialIndex: null, markerNumber: "" },
    { symbol: "A", materialIndex: null, markerNumber: "" },
  ]);
});

test("material helpers preserve per-color choices and enforce the 19 item limit", async () => {
  const state = evaluateTypeScript(
    await readSource("src/features/work-editor/lib/material-state.ts"),
    {},
  );
  const mappings = [
    { symbol: "1", materialIndex: 0, markerNumber: "001" },
    { symbol: "2", materialIndex: 1, markerNumber: "C5" },
    { symbol: "A", materialIndex: null, markerNumber: "" },
  ];
  const palette = [
    { symbol: "1", markerNumber: "001" },
    { symbol: "2", markerNumber: "002" },
    { symbol: "A", markerNumber: "010" },
  ];

  assert.equal(state.canAppendWorkshopMaterial(18), true);
  assert.equal(state.canAppendWorkshopMaterial(19), false);
  assert.equal(
    state.changeMaterialTypeAssignments(mappings, 0, "ARTMATE_168", "ARTMATE_168", palette),
    mappings,
  );
  assert.deepEqual(state.removeMaterialAssignments(mappings, 0), [
    { symbol: "1", materialIndex: null, markerNumber: "" },
    { symbol: "2", materialIndex: 0, markerNumber: "C5" },
    { symbol: "A", materialIndex: null, markerNumber: "" },
  ]);
});

test("editor UI hides optional materials and marker mappings behind nested controls", async () => {
  const editor = await readSource("src/features/work-editor/ui/work-editor.tsx");
  const preview = await readSource("src/features/work-editor/ui/photo-preview.tsx");
  const stepper = await readSource("src/features/work-editor/ui/stepper.tsx");

  assert.match(editor, /useForm<WorkEditorFormValues>/);
  assert.match(editor, /URL\.createObjectURL\(selectedPhoto\)/);
  assert.match(editor, /URL\.revokeObjectURL\(nextUrl\)/);
  assert.match(editor, /accept=\{acceptedWorkshopPhotoTypes\.join/);
  assert.match(editor, /<PageHero[\s\S]*?routes\.workshopCollection\(slug\)/);
  assert.match(editor, /example=\{data\.coloring\.officialImage\}/);
  assert.match(editor, /Материал цвета/);
  assert.match(editor, /mappings\.\$\{index\}\.materialIndex/);
  assert.match(editor, /Добавить материал/);
  assert.match(editor, /Материал не выбран/);
  assert.match(editor, /canAppendWorkshopMaterial/);
  assert.match(editor, /currentMaterial\.type === type/);
  assert.doesNotMatch(editor, /assignFirstArtmateMaterial/);
  assert.match(editor, /officialMarkerOptions\.map/);
  assert.match(editor, /Отправить на модерацию/);
  assert.doesNotMatch(editor, /Оставить только себе|DRAFT|необязательное согласие/);
  assert.doesNotMatch(editor, /type="checkbox"/);
  assert.match(
    editor.replace(/\s+/g, " "),
    /Отправляя фото, вы разрешаете Artmate опубликовать его в галерее и мастерской после одобрения и использовать на сайте, в соцсетях, рекламе и материалах бренда/,
  );
  assert.match(
    editor,
    /id="work-submission-consent"[\s\S]*type="submit"[\s\S]*aria-describedby="work-submission-consent"[\s\S]*Отправить на модерацию/,
  );
  assert.match(editor, /Не удалось отправить\. Попробуйте снова\./);
  assert.match(editor, /toCreateRevisionInput\(formValues, resolvedTools, officialColors\)/);
  assert.match(editor, /officialColors/);
  assert.match(
    editor,
    /if \(!isReviewStep \|\| isSaving\)[\s\S]*handleSubmit\(onSubmit, onInvalid\)/,
  );
  assert.match(editor, /currentRevision\?\.status === "PENDING"/);
  assert.match(editor, /Добавить материалы/);
  assert.match(editor, /aria-expanded=\{isMaterialsEditorOpen\}/);
  assert.match(editor, /currentStep === 1 && isMaterialsEditorOpen/);
  assert.match(editor, /currentRevision\?\.materials\.length/);
  assert.match(
    editor,
    /Добавить материал[\s\S]*?materials\.length > 0 \? \([\s\S]*?Указать номера маркеров/,
  );
  assert.match(editor, /Скрыть номера маркеров/);
  assert.match(editor, /aria-expanded=\{isMappingEditorOpen\}/);
  assert.match(
    editor,
    /currentStep === 1 &&\s*isMaterialsEditorOpen &&\s*isMappingEditorOpen &&\s*materials\.length > 0/,
  );
  assert.match(editor, /Boolean\(data\.work\?\.currentRevision\?\.symbolMappings\.length\)/);
  assert.equal(editor.match(/setIsMappingEditorOpen\(true\)/g)?.length, 2);
  assert.match(
    editor,
    /formErrors\.materials \|\| formErrors\.mappings[\s\S]*setIsMaterialsEditorOpen\(true\)[\s\S]*formErrors\.mappings[\s\S]*setIsMappingEditorOpen\(true\)[\s\S]*setCurrentStep\(1\)/,
  );
  assert.match(editor, /currentStep === 1[\s\S]*Подпись к работе/);
  assert.match(editor, /isReviewStep \? \([\s\S]*Проверьте работу/);
  assert.doesNotMatch(`${editor}\n${preview}`, /canvas|getContext\(/i);
  assert.match(preview, /object-contain/);
  assert.doesNotMatch(
    `${editor}\n${preview}\n${stepper}`,
    /CropSlider|crop=|кадрирован|"Кадр"|Повернуть на 90°/,
  );
  assert.match(stepper, /aria-label="Шаги добавления работы"/);
  assert.match(stepper, /editorSteps = \["Фото", "Подпись", "Проверка"\]/);
  assert.match(stepper, /min-h-11/);
  assert.doesNotMatch(stepper, /"Материалы"/);
  assert.doesNotMatch(stepper, /"Символы"/);
});

test("author-material warning is neutral and only shown for supplied author details", async () => {
  const constants = await readSource("src/entities/community-work/lib/constants.ts");
  const publicWork = await readSource("src/features/public-work/ui/public-work.tsx");
  const warning =
    "Информация в блоке материалов предоставлена автором работы. Модерация проверяет публикацию и её связь с выбранной картиной, но не подтверждает фактическое использование перечисленных материалов или маркеров. Оттенки могут отличаться из-за бумаги, техники нанесения, освещения и цветопередачи экрана.";

  assert.ok(constants.includes(warning));
  assert.match(publicWork, /authorMaterialsWarning/);
  assert.match(
    publicWork,
    /work\.author\.name[\s\S]*hasAuthorMaterialDetails[\s\S]*authorMaterialsWarning/,
  );
});
