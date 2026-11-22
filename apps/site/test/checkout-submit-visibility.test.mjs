import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/checkout/lib/use-checkout-submit-visibility.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ observerAvailable = true } = {}) {
  const button = {};
  let visible = true;
  let effect;
  let onIntersection;
  let observed;
  let observerOptions;
  let disconnected = false;
  const mocks = {
    useRef: () => ({ current: button }),
    useState: () => [
      visible,
      (value) => {
        visible = value;
      },
    ],
    useEffect: (callback) => {
      effect = callback;
    },
  };
  const mod = { exports: {} };
  class Observer {
    constructor(callback, options) {
      onIntersection = callback;
      observerOptions = options;
    }
    observe(target) {
      observed = target;
    }
    disconnect() {
      disconnected = true;
    }
  }
  new Function("require", "module", "exports", "IntersectionObserver", compiled)(
    () => mocks,
    mod,
    mod.exports,
    observerAvailable ? Observer : undefined,
  );
  const render = () => mod.exports.useCheckoutSubmitVisibility();
  render();
  const cleanup = effect();
  return {
    button,
    render,
    get observed() {
      return observed;
    },
    get observerOptions() {
      return observerOptions;
    },
    get disconnected() {
      return disconnected;
    },
    intersect: (isIntersecting, intersectionRatio = 0) =>
      onIntersection([{ isIntersecting, intersectionRatio }]),
    cleanup,
  };
}

test("mobile submit stays available until the whole main button is visible", () => {
  const h = harness();
  assert.equal(h.observed, h.button);
  assert.equal(h.observerOptions.threshold, 1);
  assert.equal(h.render().isSubmitVisible, true);
  h.intersect(false);
  assert.equal(h.render().isSubmitVisible, false);
  h.intersect(true, 0.25);
  assert.equal(h.render().isSubmitVisible, false);
  h.intersect(true, 0.99);
  assert.equal(h.render().isSubmitVisible, false);
  h.intersect(true, 1);
  assert.equal(h.render().isSubmitVisible, true);
  h.intersect(true, 0.5);
  assert.equal(h.render().isSubmitVisible, false);
  h.intersect(false);
  assert.equal(h.render().isSubmitVisible, false);
  h.cleanup();
  assert.equal(h.disconnected, true);
});

test("without IntersectionObserver the main button remains the only submit action", () => {
  const h = harness({ observerAvailable: false });
  assert.equal(h.render().isSubmitVisible, true);
  assert.equal(h.observed, undefined);
});
