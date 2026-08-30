import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
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
import { AdminColoringCollectionsController } from "../src/colorings/coloring-collections.controller";
import { ColoringCollectionCoverService } from "../src/colorings/coloring-collection-cover.service";
import { ColoringCollectionsService } from "../src/colorings/coloring-collections.service";
import { PublicColoringCollectionsController } from "../src/colorings/public-coloring-collections.controller";
import { PublicColoringCollectionsService } from "../src/colorings/public-coloring-collections.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { UsersService } from "../src/users/users.service";

const adminCollection = {
  id: "collection-1",
  productId: "product-1",
  slug: "mysterious-forest",
  title: "Загадочный лес",
  description: "25 сюжетов",
  position: 0,
  status: "draft",
  expectedColoringCount: 25,
  cover: {
    url: "https://cdn.artmate.ru/collections/forest.webp",
    alt: "Обложка Загадочного леса",
    width: 1200,
    height: 800,
  },
  coloringCount: 1,
  publishedColoringCount: 1,
  product: {
    id: "product-1",
    slug: "album-1",
    title: "Альбом 1",
    status: "published",
  },
  createdAt: "2026-08-29T12:00:00.000Z",
  updatedAt: "2026-08-29T12:00:00.000Z",
};

const publicSummary = {
  id: "collection-1",
  slug: "mysterious-forest",
  title: "Загадочный лес",
  description: "25 сюжетов",
  coloringCount: 1,
  expectedColoringCount: 25,
  cover: adminCollection.cover,
  product: {
    id: "product-1",
    slug: "album-1",
    title: "Альбом 1",
    category: {
      id: "category-1",
      slug: "coloring-books",
      title: "Раскраски",
    },
  },
  lastModified: "2026-08-29T12:00:00.000Z",
};

const publicDetail = {
  ...publicSummary,
  colorings: [
    {
      id: "coloring-1",
      number: 1,
      title: "Лесной дракон",
      position: 0,
      publishedRevisionId: "revision-1",
      card: {
        url: `https://api.artmate.ru/colorings/mysterious-forest/01/assets/revision-1/card/content?v=${"c".repeat(64)}`,
        alt: "Лесной дракон в цвете",
        width: 480,
        height: 320,
      },
    },
  ],
};

const calls = {
  create: [] as unknown[],
  cover: [] as Array<{
    alt: string;
    collectionId: string;
    file: {
      mimetype: string;
      originalname: string;
      size: number;
    } | null;
    updatedAt: string;
  }>,
  update: [] as unknown[],
  publish: [] as string[],
};

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

const collectionsService = {
  getCollections: async () => [adminCollection],
  getCollection: async () => adminCollection,
  createCollection: async (input: unknown) => {
    calls.create.push(input);
    return adminCollection;
  },
  updateCollection: async (id: string, input: unknown) => {
    calls.update.push({ id, input: { ...(input as Record<string, unknown>) } });
    return { ...adminCollection, title: "Новый лес" };
  },
  publishCollection: async (id: string) => {
    calls.publish.push(id);
    return {
      ...adminCollection,
      status: "published",
      publishedAt: "2026-08-29T13:00:00.000Z",
    };
  },
};

const publicCollectionsService = {
  getCollections: async () => [publicSummary],
  getCollection: async () => publicDetail,
};

@Module({
  controllers: [
    AdminColoringCollectionsController,
    PublicColoringCollectionsController,
  ],
  providers: [
    AuthGuard,
    AdminColoringsGuard,
    CsrfMiddleware,
    { provide: AuthService, useValue: authService },
    { provide: UsersService, useValue: usersService },
    { provide: ColoringCollectionsService, useValue: collectionsService },
    {
      provide: ColoringCollectionCoverService,
      useValue: {
        uploadCover: async (
          collectionId: string,
          file:
            | {
                mimetype: string;
                originalname: string;
                size: number;
              }
            | undefined,
          alt: string,
          updatedAt: string,
        ) => {
          calls.cover.push({
            alt,
            collectionId,
            file: file
              ? {
                  mimetype: file.mimetype,
                  originalname: file.originalname,
                  size: file.size,
                }
              : null,
            updatedAt,
          });
        },
      },
    },
    {
      provide: PublicColoringCollectionsService,
      useValue: publicCollectionsService,
    },
  ],
})
class TestColoringCollectionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes("*");
  }
}

