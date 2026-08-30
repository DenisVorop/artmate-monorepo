import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import {
  type INestApplication,
  Module,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import sharp from "sharp";

import {
  createNamespacedStrongEtag,
  matchesIfNoneMatch,
  quoteStrongEtag,
} from "../src/common/conditional-get";
import { PublicColoringsController } from "../src/colorings/public-colorings.controller";
import { PublicColoringsService } from "../src/colorings/public-colorings.service";
import { configureStaticUploads } from "../src/colorings/static-uploads";

let asset: Buffer;
let assetChecksum: string;
let assetReadCount = 0;
const detail = {
  id: "coloring-1",
  number: 1,
  title: "Лесные друзья",
  description: "Сюжет с лесными животными",
  publishedRevisionId: "revision-current",
  publishedAt: "2026-08-29T10:00:00.000Z",
  firstPublishedAt: "2026-08-29T09:00:00.000Z",
  themes: [{ id: "theme-1", slug: "forest", title: "Лес" }],
  collection: {
    id: "collection-1",
    slug: "mysterious-forest",
    title: "Загадочный лес",
    product: {
      id: "product-1",
      slug: "album-1",
      title: "Альбом 1",
      category: { id: "category-1", slug: "books", title: "Раскраски" },
    },
  },
  palette: {
    label: "Artmate 168",
    version: "2026-08",
    usedColorCount: 2,
    colors: [
      {
        symbolPosition: 1,
        symbol: "1",
        colorNumber: 27,
        pantone: "5595C",
        hex: "#D7E4DD",
        markerNumber: "173",
      },
      {
        symbolPosition: 19,
        symbol: "J",
        colorNumber: 241,
        pantone: "7621C",
        hex: "#A6192E",
        markerNumber: "023",
      },
    ],
  },
  width: 1200,
  height: 800,
  outline: {
    url: "http://localhost/colorings/mysterious-forest/01/assets/revision-current/outline/content",
    alt: "Контур лесных друзей",
  },
  colored: {
    url: "http://localhost/colorings/mysterious-forest/01/assets/revision-current/colored/content",
    alt: "Лесные друзья в цвете",
  },
};

const publicColoringsService = {
  getManifest: async () => [
    {
      collectionSlug: "mysterious-forest",
      number: 1,
      lastModified: "2026-08-29T10:00:00.000Z",
    },
  ],
  getColoring: async (collectionSlug: string, number: number) => {
    if (collectionSlug === "missing" || number !== 1) {
      throw new NotFoundException("Coloring not found");
    }
    if (collectionSlug === "invalid-response") {
      return { ...detail, privatePath: "/srv/private/colorings/source.webp" };
    }
    return detail;
  },
  getAssetDescriptor: async (
    _collectionSlug: string,
    _number: number,
    revisionId: string,
  ) => {
    if (revisionId === "missing") {
      throw new NotFoundException("Coloring not found");
    }

    return {
      key: revisionId,
      checksum: assetChecksum,
      byteSize: asset.length,
      width: 2,
      height: 1,
    };
  },
  readAsset: async ({ key }: { key: string }) => {
    assetReadCount += 1;

    if (key === "unavailable") {
      throw new ServiceUnavailableException("Coloring asset is unavailable");
    }

    return asset;
  },
};

@Module({
  controllers: [PublicColoringsController],
  providers: [
    { provide: PublicColoringsService, useValue: publicColoringsService },
  ],
})
class TestPublicColoringsModule {}

describe("conditional GET", () => {
  it("quotes a strong opaque ETag", () => {
    assert.equal(quoteStrongEtag("abc123"), '"abc123"');
  });

  for (const [header, expected] of [
    [undefined, false],
    ['"other"', false],
    ['"abc123"', true],
    ['W/"abc123"', true],
    ['"other", W/"abc123", "third"', true],
    ["*", true],
  ] as const) {
    it(`matches If-None-Match ${String(header)} using GET semantics`, () => {
      assert.equal(matchesIfNoneMatch(header, '"abc123"'), expected);
    });
  }
});

describe("Public colorings HTTP contract", () => {
  let app: INestApplication;
  let baseUrl: string;
  let uploadsRoot: string;

  before(async () => {
    asset = await sharp({
      create: {
        width: 2,
        height: 1,
        channels: 4,
        background: { r: 217, g: 70, b: 117, alpha: 1 },
      },
    })
      .webp()
      .toBuffer();
    assetChecksum = createHash("sha256").update(asset).digest("hex");
    uploadsRoot = await mkdtemp(join(tmpdir(), "artmate-public-colorings-"));
    await mkdir(join(uploadsRoot, "colorings"));
    await writeFile(join(uploadsRoot, "other.txt"), "allowed-upload");
    await writeFile(join(uploadsRoot, "colorings", "secret.webp"), "blocked");

    app = await NestFactory.create<NestExpressApplication>(
      TestPublicColoringsModule,
      { logger: false },
    );
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    configureStaticUploads(app as NestExpressApplication, uploadsRoot);
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
    await rm(uploadsRoot, { recursive: true, force: true });
  });

  it("serves anonymous list and detail with strong conditional JSON caching", async () => {
    const listResponse = await fetch(`${baseUrl}/colorings`);
    assert.equal(listResponse.status, 200);
    assert.equal(
      listResponse.headers.get("cache-control"),
      "public, max-age=0, must-revalidate",
    );
    assert.match(listResponse.headers.get("etag") ?? "", /^"[a-f0-9]{64}"$/);
    assert.deepEqual(await listResponse.json(), [
      {
        collectionSlug: "mysterious-forest",
        number: 1,
        lastModified: "2026-08-29T10:00:00.000Z",
      },
    ]);

    const detailResponse = await fetch(
      `${baseUrl}/colorings/mysterious-forest/01`,
    );
    const etag = detailResponse.headers.get("etag");
    assert.equal(detailResponse.status, 200);
    assert.match(etag ?? "", /^"[a-f0-9]{64}"$/);
    assert.deepEqual(await detailResponse.json(), detail);

    const notModified = await fetch(
      `${baseUrl}/colorings/mysterious-forest/01`,
      { headers: { "if-none-match": `"other", W/${etag}` } },
    );
    assert.equal(notModified.status, 304);
    assert.equal(await notModified.text(), "");
    assert.equal(notModified.headers.get("etag"), etag);
    assert.equal(
      notModified.headers.get("cache-control"),
      "public, max-age=0, must-revalidate",
    );
  });

  it("accepts only canonical two-digit numbers from 01 through 99", async () => {
    for (const segment of ["1", "001", "00", "100", "-1", "ab"]) {
      const response = await fetch(
        `${baseUrl}/colorings/mysterious-forest/${segment}`,
      );

      assert.equal(response.status, 404, segment);
      assert.equal(response.headers.get("cache-control"), "no-store", segment);
    }
  });

  it("serves current and old immutable WebP assets with actual lengths", async () => {
    assetReadCount = 0;
    const assetEtag = createNamespacedStrongEtag(
      "artmate-coloring-public-asset-v2",
      assetChecksum,
    );

    assert.notEqual(assetEtag, `"${assetChecksum}"`);

    for (const revisionId of ["revision-current", "revision-old"]) {
      const response = await fetch(
        `${baseUrl}/colorings/mysterious-forest/01/assets/${revisionId}/outline/content`,
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/webp");
      assert.equal(
        response.headers.get("cache-control"),
        "public, max-age=31536000, immutable",
      );
      assert.equal(response.headers.get("etag"), assetEtag);
      assert.equal(
        response.headers.get("content-length"),
        String(asset.length),
      );
      const responseAsset = Buffer.from(await response.arrayBuffer());
      assert.deepEqual(responseAsset, asset);
      assert.equal((await sharp(responseAsset).metadata()).format, "webp");
    }
    assert.equal(assetReadCount, 2);

    const head = await fetch(
      `${baseUrl}/colorings/mysterious-forest/01/assets/revision-old/colored/content`,
      { method: "HEAD" },
    );
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("etag"), assetEtag);
    assert.equal(head.headers.get("content-length"), String(asset.length));
    assert.equal(await head.text(), "");
    assert.equal(assetReadCount, 2);

    const notModified = await fetch(
      `${baseUrl}/colorings/mysterious-forest/01/assets/revision-old/colored/content`,
      { headers: { "if-none-match": `W/${assetEtag}` } },
    );
    assert.equal(notModified.status, 304);
    assert.equal(await notModified.text(), "");
    assert.equal(assetReadCount, 2);
  });

  it("uses no-store for 404, 503 and response-validation 5xx errors", async () => {
    for (const [path, status] of [
      ["/colorings/missing/01", 404],
      ["/colorings/mysterious-forest/01/assets/missing/outline/content", 404],
      [
        "/colorings/mysterious-forest/01/assets/unavailable/outline/content",
        503,
      ],
      ["/colorings/invalid-response/01", 500],
    ] as const) {
      const response = await fetch(`${baseUrl}${path}`);
      const body = await response.text();
      assert.equal(response.status, status, path);
      assert.equal(response.headers.get("cache-control"), "no-store", path);
      assert.equal(body.includes("/srv/private"), false, path);
    }
  });

  it("blocks direct coloring uploads before retaining generic uploads", async () => {
    const blocked = await fetch(`${baseUrl}/uploads/colorings/secret.webp`);
    assert.equal(blocked.status, 404);
    assert.equal(blocked.headers.get("cache-control"), "no-store");
    assert.equal((await blocked.text()).includes("blocked"), false);

    const allowed = await fetch(`${baseUrl}/uploads/other.txt`);
    assert.equal(allowed.status, 200);
    assert.equal(await allowed.text(), "allowed-upload");
  });

  it("blocks coloring uploads reached through an encoded path separator", async () => {
    const response = await fetch(`${baseUrl}/uploads/colorings%2Fsecret.webp`);
    const body = await response.text();

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.includes("blocked"), false);
  });

  it("fails closed for malformed upload path encoding", async () => {
    const response = await fetch(`${baseUrl}/uploads/colorings%ZZ/secret.webp`);
    const body = await response.text();

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.includes("blocked"), false);
  });

  for (const [name, path] of [
    ["dot segments", "/uploads/x/../colorings/secret.webp"],
    ["encoded dot segments", "/uploads/x/%2e%2e/colorings/secret.webp"],
    ["duplicate separators", "/uploads//colorings/secret.webp"],
    ["case-insensitive mount", "/UPLOADS/colorings/secret.webp"],
  ] as const) {
    it(`blocks coloring uploads reached through ${name}`, async () => {
      const response = await getRawPath(baseUrl, path);

      assert.equal(response.statusCode, 404);
      assert.equal(response.headers["cache-control"], "no-store");
      assert.equal(response.body.includes(Buffer.from("blocked")), false);
    });
  }

  for (const path of [
    "/uploads/x/../other.txt",
    "/uploads//other.txt",
    "/UPLOADS/other.txt",
  ]) {
    it(`retains unrelated upload ${path}`, async () => {
      const response = await getRawPath(baseUrl, path);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.toString(), "allowed-upload");
    });
  }

  it("blocks coloring uploads in an absolute-form request target", async () => {
    const response = await getRawPath(
      baseUrl,
      "http://example.test/uploads/colorings/secret.webp",
    );

    assert.equal(response.statusCode, 404);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.body.includes(Buffer.from("blocked")), false);
  });

  it("retains unrelated uploads in an absolute-form request target", async () => {
    const response = await getRawPath(
      baseUrl,
      "http://example.test/uploads/other.txt",
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.toString(), "allowed-upload");
  });

  it("generates anonymous public schemas and response contracts", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const schemas = document.components?.schemas ?? {};
    assert.ok(schemas.PublicColoringDTO);
    assert.ok(schemas.PublicColoringManifestItemDTO);

    for (const path of [
      "/colorings",
      "/colorings/{collectionSlug}/{number}",
      "/colorings/{collectionSlug}/{number}/assets/{revisionId}/{kind}/content",
    ]) {
      assert.equal(document.paths[path]?.get?.security, undefined, path);
    }

    const listResponses = document.paths["/colorings"]?.get?.responses;
    const detailResponses =
      document.paths["/colorings/{collectionSlug}/{number}"]?.get?.responses;
    const assetOperation =
      document.paths[
        "/colorings/{collectionSlug}/{number}/assets/{revisionId}/{kind}/content"
      ]?.get;
    for (const responses of [listResponses, detailResponses]) {
      for (const status of ["200", "304", "404", "503"]) {
        assert.ok(responses?.[status], `JSON response ${status} is missing`);
      }
    }
    for (const status of ["200", "304", "404", "503"]) {
      assert.ok(
        assetOperation?.responses?.[status],
        `asset response ${status} is missing`,
      );
    }

    const kind = assetOperation?.parameters?.find(
      (parameter) => "name" in parameter && parameter.name === "kind",
    );
    assert.deepEqual(
      kind && "schema" in kind
        ? (kind.schema as { enum?: string[] }).enum
        : undefined,
      ["outline", "colored", "card"],
    );
    const ok = assetOperation?.responses?.["200"] as {
      content?: Record<string, { schema?: unknown }>;
    };
    assert.deepEqual(ok.content?.["image/webp"]?.schema, {
      type: "string",
      format: "binary",
    });
  });
});

function getRawPath(baseUrl: string, path: string) {
  const url = new URL(baseUrl);

  return new Promise<{
    statusCode: number | undefined;
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
  }>((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        method: "GET",
        path,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}
