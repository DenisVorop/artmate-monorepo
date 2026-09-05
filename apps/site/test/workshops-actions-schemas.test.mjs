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
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
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

function apiResultMock() {
  return {
    prepareApi: (callback) => async () => {
      try {
        const data = await callback();
        return {
          toDTO: () => ({
            status: "success",
            data,
            isSuccess: true,
            isEmpty: false,
            isError: false,
          }),
        };
      } catch (error) {
        return {
          toDTO: () => ({
            status: "error",
            error: {
              name: error.name,
              message: error.message,
              status: error.status,
              stack: "secret",
            },
            isSuccess: false,
            isEmpty: false,
            isError: true,
          }),
        };
      }
    },
  };
}

test("workshop actions forward auth/IP, use no-store and add CSRF only to unsafe methods", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalFile = globalThis.File;
  globalThis.File = File;
  globalThis.fetch = async (...request) => {
    requests.push(request);
    return Response.json({ ok: true });
  };

  const actions = evaluateTypeScript(
    await readSource("src/shared/actions/workshops/workshops.actions.ts"),
    {
      "next/headers": {
        cookies: async () => ({ get: () => ({ value: "token/value" }) }),
        headers: async () => new Headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1" }),
      },
      "@/shared/lib/api-result": { ApiResult: apiResultMock() },
      "@/shared/constants": {
        formatColoringNumber: (number) => String(number).padStart(2, "0"),
      },
      "@/shared/lib/api-security": {
        apiCsrfHeader: { "x-artmate-csrf": "1" },
        getForwardedIpHeaders: () => ({ "x-forwarded-for": "198.51.100.9" }),
      },
    },
  );

  try {
    await actions.getMyWorkshop();
    await actions.updateMyWorkshopVisibility({ isPublic: true });
    await actions.createMyWorkshopRevision("forest", 1, {
      photo: new File(["photo"], "work.webp", { type: "image/webp" }),
      caption: "Готовая работа",
      publicationConsent: true,
      advertisingConsent: false,
      crop: { rotation: 90, zoom: 1.2, x: 0.1, y: -0.2 },
      materials: [{ toolId: "a".repeat(32) }],
      symbolMappings: [
        {
          symbol: "1",
          markerNumber: "023A",
          materialPosition: 1,
          officialMarkerColorId: "marker-color-023",
        },
      ],
    });
    await actions.reportCommunityWork("b".repeat(24), {
      revisionId: "c".repeat(32),
      reason: "PERSONAL_DATA",
      details: "На фото виден адрес",
    });

    const getInit = requests[0][1];
    assert.equal(getInit.cache, "no-store");
    assert.equal(getInit.headers.cookie, "artmate_access_token=token%2Fvalue");
    assert.equal(getInit.headers["x-forwarded-for"], "198.51.100.9");
    assert.equal(getInit.headers["x-artmate-csrf"], undefined);

    const patchInit = requests[1][1];
    assert.equal(patchInit.headers["x-artmate-csrf"], "1");
    assert.equal(patchInit.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(patchInit.body), { isPublic: true });

    const multipartInit = requests[2][1];
    assert.equal(multipartInit.cache, "no-store");
    assert.equal(multipartInit.headers["x-artmate-csrf"], "1");
    assert.equal(multipartInit.headers["content-type"], undefined);
    assert.ok(multipartInit.body instanceof FormData);
    assert.equal(multipartInit.body.get("photo").name, "work.webp");
    const payload = JSON.parse(multipartInit.body.get("payload"));
    assert.deepEqual(payload.materials, [{ toolId: "a".repeat(32) }]);
    assert.deepEqual(payload.symbolMappings, [
      {
        symbol: "1",
        markerNumber: "023A",
        materialPosition: 1,
        officialMarkerColorId: "marker-color-023",
      },
    ]);
    assert.equal(payload.publicationConsent, true);
    assert.equal(payload.intent, undefined);
    assert.equal(payload.tool, undefined);
    assert.equal(payload.mappings, undefined);

    const reportInit = requests[3][1];
    assert.deepEqual(JSON.parse(reportInit.body), {
      revisionId: "c".repeat(32),
      reason: "PERSONAL_DATA",
      details: "На фото виден адрес",
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.File = originalFile;
  }
});

test("workshop asset proxy rejects a declared oversized body before buffering it", async () => {
  const originalFetch = globalThis.fetch;
  let buffered = false;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({
      "content-type": "image/webp",
      "content-length": String(21 * 1024 * 1024),
    }),
    arrayBuffer: async () => {
      buffered = true;
      return new ArrayBuffer(0);
    },
  });
  const actions = evaluateTypeScript(
    await readSource("src/shared/actions/workshops/workshops.actions.ts"),
    {
      "next/headers": {
        cookies: async () => ({ get: () => ({ value: "token" }) }),
        headers: async () => new Headers(),
      },
      "@/shared/lib/api-result": { ApiResult: apiResultMock() },
      "@/shared/constants": {
        formatColoringNumber: (number) => String(number).padStart(2, "0"),
      },
      "@/shared/lib/api-security": {
        apiCsrfHeader: { "x-artmate-csrf": "1" },
        getForwardedIpHeaders: () => ({}),
      },
    },
  );

  try {
    const result = await actions.getOwnerRevisionAssetDataUrl("a".repeat(32), "web");
    assert.equal(result.error.status, 502);
    assert.equal(result.error.message, "Workshop image is too large");
    assert.equal(buffered, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bounded workshop read schemas accept needed fields and reject private storage data", async () => {
  const schemas = evaluateTypeScript(await readSource("src/entities/workshop/model/schemas.ts"), {
    zod: { z },
  });
  const workshop = {
    handle: "anna",
    isPublic: true,
    isIndexable: false,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    collections: [
      {
        id: "cmcollection1",
        slug: "forest",
        title: "Лес",
        source: "PURCHASE",
        hasPaidOrder: true,
        addedAt: "2026-09-01T12:00:00.000Z",
        cover: { url: "https://api.test/cover", alt: "Лес", width: 800, height: 600 },
        expectedColoringCount: 25,
        workCount: 3,
      },
    ],
  };

  assert.equal(schemas.ownerWorkshopSchema.safeParse(workshop).success, true);
  assert.equal(
    schemas.ownerWorkshopSchema.safeParse({ ...workshop, privateStorageKey: "secret" }).success,
    false,
  );
  assert.equal(
    schemas.workshopMappingSchema.safeParse({
      symbol: "J",
      markerNumber: "023A",
      materialPosition: 1,
    }).success,
    true,
  );
  assert.equal(
    schemas.workshopMappingSchema.safeParse({
      symbol: "J",
      markerNumber: "",
      materialPosition: 1,
    }).success,
    true,
  );
  assert.equal(
    schemas.workshopMappingSchema.safeParse({
      symbol: "K",
      markerNumber: "023",
      materialPosition: 1,
    }).success,
    false,
  );

  const revision = {
    id: "a".repeat(32),
    sequence: 1,
    status: "PENDING",
    crop: { rotation: 0, zoom: 1, x: 0, y: 0 },
    materials: [{ position: 19, type: "CUSTOM", brand: "Copic", line: "Sketch" }],
    symbolMappings: [{ symbol: "1", markerNumber: "023", materialPosition: 19 }],
    publicationConsent: true,
    publicationConsentAt: "2026-09-01T12:00:00.000Z",
    advertisingConsent: true,
    advertisingConsentAt: "2026-09-01T12:00:00.000Z",
    assets: {
      normalized: "https://api.test/normalized",
      web: "https://api.test/web",
      thumb: "https://api.test/thumb",
    },
    suspectedOfficialCopy: false,
    submittedAt: "2026-09-01T12:00:00.000Z",
    createdAt: "2026-09-01T12:00:00.000Z",
  };

  assert.equal(schemas.workshopRevisionSchema.safeParse(revision).success, true);
  assert.equal(
    schemas.workshopRevisionSchema.safeParse({
      ...revision,
      materials: [],
      symbolMappings: [],
    }).success,
    true,
  );
  assert.equal(
    schemas.workshopRevisionSchema.safeParse({
      ...revision,
      publicationConsentAt: undefined,
    }).success,
    false,
  );
  assert.equal(
    schemas.workshopRevisionSchema.safeParse({
      ...revision,
      publicationConsent: false,
      publicationConsentAt: undefined,
    }).success,
    true,
  );
  assert.equal(
    schemas.workshopRevisionSchema.safeParse({
      ...revision,
      advertisingConsentAt: undefined,
    }).success,
    false,
  );
  assert.equal(
    schemas.workshopRevisionSchema.safeParse({
      ...revision,
      advertisingConsent: false,
      advertisingConsentAt: undefined,
    }).success,
    true,
  );
});

test("public work schema matches nested moderated API payload and rejects private fields", async () => {
  const schemas = evaluateTypeScript(
    await readSource("src/entities/community-work/model/schemas.ts"),
    { zod: { z } },
  );
  const work = {
    revisionId: "a".repeat(32),
    publicId: "b".repeat(24),
    author: { handle: "anna", name: "Анна" },
    official: {
      collection: { slug: "forest", title: "Лес" },
      coloring: { number: 1, title: "Лисёнок" },
      coloredUrl: "https://api.test/coloring.webp",
      palette: { label: "Artmate", version: "1", colors: [] },
    },
    relatedProduct: { slug: "forest-album", title: "Альбом", categorySlug: "albums" },
    submission: {
      materials: [{ position: 1, type: "CUSTOM", brand: "Copic", line: "Sketch" }],
      symbolMappings: [{ symbol: "1", markerNumber: "023", materialPosition: 1 }],
      assets: { web: "https://api.test/web", thumb: "https://api.test/thumb" },
      publishedAt: "2026-09-01T12:00:00.000Z",
    },
  };

  assert.equal(schemas.publicCommunityWorkSchema.safeParse(work).success, true);
  assert.equal(
    schemas.publicCommunityWorkSchema.safeParse({
      ...work,
      submission: {
        ...work.submission,
        materials: [],
        symbolMappings: [],
      },
    }).success,
    true,
  );
  assert.equal(
    schemas.publicCommunityWorkSchema.safeParse({
      ...work,
      submission: {
        ...work.submission,
        symbolMappings: [{ symbol: "1", markerNumber: "", materialPosition: 1 }],
      },
    }).success,
    true,
  );
  assert.equal(
    schemas.publicCommunityWorkSchema.safeParse({
      ...work,
      submission: { ...work.submission, advertisingConsentAt: "2026-09-01T12:00:00.000Z" },
    }).success,
    false,
  );
  assert.equal(
    schemas.publicCommunityWorkSchema.safeParse({ ...work, storageKey: "private/key" }).success,
    false,
  );
});

test("large photo server action limit and fail-soft community enrichment are explicit", async () => {
  const nextConfig = await readSource("next.config.js");
  const builder = await readSource("src/_app/lib/community-data-builder.ts");

  assert.match(nextConfig, /serverActions:\s*\{[\s\S]*bodySizeLimit:\s*"12mb"/);
  assert.match(builder, /withRelatedWorks[\s\S]*try[\s\S]*catch[\s\S]*setQueryData/);
  assert.match(builder, /return \[\]/);
});
