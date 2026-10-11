import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import * as productTypes from "../src/shared/actions/products/products.types.ts";
import type * as FormValuesModule from "../src/features/products-management/lib/form-values.ts";
import type { ProductFormValues } from "../src/features/products-management/lib/form-values.ts";
import type { ProductCharacteristicDTO } from "../src/shared/actions/products/products.types.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");

function loadModule(path: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(
    new URL(`../src/features/products-management/${path}`, import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} as Record<string, unknown> };

  new Function("require", "module", "exports", output)(
    (specifier: string) => {
      assert.ok(
        Object.hasOwn(dependencies, specifier),
        `Unexpected test import: ${specifier}`,
      );
      return dependencies[specifier];
    },
    testModule,
    testModule.exports,
  );

  return testModule.exports;
}

const formValues = loadModule("lib/form-values.ts", {
  "@/shared/actions/products": productTypes,
  zod: require("zod"),
}) as typeof FormValuesModule;
const row = (
  name = "Цвета",
  isHighlighted = false,
): ProductCharacteristicDTO => ({ name, value: "168", isHighlighted });
const values = (
  changes: Partial<ProductFormValues> = {},
): ProductFormValues => ({
  ...formValues.createProductDefaultValues,
  slug: "markers",
  title: "Маркеры",
  ...changes,
});

test("new product starts with no guessed characteristics or instructions", () => {
  assert.deepEqual(formValues.createProductDefaultValues.characteristics, []);
  assert.equal(formValues.createProductDefaultValues.usageInstructions, "");
  assert.equal(formValues.productFormSchema.safeParse(values()).success, true);
});

test("edit defaults preserve order and highlighted fields without sharing API arrays", () => {
  const characteristics = [row("Наконечник", true), row("Цвета", true)];
  const defaults = formValues.getProductDefaultValues({
    ...values(),
    characteristics,
    usageInstructions: "Встряхните маркер.",
  });
  assert.deepEqual(defaults.characteristics, characteristics);
  assert.equal(defaults.usageInstructions, "Встряхните маркер.");
  defaults.characteristics[0]!.name = "Изменено";
  defaults.characteristics.reverse();
  assert.equal(characteristics[0]!.name, "Наконечник");
});

test("create and update mappers trim plain fields and preserve requested order", () => {
  const input = values({
    characteristics: [
      row("  Наконечник  ", true),
      { ...row("Цвета"), value: " 168 " },
    ],
    usageInstructions: " \nВстряхните.\nЗакройте.\n ",
  });
  for (const map of [
    formValues.getCreateProductInput,
    formValues.getUpdateProductInput,
  ]) {
    const result = map(input);
    assert.deepEqual(result.characteristics, [
      row("Наконечник", true),
      row("Цвета"),
    ]);
    assert.equal(result.usageInstructions, "Встряхните.\nЗакройте.");
  }
});

test("update sends empty array and blank instructions as explicit clear", () => {
  const result = formValues.getUpdateProductInput(
    values({ characteristics: [], usageInstructions: " \n " }),
  );
  assert.deepEqual(result.characteristics, []);
  assert.equal(result.usageInstructions, "");
  assert.ok(
    Object.hasOwn(JSON.parse(JSON.stringify(result)), "usageInstructions"),
  );
});

test("sale price is optional on create, explicitly cleared on update, and must be a lower positive integer", () => {
  const noDiscount = values({ priceRub: 1000, salePriceRub: null });
  const createWithoutSalePrice = formValues.getCreateProductInput(noDiscount);
  const updateWithoutSalePrice = formValues.getUpdateProductInput(noDiscount);

  assert.equal(Object.hasOwn(createWithoutSalePrice, "salePriceRub"), false);
  assert.equal(updateWithoutSalePrice.salePriceRub, null);
  assert.ok(
    Object.hasOwn(
      JSON.parse(JSON.stringify(updateWithoutSalePrice)),
      "salePriceRub",
    ),
  );

  const withSalePrice = values({ priceRub: 1000, salePriceRub: 750 });
  assert.equal(
    formValues.productFormSchema.safeParse(withSalePrice).success,
    true,
  );
  assert.equal(
    formValues.getCreateProductInput(withSalePrice).salePriceRub,
    750,
  );
  assert.equal(
    formValues.getUpdateProductInput(withSalePrice).salePriceRub,
    750,
  );

  for (const salePriceRub of [0, 1000, 1001, 1.5, 21_474_837]) {
    assert.equal(
      formValues.productFormSchema.safeParse(
        values({ priceRub: 1000, salePriceRub }),
      ).success,
      false,
      `Expected sale price ${salePriceRub} to be rejected`,
    );
  }
  assert.equal(
    formValues.productFormSchema.safeParse(
      values({ priceRub: 21_474_836, salePriceRub: 21_474_835 }),
    ).success,
    true,
  );
  assert.equal(
    formValues.productFormSchema.safeParse(values({ priceRub: 21_474_837 }))
      .success,
    false,
  );
});

