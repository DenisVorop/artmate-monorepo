import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  BadRequestException,
  ForbiddenException,
  type INestApplication,
  MiddlewareConsumer,
  Module,
  type NestModule,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AuthGuard } from "../src/auth/auth.guard";
import { AuthService } from "../src/auth/auth.service";
import { AdminColoringsGuard } from "../src/colorings/admin-colorings.guard";
import { ColoringRevisionsService } from "../src/colorings/coloring-revisions.service";
import { AdminColoringsController } from "../src/colorings/colorings.controller";
import { ColoringsService } from "../src/colorings/colorings.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { UsersService } from "../src/users/users.service";

const authService = {
  getTokenFromRequest: (authorization?: string) =>
    authorization?.replace(/^Bearer\s+/i, ""),
  verifyAccessToken: async (token: string) => ({
    id: token === "customer-token" ? "customer-1" : "admin-1",
    roles: token === "customer-token" ? ["customer"] : ["admin"],
  }),
};
const usersService = {
  assertRole: (user: { roles?: string[] } | undefined, role: string) => {
    if (!user?.roles?.includes(role)) {
      throw new ForbiddenException("Admin role required");
    }
  },
};
let createRevisionCalls = 0;
const updateColoringCalls: unknown[] = [];
const coloringsService = {
  updateColoring: async (coloringId: string, input: unknown) => {
    updateColoringCalls.push({
      coloringId,
      input: { ...(input as Record<string, unknown>) },
    });
    return createColoringResponse();
  },
};
const revisionsService = {
  createRevision: async (
    coloringId: string,
    body: { markerColorIds: string[] },
    files: { outline?: unknown[]; colored?: unknown[] } | undefined,
    createdById: string,
  ) => {
    if (files?.outline?.length !== 1 || files?.colored?.length !== 1) {
      throw new BadRequestException(
        "Exactly one outline and colored file is required",
      );
    }

    createRevisionCalls += 1;
    assert.equal(coloringId, "coloring-1");
    assert.deepEqual(body.markerColorIds, [
      "marker-color-104",
      "marker-color-001",
    ]);
    assert.equal(files?.outline?.length, 1);
    assert.equal(files?.colored?.length, 1);
    assert.equal(createdById, "admin-1");

    return createRevisionResponse();
  },
  getRevisionAsset: async () => Buffer.from("webp-asset"),
};

@Module({
  controllers: [AdminColoringsController],
  providers: [
    AuthGuard,
    AdminColoringsGuard,
    CsrfMiddleware,
    { provide: AuthService, useValue: authService },
    { provide: UsersService, useValue: usersService },
    { provide: ColoringsService, useValue: coloringsService },
    { provide: ColoringRevisionsService, useValue: revisionsService },
  ],
})
class TestColoringsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes("*");
  }
}

