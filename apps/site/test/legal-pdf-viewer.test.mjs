import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { env, execPath } from "node:process";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("legal PDF viewer is client-only and renders every page with local PDF.js", async () => {
  const [boundarySource, rendererSource] = await Promise.all([
    readSource("src/_pages/legal/ui/pdf-document-viewer.tsx"),
    readSource("src/_pages/legal/ui/pdf-document.tsx"),
  ]);

  assert.match(boundarySource, /dynamic\(/);
  assert.match(boundarySource, /ssr:\s*false/);
  assert.match(rendererSource, /pdfjs\.GlobalWorkerOptions\.workerSrc/);
  assert.match(
    rendererSource,
    /new URL\(\s*"pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs",\s*import\.meta\.url/,
  );
  assert.match(rendererSource, /new ResizeObserver/);
  assert.match(rendererSource, /Array\.from\(\{ length: numPages \}/);
  assert.match(rendererSource, /renderTextLayer/);
  assert.match(rendererSource, /renderAnnotationLayer/);
  assert.doesNotMatch(rendererSource, /renderTextLayer\s*=\s*\{\s*false\s*\}/);
  assert.doesNotMatch(rendererSource, /renderAnnotationLayer\s*=\s*\{\s*false\s*\}/);
  assert.match(rendererSource, /Открыть PDF/);
  assert.match(rendererSource, /Скачать PDF/);
});

test("legal PDF main runtime uses the legacy compatibility build", async () => {
  const nextConfigSource = await readSource("next.config.js");
  const mainBuildSpecifier = nextConfigSource.match(
    /const legacyPdfJsBuild = "([^"]+)"/,
  )?.[1];

  assert.equal(mainBuildSpecifier, "pdfjs-dist/legacy/build/pdf.mjs");
  assert.match(
    nextConfigSource,
    /resolveAlias:\s*\{[\s\S]*"pdfjs-dist":\s*legacyPdfJsBuild/,
  );
  assert.match(
    nextConfigSource,
    /alias\["pdfjs-dist\$"\]\s*=\s*legacyPdfJsBuild/,
  );

  const mainBuildUrl = import.meta.resolve(mainBuildSpecifier);
  const stdout = await runWithoutPromiseWithResolvers(`
    URL.parse = undefined;
    AbortSignal.any = undefined;
    const pdfjs = await import(${JSON.stringify(mainBuildUrl)});

    const deferred = Promise.withResolvers();
    deferred.resolve("main-ready");

    const abortController = new AbortController();
    const combinedSignal = AbortSignal.any([abortController.signal]);
    abortController.abort("main-aborted");

    process.stdout.write(JSON.stringify({
      abortReason: combinedSignal.reason,
      pdfjsVersion: pdfjs.version,
      resolvedValue: await deferred.promise,
      url: URL.parse("/document.pdf", "https://artmate.ru").href,
    }));
  `);

  assert.deepEqual(JSON.parse(stdout), {
    abortReason: "main-aborted",
    pdfjsVersion: "5.4.296",
    resolvedValue: "main-ready",
    url: "https://artmate.ru/document.pdf",
  });
});

test("legal PDF worker installs working Promise compatibility in its own realm", async () => {
  const rendererSource = await readSource("src/_pages/legal/ui/pdf-document.tsx");
  const workerSpecifier = rendererSource.match(
    /new URL\(\s*"([^"]+pdf\.worker\.min\.mjs)",\s*import\.meta\.url/,
  )?.[1];

  assert.ok(workerSpecifier, "local PDF.js worker module is missing");
  assert.ok(workerSpecifier.startsWith("pdfjs-dist/"), "worker must remain package-local");

  const workerUrl = import.meta.resolve(workerSpecifier);
  const stdout = await runWithoutPromiseWithResolvers(`
    await import(${JSON.stringify(workerUrl)});

    const deferred = Promise.withResolvers();
    deferred.resolve("worker-ready");
    process.stdout.write(await deferred.promise);
  `);

  assert.equal(stdout, "worker-ready");
});

async function runWithoutPromiseWithResolvers(script) {
  const { stderr, stdout } = await execFileAsync(
    execPath,
    ["--input-type=module", "--eval", `Promise.withResolvers = undefined;${script}`],
    { env },
  );

  assert.equal(stderr, "");

  return stdout;
}