test("characteristics validation rejects blank fields, excessive lengths and markup", () => {
  for (const invalid of [
    { ...row(), name: " " },
    { ...row(), value: " " },
    { ...row(), name: "а".repeat(81) },
    { ...row(), value: "а".repeat(501) },
    { ...row(), name: "<b>Цвета</b>" },
    { ...row(), value: "< 5" },
    { ...row(), value: "5 > 3" },
  ]) {
    assert.equal(
      formValues.productFormSchema.safeParse(
        values({ characteristics: [invalid] }),
      ).success,
      false,
    );
  }
  assert.equal(
    formValues.productFormSchema.safeParse(
      values({
        characteristics: [
          { ...row(), name: "а".repeat(80), value: "а".repeat(500) },
        ],
      }),
    ).success,
    true,
  );
});

test("array validation limits rows and highlights and rejects normalized duplicate names at row field", () => {
  assert.equal(
    formValues.productFormSchema.safeParse(
      values({
        characteristics: Array.from({ length: 30 }, (_, index) =>
          row(`Поле ${index}`),
        ),
      }),
    ).success,
    true,
  );
  assert.equal(
    formValues.productFormSchema.safeParse(
      values({
        characteristics: Array.from({ length: 31 }, (_, index) =>
          row(`Поле ${index}`),
        ),
      }),
    ).success,
    false,
  );
  assert.equal(
    formValues.productFormSchema.safeParse(
      values({ characteristics: [row("А", true), row("Б", true)] }),
    ).success,
    true,
  );
  assert.equal(
    formValues.productFormSchema.safeParse(
      values({
        characteristics: [row("А", true), row("Б", true), row("В", true)],
      }),
    ).success,
    false,
  );
  const duplicate = formValues.productFormSchema.safeParse(
    values({ characteristics: [row("Цвета"), row(" цвета ")] }),
  );
  assert.equal(duplicate.success, false);
  if (!duplicate.success)
    assert.deepEqual(duplicate.error.issues[0]?.path, [
      "characteristics",
      1,
      "name",
    ]);
});

test("instructions accept plain multiline text and reject markup and excess length", () => {
  assert.equal(
    formValues.productFormSchema.safeParse(
      values({ usageInstructions: "а".repeat(6000) }),
    ).success,
    true,
  );
  for (const usageInstructions of [
    "а".repeat(6001),
    "<p>Инструкция</p>",
    " > ",
  ]) {
    assert.equal(
      formValues.productFormSchema.safeParse(values({ usageInstructions }))
        .success,
      false,
    );
  }
});

type RenderedNode = {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
};
function nodes(node: unknown): RenderedNode[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const rendered = node as RenderedNode;
  return [rendered, ...nodes(rendered.props.children)];
}

function fieldsHarness(initialRows: ProductCharacteristicDTO[] = []) {
  const currentRows = initialRows.map((item, index) => ({
    ...item,
    id: `row-${index}`,
  }));
  const jsx = (type: unknown, props: RenderedNode["props"]) => ({
    type,
    props,
  });
  const component = loadModule("ui/product-characteristics-fields.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: { useId: () => "test" },
    "lucide-react": {
      ArrowDown: "ArrowDown",
      ArrowUp: "ArrowUp",
      Plus: "Plus",
      Trash2: "Trash2",
    },
    "@/shared/ui": {
      Button: "Button",
      Checkbox: "Checkbox",
      Input: "Input",
      Textarea: "Textarea",
    },
    "./form-controls": { LabeledField: "LabeledField" },
    "react-hook-form": {
      Controller: "Controller",
      useWatch: () => currentRows,
      useFieldArray: () => ({
        fields: currentRows,
        append: (item: ProductCharacteristicDTO) =>
          currentRows.push({ ...item, id: `row-${currentRows.length}` }),
        move: (from: number, to: number) =>
          currentRows.splice(to, 0, currentRows.splice(from, 1)[0]!),
        remove: (index: number) => currentRows.splice(index, 1),
      }),
    },
  }).ProductCharacteristicsFields as (
    props: Record<string, unknown>,
  ) => RenderedNode;

  return {
    currentRows,
    render: (disabled = false, errors = {}) =>
      nodes(
        component({
          control: {},
          disabled,
          errors,
          register: (name: string) => ({ name }),
        }),
      ),
  };
}

