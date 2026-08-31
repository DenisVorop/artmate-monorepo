import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  createPromoCodeDefaultValues,
  promoCodeFormSchema,
} from "../src/features/promocodes-management/lib/form-values.ts";
import { generatePromoCode } from "../src/features/promocodes-management/lib/generate-code.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const prefix = "ARTM-";

type RenderedNode = {
  readonly props: Record<string, unknown> & { readonly children?: unknown };
  readonly type: unknown;
};

function withRandomBytes<T>(byteSets: readonly number[][], run: () => T) {
  const originalCrypto = globalThis.crypto;
  let callIndex = 0;

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues(array: Uint8Array) {
        const bytes = byteSets[callIndex++];

        assert.ok(bytes, "Unexpected getRandomValues call");
        assert.equal(array.length, 6);
        array.set(bytes);
        return array;
      },
    },
  });

  try {
    return run();
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  }
}

function getRenderedNodes(node: unknown): RenderedNode[] {
  if (Array.isArray(node)) return node.flatMap(getRenderedNodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];

  const renderedNode = node as RenderedNode;

  return [renderedNode, ...getRenderedNodes(renderedNode.props.children)];
}

function getRenderedText(node: unknown): string {
  if (Array.isArray(node)) return node.map(getRenderedText).join("");
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (!node || typeof node !== "object" || !("props" in node)) return "";

  return getRenderedText((node as RenderedNode).props.children);
}

function loadPromoCodeForm(generatedCodes: readonly string[]) {
  const source = readFileSync(
    new URL(
      "../src/features/promocodes-management/ui/promo-code-form.tsx",
      import.meta.url,
    ),
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
  const jsx = (type: unknown, props: RenderedNode["props"]): RenderedNode => ({
    props,
    type,
  });
  let generateCallCount = 0;
  const dependencies: Record<string, unknown> = {
    "../lib": {
      generatePromoCode: () => generatedCodes[generateCallCount++]!,
    },
    "@/shared/ui": {
      Button: "Button",
      Checkbox: "Checkbox",
      Input: "Input",
      NativeSelect: "NativeSelect",
      NativeSelectOption: "NativeSelectOption",
      Textarea: "Textarea",
    },
    "lucide-react": { Save: "Save" },
    "react-hook-form": { Controller: "Controller" },
    "react/jsx-runtime": { jsx, jsxs: jsx },
  };

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

  return {
    getGenerateCallCount: () => generateCallCount,
    PromoCodeForm: testModule.exports.PromoCodeForm as (props: {
      readonly codeImmutable?: boolean;
      readonly form: Record<string, unknown>;
      readonly formId: string;
      readonly onSubmit: () => void;
      readonly submitLabel: string;
      readonly submitPending: boolean;
    }) => RenderedNode,
  };
}

function renderPromoCodeForm({
  codeImmutable = false,
  generatedCodes = ["ARTM-ABCDEF", "ARTM-PQRSTU"],
  submitPending = false,
} = {}) {
  const harness = loadPromoCodeForm(generatedCodes);
  const setValueCalls: unknown[][] = [];
  let submitCallCount = 0;
  const rendered = harness.PromoCodeForm({
    codeImmutable,
    form: {
      control: {},
      formState: { errors: {} },
      register: (name: string) => ({ name }),
      setValue: (...args: unknown[]) => setValueCalls.push(args),
      watch: () => "percentage",
    },
    formId: "create-promo-code",
    onSubmit: () => {
      submitCallCount += 1;
    },
    submitLabel: "Создать",
    submitPending,
  });

  return {
    ...harness,
    getSubmitCallCount: () => submitCallCount,
    nodes: getRenderedNodes(rendered),
    setValueCalls,
  };
}

test("promo code generator maps every unbiased modulo-32 value to its alphabet", () => {
  const byteSets = [
    Array.from({ length: 6 }, (_, index) => index),
    Array.from({ length: 6 }, (_, index) => index + 6),
    Array.from({ length: 6 }, (_, index) => index + 12),
    Array.from({ length: 6 }, (_, index) => index + 18),
    Array.from({ length: 6 }, (_, index) => index + 24),
    [30, 31, 32, 63, 64, 255],
  ];

  const generatedCodes = withRandomBytes(byteSets, () => [
    generatePromoCode(),
    generatePromoCode(),
    generatePromoCode(),
    generatePromoCode(),
    generatePromoCode(),
    generatePromoCode(),
  ]);
  const generatedSuffixes = generatedCodes
    .map((code) => {
      assert.match(code, /^ARTM-[A-HJ-NP-Z2-9]{6}$/);
      assert.equal(code.startsWith(prefix), true);

      return code.slice(prefix.length);
    })
    .join("");

  assert.equal(generatedSuffixes.slice(0, 32), alphabet);
  assert.equal(generatedSuffixes.slice(32), "A9A9");
});

test("generated promo code has length 11 and passes the existing form schema", () => {
  const code = withRandomBytes([[0, 31, 32, 255, 8, 9]], generatePromoCode);

  assert.equal(code, "ARTM-A9A9JK");
  assert.match(code, /^ARTM-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(code.length, 11);
  assert.equal(
    promoCodeFormSchema.safeParse({
      ...createPromoCodeDefaultValues,
      amount: "10",
      code,
      name: "Тестовый промокод",
    }).success,
    true,
  );
});

test("generate button updates only code with RHF dirty and validation flags", () => {
  const harness = renderPromoCodeForm();
  const generateButton = harness.nodes.find(
    (node) =>
      node.type === "Button" && getRenderedText(node) === "Сгенерировать",
  );

  assert.ok(generateButton);
  assert.equal(generateButton.props.type, "button");
  assert.equal(generateButton.props.disabled, false);

  const onClick = generateButton.props.onClick as () => void;
  onClick();
  onClick();

  assert.deepEqual(harness.setValueCalls, [
    ["code", "ARTM-ABCDEF", { shouldDirty: true, shouldValidate: true }],
    ["code", "ARTM-PQRSTU", { shouldDirty: true, shouldValidate: true }],
  ]);
  assert.equal(harness.getGenerateCallCount(), 2);
  assert.equal(harness.getSubmitCallCount(), 0);
});

test("generation is pending-safe and edit-locked while keeping code labeling explicit", () => {
  const pendingHarness = renderPromoCodeForm({ submitPending: true });
  const pendingButton = pendingHarness.nodes.find(
    (node) =>
      node.type === "Button" && getRenderedText(node) === "Сгенерировать",
  );

  assert.ok(pendingButton);
  assert.equal(pendingButton.props.disabled, true);
  (pendingButton.props.onClick as () => void)();
  assert.deepEqual(pendingHarness.setValueCalls, []);
  assert.equal(pendingHarness.getGenerateCallCount(), 0);

  const lockedHarness = renderPromoCodeForm({ codeImmutable: true });
  const codeInput = lockedHarness.nodes.find(
    (node) =>
      node.type === "Input" && node.props.id === "create-promo-code-code",
  );
  const codeLabel = lockedHarness.nodes.find(
    (node) =>
      node.type === "label" && node.props.htmlFor === "create-promo-code-code",
  );

  assert.ok(codeInput);
  assert.equal(codeInput.props.disabled, true);
  assert.ok(codeLabel);
  assert.equal(
    lockedHarness.nodes.some(
      (node) =>
        node.type === "Button" && getRenderedText(node) === "Сгенерировать",
    ),
    false,
  );
  assert.equal(lockedHarness.getGenerateCallCount(), 0);
});
