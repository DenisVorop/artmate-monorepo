import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load(path, globals, mocks = {}) {
  const source = await readFile(
    new URL("../src/shared/lib/device/" + path, import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    ...globals,
    module: mod,
    exports: mod.exports,
    require: (id) => mocks[id],
  });
  return mod.exports;
}

test("responsive device state follows CSS media queries, including fractional widths at browser zoom", async () => {
  let width = 1024;
  const mediaQueries = new Map();
  const globals = {
    navigator: {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
      maxTouchPoints: 0,
    },
    window: {
      get innerWidth() {
        return Math.round(width);
      },
      matchMedia(query) {
        if (!mediaQueries.has(query)) {
          const minimum = Number(/min-width: (\d+)px/.exec(query)[1]);
          mediaQueries.set(query, {
            get matches() {
              return width >= minimum;
            },
          });
        }
        return mediaQueries.get(query);
      },
    },
  };
  const deviceInfo = await load("device-info.ts", globals);
  const { useDeviceInfo: readDeviceInfo } = await load("use-device-info.ts", globals, {
    react: {
      useContext: () => deviceInfo.createDeviceInfo("desktop", true),
      useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    },
    "./device.context": { DeviceInfoContext: {} },
    "./device-info": deviceInfo,
  });

  for (const [viewportWidth, expectedMobile] of [
    [375, true],
    [767, true],
    [767.9, true],
    [768, false],
    [1024, false],
  ]) {
    width = viewportWidth;
    const info = readDeviceInfo();
    assert.equal(info.isMobile, expectedMobile, `Unexpected modal mode at ${width} CSS px`);
    assert.equal(info.isApple, true);
  }
});