test("accessible reorder and remove actions preserve entire characteristic rows", () => {
  const harness = fieldsHarness([row("А", true), row("Б")]);
  const firstRender = harness.render();
  const firstUp = firstRender.find(
    (node) => node.props["aria-label"] === "Переместить характеристику 1 выше",
  )!;
  assert.equal(firstUp.props.disabled, true);
  const secondDown = firstRender.find(
    (node) => node.props["aria-label"] === "Переместить характеристику 2 ниже",
  )!;
  assert.equal(secondDown.props.disabled, true);
  const secondUp = firstRender.find(
    (node) => node.props["aria-label"] === "Переместить характеристику 2 выше",
  )!;
  (secondUp.props.onClick as () => void)();
  assert.deepEqual(
    harness.currentRows.map(({ name, value, isHighlighted }) => ({
      name,
      value,
      isHighlighted,
    })),
    [row("Б"), row("А", true)],
  );
  const deleteFirst = harness
    .render()
    .find((node) => node.props["aria-label"] === "Удалить характеристику 1")!;
  (deleteFirst.props.onClick as () => void)();
  assert.equal(harness.currentRows[0]!.name, "А");
});

test("add action starts a blank non-highlighted row and locks at 30", () => {
  const harness = fieldsHarness();
  const addButton = harness
    .render()
    .find((node) => node.type === "Button" && !node.props["aria-label"])!;
  (addButton.props.onClick as () => void)();
  assert.deepEqual(harness.currentRows[0], {
    name: "",
    value: "",
    isHighlighted: false,
    id: "row-0",
  });
  const full = fieldsHarness(
    Array.from({ length: 30 }, (_, index) => row(`${index}`)),
  );
  assert.equal(
    full
      .render()
      .find((node) => node.type === "Button" && !node.props["aria-label"])!
      .props.disabled,
    true,
  );
});

test("third highlight is disabled while selected highlights can be unchecked", () => {
  const harness = fieldsHarness([row("А", true), row("Б", true), row("В")]);
  const controllers = harness
    .render()
    .filter((node) => node.type === "Controller");
  const checkboxes = controllers.map((controller, index) => {
    const render = controller.props.render as (
      args: Record<string, unknown>,
    ) => unknown;
    return nodes(
      render({
        field: {
          value: harness.currentRows[index]!.isHighlighted,
          onChange: () => {},
        },
      }),
    ).find((node) => node.type === "Checkbox")!;
  });
  assert.deepEqual(
    checkboxes.map((node) => node.props.disabled),
    [false, false, true],
  );
});

test("pending disables fields and exposes array plus field errors", () => {
  const render = fieldsHarness([row()]).render(true, {
    characteristics: {
      0: { name: { message: "Название обязательно" } },
      root: { message: "Слишком много" },
    },
    usageInstructions: { message: "Слишком длинно" },
  });
  assert.ok(
    render
      .filter((node) =>
        ["Button", "Input", "Textarea"].includes(String(node.type)),
      )
      .every((node) => node.props.disabled === true),
  );
  assert.ok(
    render.some(
      (node) =>
        node.props.role === "alert" && node.props.children === "Слишком много",
    ),
  );
  assert.ok(
    render.some(
      (node) =>
        node.type === "LabeledField" &&
        node.props.error === "Название обязательно",
    ),
  );
  assert.ok(
    render.some(
      (node) =>
        node.type === "LabeledField" && node.props.error === "Слишком длинно",
    ),
  );
});

test("both product forms lock controls, expose save failure and reset only on success", () => {
  for (const file of ["create-product-card.tsx", "product-edit-form.tsx"]) {
    const source = readFileSync(
      new URL(
        `../src/features/products-management/ui/${file}`,
        import.meta.url,
      ),
      "utf8",
    );
    const fieldset = source.slice(
      source.indexOf("<fieldset"),
      source.indexOf("</fieldset>"),
    );
    assert.match(fieldset, /disabled=\{is(?:Creating|Updating)Product\}/);
    assert.match(fieldset, /<ProductCharacteristicsFields/);
    assert.match(fieldset, /type="submit"/);
    assert.match(source, /onSuccess:[\s\S]*?reset\(/);
    assert.match(source, /onError:[\s\S]*?setError\("root.server"/);
    assert.match(source, /role="alert"/);
    assert.match(source, /<ProductDescriptionEditor\s+disabled=/);
    assert.doesNotMatch(source, /onError:[\s\S]*?reset\(/);
  }
});
