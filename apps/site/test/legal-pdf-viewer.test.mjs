import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { env, execPath } from "node:process";
import { test } from "node:test";
import { promisify } from "node:util";

import ts from "typescript";

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
  const mainBuildSpecifier = nextConfigSource.match(/const legacyPdfJsBuild = "([^"]+)"/)?.[1];

  assert.equal(mainBuildSpecifier, "pdfjs-dist/legacy/build/pdf.min.mjs");
  assert.match(nextConfigSource, /resolveAlias:\s*\{[\s\S]*"pdfjs-dist":\s*legacyPdfJsBuild/);
  assert.match(nextConfigSource, /alias\["pdfjs-dist\$"\]\s*=\s*legacyPdfJsBuild/);

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

test("legal registry uses configured repository PDFs as its only PDF document source", async () => {
  const [sourceDocuments, legalPage] = await Promise.all([
    readSource("src/_pages/legal/source-documents.ts"),
    readSource("src/_pages/legal/index.tsx"),
  ]);
  const sourceEntries = getObjectProperties(
    findVariableObject(sourceDocuments, "source-documents.ts", "sourceLegalDocuments"),
    "sourceLegalDocuments",
  );
  const legalEntries = getObjectProperties(
    findVariableObject(legalPage, "index.tsx", "legalDocuments", ts.ScriptKind.TSX),
    "legalDocuments",
  );
  const expectedPdfFileHrefs = new Map([
    ["contestRules", "/documents/legal/contest-rules-2026-11-22-v3.2.pdf"],
    [
      "contestPersonalDataConsent",
      "/documents/legal/contest-personal-data-consent-2026-11-22-v3.1.pdf",
    ],
    [
      "contestPublicationConsent",
      "/documents/legal/contest-publication-consent-2026-11-22-v3.1.pdf",
    ],
    ["loyaltyRules", "/documents/legal/loyalty-rules-2026-09-22-v4.pdf"],
    ["personalDataConsent", "/documents/legal/personal-data-consent-2026-09-22.pdf"],
    ["publicOffer", "/documents/legal/public-offer-2026-09-22.pdf"],
    ["privacyPolicy", "/documents/legal/privacy-policy-2026-09-22.pdf"],
    ["userAgreement", "/documents/legal/user-agreement-2026-09-22.pdf"],
    ["cookiePolicy", "/documents/legal/cookie-policy-2026-09-22.pdf"],
    ["advertisingConsent", "/documents/legal/advertising-consent-2026-09-22.pdf"],
  ]);
  const pdfDocumentIds = [...expectedPdfFileHrefs.keys()].sort();
  const htmlDocumentIds = ["promocodes", "returnPolicy"];
  const pdfMetadataKeys = ["contentType", "description", "fileHref", "href", "title", "updatedAt"];

  assert.deepEqual([...sourceEntries.keys()].sort(), pdfDocumentIds);
  assert.deepEqual([...legalEntries.keys()].sort(), [...pdfDocumentIds, ...htmlDocumentIds].sort());

  for (const documentId of pdfDocumentIds) {
    const registryEntry = unwrapExpression(legalEntries.get(documentId));
    assert.ok(
      ts.isPropertyAccessExpression(registryEntry) &&
        ts.isIdentifier(registryEntry.expression) &&
        registryEntry.expression.text === "sourceLegalDocuments" &&
        registryEntry.name.text === documentId,
      `${documentId} must reference sourceLegalDocuments.${documentId}`,
    );

    const sourceEntry = unwrapExpression(sourceEntries.get(documentId));
    assert.ok(ts.isObjectLiteralExpression(sourceEntry), `${documentId} must be an object literal`);

    const metadata = getObjectProperties(sourceEntry, `sourceLegalDocuments.${documentId}`);
    assert.deepEqual([...metadata.keys()].sort(), pdfMetadataKeys);
    assert.equal(getStringProperty(metadata, "contentType", documentId), "pdf");

    const fileHref = getStringProperty(metadata, "fileHref", documentId);
    assert.equal(fileHref, expectedPdfFileHrefs.get(documentId), `${documentId}.fileHref`);
    assert.match(fileHref, /^\/(?!\/)/, `${documentId}.fileHref must be a root-relative path`);

    const publicDirectory = new URL("../public/", import.meta.url);
    const pdfUrl = new URL(`.${fileHref}`, publicDirectory);
    assert.ok(
      pdfUrl.href.startsWith(publicDirectory.href),
      `${documentId}.fileHref must stay in public`,
    );

    const pdf = await readFile(pdfUrl);
    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-", `${documentId}.fileHref`);
  }

  for (const documentId of htmlDocumentIds) {
    const registryEntry = unwrapExpression(legalEntries.get(documentId));
    assert.ok(
      ts.isObjectLiteralExpression(registryEntry),
      `${documentId} must be an object literal`,
    );

    const document = getObjectProperties(registryEntry, `legalDocuments.${documentId}`);
    assert.equal(getStringProperty(document, "contentType", documentId), "html");
    assert.ok(document.has("sections"), `${documentId} must retain sections`);
  }

  assert.match(legalPage, /document\.contentType === "pdf"/);
  assert.match(legalPage, /<PdfDocumentViewer/);
});

test("legal documents are collected on one directory page linked from the footer", async () => {
  const [source, routes, footer, sitemap, legalPage, directoryRoute] = await Promise.all([
    readSource("src/_pages/legal/source-documents.ts"),
    readSource("src/shared/constants/routes.ts"),
    readSource("src/widgets/footer/ui/legal-docs.tsx"),
    readSource("app/sitemap.ts"),
    readSource("src/_pages/legal/index.tsx"),
    readSource("app/(site)/legal/page.tsx"),
  ]);
  const ids = [
    ...getObjectProperties(
      findVariableObject(source, "source-documents.ts", "sourceLegalDocuments"),
      "sourceLegalDocuments",
    ).keys(),
    "returnPolicy",
    "promocodes",
  ];

  assert.match(routes, /index: "\/legal"/);
  assert.deepEqual(
    [...footer.matchAll(/routes\.legal\.(\w+)/g)].map((match) => match[1]),
    ["index"],
  );
  assert.match(legalPage, /Object\.values\(legalDocuments\)\.map/);
  const documents = getObjectProperties(
    findVariableObject(legalPage, "index.tsx", "legalDocuments", ts.ScriptKind.TSX),
    "legalDocuments",
  );
  assert.deepEqual(
    [...documents.keys()],
    [
      "contestRules",
      "contestPersonalDataConsent",
      "contestPublicationConsent",
      "publicOffer",
      "returnPolicy",
      "userAgreement",
      "privacyPolicy",
      "personalDataConsent",
      "cookiePolicy",
      "advertisingConsent",
      "loyaltyRules",
      "promocodes",
    ],
  );
  assert.match(legalPage, /<Link href=\{document\.href\}>/);
  assert.match(legalPage, /href=\{routes\.legal\.index\}/);
  assert.match(directoryRoute, /<LegalDirectoryPage\s*\/>/);
  assert.match(directoryRoute, /createLegalMetadata/);
  assert.match(sitemap, /path: routes\.legal\.index/);

  for (const id of ids) {
    const route = routes.match(new RegExp(`${id}: "([^"]+)"`))?.[1];
    assert.ok(route, `${id} must have a route constant`);
    assert.ok(sitemap.includes(`path: routes.legal.${id}`), `${id} must be in the sitemap`);
    const page = await readSource(`app/(site)${route}/page.tsx`);
    assert.match(page, /LegalPage/);
  }

  assert.doesNotMatch(source, /2026-07-24/);
});

function findVariableObject(source, fileName, variableName, scriptKind = ts.ScriptKind.TS) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== variableName) continue;

      const initializer = declaration.initializer && unwrapExpression(declaration.initializer);
      assert.ok(
        ts.isObjectLiteralExpression(initializer),
        `${variableName} must be an object literal`,
      );

      return initializer;
    }
  }

  assert.fail(`${variableName} declaration is missing`);
}

function getObjectProperties(object, label) {
  const entries = object.properties.map((property) => {
    assert.ok(ts.isPropertyAssignment(property), `${label} must use property assignments`);

    const name = getPropertyName(property.name, label);
    return [name, property.initializer];
  });
  const properties = new Map(entries);

  assert.equal(properties.size, entries.length, `${label} must not contain duplicate properties`);

  return properties;
}

function getPropertyName(name, label) {
  assert.ok(
    ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name),
    `${label} must use static property names`,
  );

  return name.text;
}

function getStringProperty(properties, propertyName, label) {
  const property = properties.get(propertyName);
  assert.ok(property, `${label}.${propertyName} is missing`);

  const value = unwrapExpression(property);
  assert.ok(ts.isStringLiteralLike(value), `${label}.${propertyName} must be a string literal`);

  return value.text;
}

function unwrapExpression(node) {
  let expression = node;

  while (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    expression = expression.expression;
  }

  return expression;
}

async function runWithoutPromiseWithResolvers(script) {
  const { stderr, stdout } = await execFileAsync(
    execPath,
    ["--input-type=module", "--eval", `Promise.withResolvers = undefined;${script}`],
    { env },
  );

  assert.equal(stderr, "");

  return stdout;
}