describe("Admin colorings HTTP contract", () => {
  let app: INestApplication;
  let baseUrl: string;

  before(async () => {
    app = await NestFactory.create(TestColoringsModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it("returns 400 instead of 500 for a non-multipart revision request", async () => {
    const response = await fetch(
      `${baseUrl}/admin/colorings/coloring-1/revisions`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
          "x-artmate-csrf": "1",
        },
        body: JSON.stringify({
          markerColorIds: ["marker-color-104"],
          outlineAlt: "Outline",
          coloredAlt: "Colored",
        }),
      },
    );

    assert.equal(response.status, 400);
  });

  it("returns 400 when one required file is missing", async () => {
    const form = createRevisionForm();
    form.append(
      "outline",
      new Blob(["outline"], { type: "image/png" }),
      "outline.png",
    );

    const response = await postRevision(form);

    assert.equal(response.status, 400);
  });

  it("returns 400 for an unexpected file field", async () => {
    const form = createRevisionForm();
    form.append(
      "outline",
      new Blob(["outline"], { type: "image/png" }),
      "outline.png",
    );
    form.append(
      "colored",
      new Blob(["colored"], { type: "image/png" }),
      "colored.png",
    );
    form.append(
      "other",
      new Blob(["other"], { type: "image/png" }),
      "other.png",
    );

    const response = await postRevision(form);

    assert.equal(response.status, 400);
  });

  it("accepts exactly two files and three metadata fields", async () => {
    const callsBefore = createRevisionCalls;
    const form = createRevisionForm();
    form.append(
      "outline",
      new Blob(["outline"], { type: "image/png" }),
      "outline.png",
    );
    form.append(
      "colored",
      new Blob(["colored"], { type: "image/png" }),
      "colored.png",
    );

    const response = await postRevision(form);

    assert.equal(response.status, 201);
    assert.equal(createRevisionCalls, callsBefore + 1);
    assert.deepEqual(await response.json(), createRevisionResponse());
  });

  it("rejects unauthenticated uploads before multipart parsing", async () => {
    const response = await fetch(
      `${baseUrl}/admin/colorings/coloring-1/revisions`,
      {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=broken",
          "x-artmate-csrf": "1",
        },
        body: "not-a-valid-multipart-body",
      },
    );

    assert.equal(response.status, 401);
  });

  it("rejects non-admin uploads before multipart parsing", async () => {
    const response = await fetch(
      `${baseUrl}/admin/colorings/coloring-1/revisions`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer customer-token",
          "content-type": "multipart/form-data; boundary=broken",
          "x-artmate-csrf": "1",
        },
        body: "not-a-valid-multipart-body",
      },
    );

    assert.equal(response.status, 403);
  });

  it("rejects missing CSRF before multipart parsing", async () => {
    const response = await fetch(
      `${baseUrl}/admin/colorings/coloring-1/revisions`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "multipart/form-data; boundary=broken",
        },
        body: "not-a-valid-multipart-body",
      },
    );

    assert.equal(response.status, 403);
  });

  it("returns 413 when a file exceeds 20 MiB", async () => {
    const form = createRevisionForm();
    form.append(
      "outline",
      new Blob([Buffer.alloc(20 * 1024 * 1024 + 1)], { type: "image/png" }),
      "outline.png",
    );
    form.append(
      "colored",
      new Blob(["colored"], { type: "image/png" }),
      "colored.png",
    );

    const response = await postRevision(form);

    assert.equal(response.status, 413);
  });

  it("serves protected assets as non-cacheable WebP", async () => {
    const response = await fetch(
      `${baseUrl}/admin/colorings/coloring-1/revisions/revision-1/assets/outline/content`,
      { headers: { authorization: "Bearer test-token" } },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      Buffer.from("webp-asset"),
    );
  });

  it("requires and forwards the coloring metadata CAS token", async () => {
    const url = `${baseUrl}/admin/colorings/coloring-1`;
    const headers = {
      authorization: "Bearer test-token",
      "content-type": "application/json",
      "x-artmate-csrf": "1",
    };
    const callsBefore = updateColoringCalls.length;
    const missingToken = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "Новый лес" }),
    });
    const update = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        title: "Новый лес",
        updatedAt: "2026-08-28T10:00:00.000Z",
      }),
    });

    assert.equal(missingToken.status, 400);
    assert.equal(update.status, 200);
    assert.equal(updateColoringCalls.length, callsBefore + 1);
    assert.deepEqual(updateColoringCalls.at(-1), {
      coloringId: "coloring-1",
      input: {
        number: undefined,
        title: "Новый лес",
        updatedAt: "2026-08-28T10:00:00.000Z",
      },
    });
    assert.deepEqual(await update.json(), createColoringResponse());
  });

  it("generates the complete authenticated Coloring OpenAPI contract", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const schemas = document.components?.schemas ?? {};
    const expectedSchemaProperties: Record<string, string[]> = {
      ColoringDTO: [
        "id",
        "collectionId",
        "number",
        "title",
        "description",
        "position",
        "status",
        "publishedRevisionId",
        "publishedAt",
        "collection",
        "themes",
        "createdAt",
        "updatedAt",
      ],
      ColoringCollectionProductReferenceDTO: ["id", "slug", "title"],
      ColoringCollectionReferenceDTO: ["id", "slug", "title", "product"],
      ColoringRevisionAssetDTO: [
        "sourceMime",
        "sourceChecksum",
        "mimeType",
        "byteSize",
        "checksum",
        "alt",
        "previewUrl",
        "publicUrl",
      ],
      ColoringRevisionDTO: [
        "id",
        "coloringId",
        "version",
        "status",
        "paletteLabel",
        "paletteVersion",
        "usedColorCount",
        "paletteColors",
        "width",
        "height",
        "derivativeProfile",
        "colorSpace",
        "outline",
        "colored",
        "review",
        "createdById",
        "createdAt",
      ],
      ColoringRevisionReviewDTO: [
        "decision",
        "comment",
        "reviewedById",
        "reviewedAt",
      ],
      ColoringRevisionPaletteColorDTO: [
        "markerColorId",
        "symbolPosition",
        "symbol",
        "colorNumber",
        "pantone",
        "hex",
        "markerNumber",
      ],
      ColoringThemeDTO: ["id", "slug", "title"],
      CreateColoringRequestDTO: [
        "collectionId",
        "title",
        "description",
        "position",
        "themeTagIds",
      ],
      CreateColoringRevisionRequestDTO: [
        "markerColorIds",
        "outlineAlt",
        "coloredAlt",
      ],
      ReviewColoringRevisionRequestDTO: ["decision", "comment"],
      UpdateColoringRequestDTO: [
        "collectionId",
        "title",
        "description",
        "position",
        "themeTagIds",
        "number",
        "updatedAt",
      ],
    };

    for (const [schemaName, properties] of Object.entries(
      expectedSchemaProperties,
    )) {
      const schema = schemas[schemaName] as {
        properties?: Record<string, unknown>;
      };

      assert.ok(schema, `${schemaName} schema is missing`);
      assert.deepEqual(Object.keys(schema.properties ?? {}), properties);
    }

    const updateSchema = schemas.UpdateColoringRequestDTO as {
      required?: string[];
    };
    assert.deepEqual(updateSchema.required, ["updatedAt"]);

    for (const [path, method] of [
      ["/admin/colorings", "get"],
      ["/admin/colorings", "post"],
      ["/admin/colorings/{id}", "get"],
      ["/admin/colorings/{id}", "patch"],
      ["/admin/colorings/{coloringId}/revisions", "get"],
      ["/admin/colorings/{coloringId}/revisions", "post"],
      [
        "/admin/colorings/{coloringId}/revisions/{revisionId}/assets/{kind}/content",
        "get",
      ],
      ["/admin/colorings/{coloringId}/revisions/{revisionId}/review", "post"],
      ["/admin/colorings/{coloringId}/revisions/{revisionId}/publish", "post"],
    ] as const) {
      const operation = document.paths[path]?.[method];

      assert.deepEqual(operation?.security, [{ bearer: [] }]);
    }

    for (const [path, method] of [
      ["/admin/colorings", "post"],
      ["/admin/colorings/{id}", "patch"],
      ["/admin/colorings/{coloringId}/revisions", "post"],
      ["/admin/colorings/{coloringId}/revisions/{revisionId}/review", "post"],
      ["/admin/colorings/{coloringId}/revisions/{revisionId}/publish", "post"],
    ] as const) {
      const parameters = document.paths[path]?.[method]?.parameters ?? [];
      const csrfHeader = parameters.find(
        (parameter) =>
          "name" in parameter && parameter.name === "x-artmate-csrf",
      );

      assert.ok(csrfHeader && "required" in csrfHeader && csrfHeader.required);
      assert.equal(
        "schema" in csrfHeader
          ? (csrfHeader.schema as { default?: string }).default
          : undefined,
        "1",
      );
    }

    const assetOperation =
      document.paths[
        "/admin/colorings/{coloringId}/revisions/{revisionId}/assets/{kind}/content"
      ]?.get;
    const kindParameter = assetOperation?.parameters?.find(
      (parameter) => "name" in parameter && parameter.name === "kind",
    );
    const assetResponse = assetOperation?.responses?.["200"] as {
      content?: Record<string, { schema?: { format?: string; type?: string } }>;
    };

    const kindSchema =
      kindParameter && "schema" in kindParameter
        ? (kindParameter.schema as { enum?: string[] })
        : undefined;

    assert.deepEqual(kindSchema?.enum, ["outline", "colored"]);
    assert.deepEqual(assetResponse.content?.["image/webp"]?.schema, {
      type: "string",
      format: "binary",
    });

    for (const [path, method, statusCodes] of [
      ["/admin/colorings/{id}", "patch", ["409"]],
      ["/admin/colorings/{coloringId}/revisions", "get", ["404"]],
      [
        "/admin/colorings/{coloringId}/revisions/{revisionId}/assets/{kind}/content",
        "get",
        ["400", "404"],
      ],
      [
        "/admin/colorings/{coloringId}/revisions/{revisionId}/review",
        "post",
        ["400", "404", "409"],
      ],
      [
        "/admin/colorings/{coloringId}/revisions/{revisionId}/publish",
        "post",
        ["400", "404", "409"],
      ],
    ] as const) {
      const responses = document.paths[path]?.[method]?.responses;

      for (const statusCode of statusCodes) {
        assert.ok(
          responses?.[statusCode],
          `${method.toUpperCase()} ${path} is missing ${statusCode}`,
        );
      }
    }
  });

  function postRevision(form: FormData) {
    return fetch(`${baseUrl}/admin/colorings/coloring-1/revisions`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "x-artmate-csrf": "1",
      },
      body: form,
    });
  }
});