describe("Coloring collections HTTP contract", () => {
  let app: INestApplication;
  let baseUrl: string;

  before(async () => {
    app = await NestFactory.create(TestColoringCollectionsModule, {
      logger: false,
    });
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

  it("serves anonymous public list and detail with conditional caching", async () => {
    const list = await fetch(`${baseUrl}/coloring-collections`);
    const detail = await fetch(
      `${baseUrl}/coloring-collections/mysterious-forest`,
    );

    assert.equal(list.status, 200);
    assert.equal(detail.status, 200);
    assert.deepEqual(await list.json(), [publicSummary]);
    assert.deepEqual(await detail.json(), publicDetail);
    assert.match(list.headers.get("etag") ?? "", /^"[a-f0-9]{64}"$/);
    assert.equal(
      list.headers.get("cache-control"),
      "public, max-age=0, must-revalidate",
    );
  });

  it("protects admin endpoints with authentication, role and CSRF", async () => {
    const url = `${baseUrl}/admin/coloring-collections`;
    const body = JSON.stringify(createBody());

    const unauthenticated = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-artmate-csrf": "1" },
      body,
    });
    const customer = await fetch(url, {
      method: "POST",
      headers: {
        authorization: "Bearer customer-token",
        "content-type": "application/json",
        "x-artmate-csrf": "1",
      },
      body,
    });
    const missingCsrf = await fetch(url, {
      method: "POST",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json",
      },
      body,
    });

    assert.equal(unauthenticated.status, 401);
    assert.equal(customer.status, 403);
    assert.equal(missingCsrf.status, 403);
  });

  it("validates and forwards create, CAS update and publish", async () => {
    const authHeaders = {
      authorization: "Bearer admin-token",
      "content-type": "application/json",
      "x-artmate-csrf": "1",
    };
    const create = await fetch(`${baseUrl}/admin/coloring-collections`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(createBody()),
    });
    const invalidUpdate = await fetch(
      `${baseUrl}/admin/coloring-collections/collection-1`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ title: "Новый лес" }),
      },
    );
    const update = await fetch(
      `${baseUrl}/admin/coloring-collections/collection-1`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          title: "Новый лес",
          updatedAt: adminCollection.updatedAt,
        }),
      },
    );
    const publish = await fetch(
      `${baseUrl}/admin/coloring-collections/collection-1/publish`,
      { method: "POST", headers: authHeaders },
    );

    assert.equal(create.status, 201);
    assert.equal(invalidUpdate.status, 400);
    assert.equal(update.status, 200);
    assert.equal(publish.status, 200);
    assert.equal(calls.create.length, 1);
    assert.deepEqual(calls.update, [
      {
        id: "collection-1",
        input: {
          title: "Новый лес",
          updatedAt: adminCollection.updatedAt,
        },
      },
    ]);
    assert.deepEqual(calls.publish, ["collection-1"]);
  });

  it("validates and forwards a cover upload with its CAS token", async () => {
    const callsBefore = calls.cover.length;
    const form = createCoverForm();

    const response = await postCover(baseUrl, form);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), adminCollection);
    assert.deepEqual(calls.cover.slice(callsBefore), [
      {
        alt: "Обложка Загадочного леса",
        collectionId: "collection-1",
        file: {
          mimetype: "image/png",
          originalname: "cover.png",
          size: 5,
        },
        updatedAt: adminCollection.updatedAt,
      },
    ]);
  });

  it("rejects a cover upload without updatedAt before delegation", async () => {
    const callsBefore = calls.cover.length;
    const form = createCoverForm();
    form.delete("updatedAt");

    const response = await postCover(baseUrl, form);

    assert.equal(response.status, 400);
    assert.equal(calls.cover.length, callsBefore);
  });

  it("documents cover multipart CAS and conflict responses", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const operation =
      document.paths["/admin/coloring-collections/{id}/cover"]?.post;
    const requestBody = operation?.requestBody as
      | {
          content?: {
            "multipart/form-data"?: {
              schema?: { required?: string[] };
            };
          };
        }
      | undefined;

    assert.deepEqual(
      requestBody?.content?.["multipart/form-data"]?.schema?.required,
      ["cover", "alt", "updatedAt"],
    );
    assert.ok(operation?.responses?.["409"]);
  });
});

function createBody() {
  return {
    productId: "product-1",
    slug: "mysterious-forest",
    title: "Загадочный лес",
    description: "25 сюжетов",
    position: 0,
    expectedColoringCount: 25,
  };
}

function createCoverForm() {
  const form = new FormData();

  form.set("cover", new Blob(["cover"], { type: "image/png" }), "cover.png");
  form.set("alt", "Обложка Загадочного леса");
  form.set("updatedAt", adminCollection.updatedAt);

  return form;
}

function postCover(baseUrl: string, form: FormData) {
  return fetch(`${baseUrl}/admin/coloring-collections/collection-1/cover`, {
    method: "POST",
    headers: {
      authorization: "Bearer admin-token",
      "x-artmate-csrf": "1",
    },
    body: form,
  });
}
