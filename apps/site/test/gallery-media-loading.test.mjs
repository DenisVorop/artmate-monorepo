import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
async function load(path) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", compiled)(mod, mod.exports);
  return mod.exports;
}

test("preview code uses idle time even while other page resources are loading; unmount cancels it", async () => {
  const { scheduleIdlePreload } = await load(
    "shared/lib/schedule-idle-preload.ts",
  );
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let idle, cancelled;
  let calls = 0;
  globalThis.document = { readyState: "loading" };
  globalThis.window = {
    requestIdleCallback: (callback) => {
      idle = callback;
      return 10;
    },
    cancelIdleCallback: (id) => {
      cancelled = id;
    },
  };
  try {
    const cleanup = scheduleIdlePreload(async () => {
      calls++;
    });
    assert.equal(calls, 0);
    assert.equal(typeof idle, "function");
    idle();
    assert.equal(calls, 1);
    cleanup();
    assert.equal(cancelled, 10);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("browsers without idle callbacks schedule a cancellable task and tolerate failed prefetch", async () => {
  const { scheduleIdlePreload } = await load(
    "shared/lib/schedule-idle-preload.ts",
  );
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let run, cancelled;
  globalThis.document = { readyState: "complete" };
  globalThis.window = {
    setTimeout: (callback, delay) => {
      run = callback;
      assert.ok(delay > 0);
      return 20;
    },
    clearTimeout: (id) => {
      cancelled = id;
    },
  };
  try {
    const cleanup = scheduleIdlePreload(async () => {
      throw new Error("offline");
    });
    run();
    await Promise.resolve();
    cleanup();
    assert.equal(cancelled, 20);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("image candidates expose every supported width and preserve the source query", async () => {
  const { getPublicAssetSrcSet } = await load("entities/community-work/lib/image.ts");
  const candidates = getPublicAssetSrcSet(
    "https://api.artmate.example/club/works/work/assets/web?v=revision",
  ).split(", ");
  const expected = [160, 240, 320, 480, 640, 800, 960, 1200];
  assert.equal(candidates.length, expected.length);
  candidates.forEach((candidate, index) => {
    const [src, descriptor] = candidate.split(" ");
    const url = new URL(src);
    assert.equal(descriptor, `${expected[index]}w`);
    assert.equal(url.searchParams.get("width"), String(expected[index]));
    assert.equal(url.searchParams.get("v"), "revision");
  });
});

test("mosaic image hints follow wide columns, cover crops and the compact grid instead of 100vw", async () => {
  const { getMosaicBlocks, getMosaicImageSizes } = await load(
    "features/community-gallery/lib/mosaic-layout.ts",
  );
  const works = Array.from({ length: 5 }, (_, index) => ({ publicId: `work-${index}` }));
  const [block] = getMosaicBlocks(works);
  assert.match(getMosaicImageSizes(block, 0), /50\.000vw/);
  assert.notEqual(getMosaicImageSizes(block, 0), getMosaicImageSizes(block, 1));
  const [single] = getMosaicBlocks(works.slice(0, 1));
  const compact = getMosaicImageSizes(single, 0);
  assert.match(compact, /367\.0px/);
  assert.match(compact, /25\.000vw/);
  assert.match(compact, /33\.333vw/);
  assert.match(compact, /50\.000vw/);
});