function createRevisionForm() {
  const form = new FormData();

  form.set(
    "markerColorIds",
    JSON.stringify(["marker-color-104", "marker-color-001"]),
  );
  form.set("outlineAlt", "Outline");
  form.set("coloredAlt", "Colored");

  return form;
}

function createRevisionResponse() {
  const asset = {
    sourceMime: "image/png",
    sourceChecksum: "a".repeat(64),
    mimeType: "image/webp",
    byteSize: 1024,
    checksum: "b".repeat(64),
    alt: "Контур",
    previewUrl:
      "/admin/colorings/coloring-1/revisions/revision-1/assets/outline/content",
  };

  return {
    id: "a".repeat(32),
    coloringId: "coloring-1",
    version: 1,
    status: "review_required",
    paletteLabel: "Artmate 168",
    paletteVersion: "2026-08",
    usedColorCount: 2,
    paletteColors: [
      {
        markerColorId: "marker-color-104",
        symbolPosition: 1,
        symbol: "1",
        colorNumber: 104,
        pantone: "11-0601TCX",
        hex: "#F4F9FF",
        markerNumber: "006",
      },
      {
        markerColorId: "marker-color-001",
        symbolPosition: 2,
        symbol: "2",
        colorNumber: 1,
        pantone: "11-0601 TPG",
        hex: "#F5F7F6",
        markerNumber: "600",
      },
    ],
    width: 1400,
    height: 920,
    derivativeProfile: "webp-preview-v1",
    colorSpace: "srgb",
    outline: asset,
    colored: {
      ...asset,
      checksum: "c".repeat(64),
      alt: "Цветная версия",
      previewUrl:
        "/admin/colorings/coloring-1/revisions/revision-1/assets/colored/content",
    },
    createdById: "admin-1",
    createdAt: "2026-08-28T10:00:00.000Z",
  };
}

function createColoringResponse() {
  return {
    id: "coloring-1",
    collectionId: "collection-1",
    number: 1,
    title: "Новый лес",
    description: "Сюжет с лесными животными",
    position: 0,
    status: "draft",
    collection: {
      id: "collection-1",
      slug: "mysterious-forest",
      title: "Загадочный лес",
      product: {
        id: "product-1",
        slug: "album-1",
        title: "Альбом 1",
      },
    },
    themes: [{ id: "theme-1", slug: "forest", title: "Лес" }],
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:01.000Z",
  };
}
