import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function loadExpandableText() {
  return readSource("src/shared/ui/expandable-text.tsx").then((source) => {
    const output = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const testModule = { exports: {} };
    const state = [];
    const refs = [
      { current: { name: "constrained outer", scrollHeight: 144 } },
      { current: { name: "natural inner", scrollHeight: 640 } },
    ];
    const effectSlots = [];
    const observers = [];
    let stateCursor = 0;
    let refCursor = 0;
    let effectCursor = 0;
    let pendingEffects = [];
    const jsx = (type, props) => ({ type, props });
    class TestResizeObserver {
      constructor(callback) {
        this.callback = callback;
        this.disconnected = false;
        observers.push(this);
      }

      observe(target) {
        this.target = target;
      }

      disconnect() {
        this.disconnected = true;
      }
    }
    const react = {
      useEffect(effect, dependencies) {
        const index = effectCursor++;
        const previous = effectSlots[index];
        const changed =
          !previous ||
          dependencies.some(
            (dependency, dependencyIndex) =>
              !Object.is(dependency, previous.dependencies[dependencyIndex]),
          );

        if (changed) {
          pendingEffects.push(() => {
            previous?.cleanup?.();
            effectSlots[index] = {
              dependencies,
              cleanup: effect(),
            };
          });
        }
      },
      useId: () => ":expandable-text:",
      useRef: () => refs[refCursor++],
      useState(initialValue) {
        const index = stateCursor++;
        if (!(index in state)) state[index] = initialValue;

        return [
          state[index],
          (value) => {
            state[index] = typeof value === "function" ? value(state[index]) : value;
          },
        ];
      },
    };
    const dependencies = {
      "react/jsx-runtime": { Fragment: "Fragment", jsx, jsxs: jsx },
      react,
      "lucide-react": { ChevronDown: "ChevronDown", ChevronUp: "ChevronUp" },
      "@/shared/lib": { cn: (...classes) => classes.filter(Boolean).join(" ") },
      "./button": { Button: "Button" },
    };
    const previousResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = TestResizeObserver;

    try {
      new Function("require", "module", "exports", output)(
        (name) => {
          assert.ok(Object.hasOwn(dependencies, name), `Unexpected test import: ${name}`);
          return dependencies[name];
        },
        testModule,
        testModule.exports,
      );
    } finally {
      globalThis.ResizeObserver = previousResizeObserver;
    }

    return {
      render(props) {
        stateCursor = 0;
        refCursor = 0;
        effectCursor = 0;
        pendingEffects = [];
        globalThis.ResizeObserver = TestResizeObserver;

        try {
          const rendered = testModule.exports.ExpandableText(props);
          pendingEffects.forEach((runEffect) => runEffect());
          return rendered;
        } finally {
          globalThis.ResizeObserver = previousResizeObserver;
        }
      },
      naturalContent: refs[1].current,
      observers,
      source,
    };
  });
}

function getElements(node) {
  if (Array.isArray(node)) return node.flatMap(getElements);
  if (!node || typeof node !== "object") return [];

  return [node, ...getElements(node.props.children)];
}

function getText(node) {
  if (Array.isArray(node)) return node.map(getText).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);

  return node?.props ? getText(node.props.children) : "";
}

test("expandable text preserves full content while toggling its rendered disclosure state", async () => {
  const harness = await loadExpandableText();
  const { render } = harness;
  const fullContent = "Полное SEO-описание";
  const props = { children: fullContent, collapsible: true };
  const collapsed = render(props);
  const collapsedElements = getElements(collapsed);
  const collapsedContent = collapsedElements.find(
    (element) => element.props.id === ":expandable-text:",
  );
  const collapsedControl = collapsedElements.find((element) => element.type === "Button");

  assert.ok(collapsedContent);
  assert.ok(collapsedControl);
  assert.equal(collapsedContent.props.style.maxHeight, "144px");
  assert.equal(getText(collapsedContent), fullContent);
  assert.equal(collapsedControl.props["aria-controls"], collapsedContent.props.id);
  assert.equal(collapsedControl.props["aria-expanded"], false);
  assert.match(getText(collapsedControl), /Показать полностью/);
  assert.ok(collapsedElements.some((element) => element.type === "ChevronDown"));

  collapsedControl.props.onClick();

  const expanded = render(props);
  const expandedElements = getElements(expanded);
  const expandedContent = expandedElements.find(
    (element) => element.props.id === ":expandable-text:",
  );
  const expandedControl = expandedElements.find((element) => element.type === "Button");

  assert.equal(expandedContent.props.style.maxHeight, "640px");
  assert.equal(getText(expandedContent), fullContent);
  assert.equal(expandedControl.props["aria-expanded"], true);
  assert.match(getText(expandedControl), /Свернуть/);
  assert.ok(expandedElements.some((element) => element.type === "ChevronUp"));

  const observer = harness.observers.at(-1);
  assert.ok(observer);
  assert.strictEqual(observer.target, harness.naturalContent);
  assert.equal(observer.target.name, "natural inner");

  harness.naturalContent.scrollHeight = 920;
  observer.callback();

  const grown = render(props);
  const grownElements = getElements(grown);
  const grownContent = grownElements.find((element) => element.props.id === ":expandable-text:");
  const grownControl = grownElements.find((element) => element.type === "Button");

  assert.equal(grownContent.props.style.maxHeight, "920px");
  assert.equal(getText(grownContent), fullContent);

  grownControl.props.onClick();

  const collapsedAgain = render(props);
  const collapsedAgainElements = getElements(collapsedAgain);
  const collapsedAgainContent = collapsedAgainElements.find(
    (element) => element.props.id === ":expandable-text:",
  );
  const collapsedAgainControl = collapsedAgainElements.find((element) => element.type === "Button");

  assert.equal(collapsedAgainContent.props.style.maxHeight, "144px");
  assert.equal(collapsedAgainControl.props["aria-expanded"], false);
  assert.match(getText(collapsedAgainControl), /Показать полностью/);
  assert.equal(observer.disconnected, true);
});

test("non-collapsible text renders all content without a disclosure control", async () => {
  const { render } = await loadExpandableText();
  const rendered = render({ children: "Короткое описание", collapsible: false });
  const elements = getElements(rendered);
  const content = elements.find((element) => element.props.id === ":expandable-text:");

  assert.ok(content);
  assert.equal(content.props.style.maxHeight, undefined);
  assert.equal(getText(content), "Короткое описание");
  assert.equal(
    elements.some((element) => element.type === "Button"),
    false,
  );
});

test("product description keeps its semantic section and existing HTML rendering contract", async () => {
  const source = await readSource("src/entities/products/ui/description.tsx");

  assert.match(source, /<section[\s\S]*?aria-labelledby="product-description-title"/);
  assert.match(source, /<SectionTitle id="product-description-title" className="text-foreground">/);
  assert.match(source, /product\.description\.length > 700/);
  assert.match(
    source,
    /<ExpandableText[\s\S]*?contentClassName="whitespace-pre-wrap text-base leading-7 text-muted-foreground md:text-lg/,
  );
  assert.match(source, /dangerouslySetInnerHTML=\{\{ __html: product\.description \}\}/);
  assert.match(source, /if \(!product\.description\) \{\s*return null;/);
});
