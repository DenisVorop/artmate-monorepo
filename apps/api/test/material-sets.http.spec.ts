import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
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
import { UsersService } from "../src/users/users.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { AdminMaterialSetsController } from "../src/materials/material-sets.controller";
import { AdminMaterialsGuard } from "../src/materials/admin-materials.guard";
import { MaterialSetsService } from "../src/materials/material-sets.service";
import type {
  MaterialImportColorDTO,
  MaterialImportPreviewDTO,
} from "../src/materials/dto/material-import.dto";

type CreateData = {
  title: string;
  slug: string;
  brand: string;
  line: string | null;
  kind: string;
  colors: { createMany: { data: MaterialImportColorDTO[] } };
};
const records = new Map<
  string,
  Omit<CreateData, "colors"> & {
    id: string;
    isArchived: boolean;
    _count: { colors: number };
  }
>();
let writeCount = 0;
const prisma = {
  materialSet: {
    findUnique: async ({ where }: { where: { slug: string } }) =>
      records.get(where.slug) ?? null,
    findMany: async () => [...records.values()],
    create: async ({ data }: { data: CreateData }) => {
      if (records.has(data.slug))
        throw new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test",
        });
      writeCount++;
      const { colors, ...metadata } = data;
      const record = {
        ...metadata,
        id: "set-" + writeCount,
        isArchived: false,
        _count: { colors: colors.createMany.data.length },
      };
      records.set(record.slug, record);
      return record;
    },
  },
};

@Module({
  controllers: [AdminMaterialSetsController],
  providers: [
    AuthGuard,
    AdminMaterialsGuard,
    MaterialSetsService,
    {
      provide: AuthService,
      useValue: {
        getTokenFromRequest: (authorization?: string) =>
          authorization?.replace(/^Bearer\s+/i, ""),
        verifyAccessToken: async (token: string) => ({
          id: token,
          roles: token === "admin" ? ["admin"] : ["customer"],
        }),
      },
    },
    {
      provide: UsersService,
      useValue: {
        assertRole: (user: { roles: string[] }, role: string) => {
          if (!user.roles.includes(role))
            throw new ForbiddenException("Admin role required");
        },
      },
    },
    { provide: PrismaService, useValue: prisma },
  ],
})
class TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes("*");
  }
}

