import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

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
    /new URL\(\s*"pdfjs-dist\/build\/pdf\.worker\.min\.mjs",\s*import\.meta\.url/,
  );
  assert.match(rendererSource, /new ResizeObserver/);
  assert.match(rendererSource, /Array\.from\(\{ length: numPages \}/);
  assert.match(rendererSource, /renderTextLayer/);
  assert.match(rendererSource, /renderAnnotationLayer/);
  assert.match(rendererSource, /Открыть PDF/);
  assert.match(rendererSource, /Скачать PDF/);
});