describe("Admin material set HTTP contract", () => {
  let app: INestApplication;
  let baseUrl: string;
  const input = {
    title: "Тестовый набор",
    slug: "test-set",
    brand: "Brand",
    kind: "MARKER",
    source: "code,hex,name\n040,#ff8844,Оранжевый\nB-12,#123456,Синий",
  };
  const headers = {
    authorization: "Bearer admin",
    "content-type": "application/json",
    "x-artmate-csrf": "1",
  };
  const post = (path: string, body: unknown, customHeaders: Record<string, string> = headers) =>
    fetch(baseUrl + "/admin/material-sets" + path, {
      method: "POST",
      headers: customHeaders,
      body: JSON.stringify(body),
    });
  before(async () => {
    app = await NestFactory.create(TestModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });
  beforeEach(() => {
    records.clear();
    writeCount = 0;
  });
  after(async () => {
    await app.close();
  });

  it("requires admin authentication for both reads and imports", async () => {
    assert.equal((await fetch(baseUrl + "/admin/material-sets")).status, 401);
    assert.equal(
      (
        await fetch(baseUrl + "/admin/material-sets", {
          headers: { authorization: "Bearer customer" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post("/import/preview", input, {
          ...headers,
          authorization: "Bearer customer",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post(
          "/import",
          { ...input, confirmationHash: "a".repeat(64) },
          { ...headers, authorization: "Bearer customer" },
        )
      ).status,
      403,
    );
    assert.equal(writeCount, 0);
  });
  it("requires CSRF protection even for preview POST", async () => {
    const noCsrf = {
      authorization: "Bearer admin",
      "content-type": "application/json",
    };
    for (const path of ["/import/preview", "/import"])
      assert.equal((await post(path, input, noCsrf)).status, 403);
    assert.equal(writeCount, 0);
  });
  it("validates metadata and does not allow client-supplied color rows or database IDs", async () => {
    for (const change of [
      { title: "  " },
      { kind: "WRONG" },
      { slug: "UpperCase" },
      { source: 12 },
      { colors: [] },
      { id: "existing" },
    ]) {
      assert.equal(
        (await post("/import/preview", { ...input, ...change })).status,
        400,
      );
    }
    assert.equal((await post("/import", input)).status, 400);
    assert.equal(writeCount, 0);
  });
  it("previews without writes, creates only after confirmation, and lists the result", async () => {
    const response = await post("/import/preview", input);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const preview = (await response.json()) as MaterialImportPreviewDTO;
    assert.equal(preview.canImport, true);
    assert.equal(preview.colors[0]?.code, "040");
    assert.equal(preview.colors[0]?.hex, "#FF8844");
    assert.equal(writeCount, 0);
    const imported = await post("/import", {
      ...input,
      confirmationHash: preview.confirmationHash,
    });
    assert.equal(imported.status, 201);
    const summary = await imported.json() as { colorCount: number; line: string | null };
    assert.equal(summary.colorCount, 2);
    assert.equal(summary.line, null);
    assert.equal("_count" in summary, false);
    const list = await fetch(baseUrl + "/admin/material-sets", { headers });
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), [summary]);
  });
  it("reports row errors and warnings in a response that cannot partially import", async () => {
    const invalid = {
      ...input,
      source: "code,hex\n040,#123456\n041,#123456\n040,#ABCDEF\n042,wrong",
    };
    const response = await post("/import/preview", invalid);
    assert.equal(response.status, 200);
    const preview = (await response.json()) as MaterialImportPreviewDTO;
    assert.equal(preview.canImport, false);
    assert.ok(
      preview.issues.some(
        (issue) => issue.row === 3 && issue.severity === "warning",
      ),
    );
    assert.ok(
      preview.issues.some(
        (issue) => issue.row === 4 && issue.severity === "error",
      ),
    );
    assert.equal(
      (
        await post("/import", {
          ...invalid,
          confirmationHash: preview.confirmationHash,
        })
      ).status,
      400,
    );
    assert.equal(writeCount, 0);
  });
  it("rejects stale confirmation and repeated/concurrent imports without overwrites", async () => {
    const preview = (await (
      await post("/import/preview", input)
    ).json()) as MaterialImportPreviewDTO;
    assert.equal(
      (
        await post("/import", {
          ...input,
          title: "Changed",
          confirmationHash: preview.confirmationHash,
        })
      ).status,
      400,
    );
    const body = { ...input, confirmationHash: preview.confirmationHash };
    const results = await Promise.all([
      post("/import", body),
      post("/import", body),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    assert.equal(writeCount, 1);
    assert.equal((await post("/import", body)).status, 409);
    const repeated = (await (
      await post("/import/preview", input)
    ).json()) as MaterialImportPreviewDTO;
    assert.equal(repeated.canImport, false);
    assert.equal(repeated.issues[0]?.field, "slug");
  });
  it("rejects oversize UTF-8 CSV before writing", async () => {
    const preview = (await (
      await post("/import/preview", { ...input, source: "я".repeat(25001) })
    ).json()) as MaterialImportPreviewDTO;
    assert.equal(preview.canImport, false);
    assert.match(preview.issues[0]!.message, /50 КБ/);
    assert.equal(writeCount, 0);
  });
  it("publishes explicit OpenAPI request and response contracts", () => {
    const spec = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    assert.ok(spec.paths["/admin/material-sets/import/preview"]?.post);
    assert.ok(spec.components?.schemas?.ImportMaterialSetRequestDTO);
    assert.ok(spec.components?.schemas?.MaterialImportColorDTO);
  });
});
