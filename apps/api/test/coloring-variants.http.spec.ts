import "reflect-metadata";
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
import { AuthGuard } from "../src/auth/auth.guard";
import { AuthService } from "../src/auth/auth.service";
import { AdminColoringsGuard } from "../src/colorings/admin-colorings.guard";
import { AdminColoringVariantsController } from "../src/colorings/coloring-variants.controller";
import {
  ColoringVariantsService,
  type VariantUploadFiles,
} from "../src/colorings/coloring-variants.service";
import {
  PublishColoringVariantDTO,
  SaveColoringVariantDTO,
  VariantPaletteInputDTO,
} from "../src/colorings/dto/coloring-variant.dto";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { UsersService } from "../src/users/users.service";

const calls: Array<{
  coloringId: string;
  input: SaveColoringVariantDTO;
  files: VariantUploadFiles;
}> = [];
const publications: Array<{
  coloringId: string;
  target: string;
  input: PublishColoringVariantDTO;
  actorId: string;
}> = [];
const response = {
  coloringId: "coloring-1",
  token: "new",
  width: null,
  height: null,
  original: null,
  variants: [],
};
@Module({
  controllers: [AdminColoringVariantsController],
  providers: [
    AuthGuard,
    AdminColoringsGuard,
    CsrfMiddleware,
    {
      provide: AuthService,
      useValue: {
        getTokenFromRequest: (authorization?: string) =>
          authorization?.replace(/^Bearer\s+/i, ""),
        verifyAccessToken: async (token: string) => ({
          id: "user-1",
          roles: token === "customer" ? ["customer"] : ["admin"],
        }),
      },
    },
    {
      provide: UsersService,
      useValue: {
        assertRole: (user: { roles?: string[] } | undefined, role: string) => {
          if (!user?.roles?.includes(role))
            throw new ForbiddenException("Admin role required");
        },
      },
    },
    {
      provide: ColoringVariantsService,
      useValue: {
        get: async () => response,
        asset: async () => Buffer.from("protected-webp"),
        publish: async (
          coloringId: string,
          target: string,
          input: PublishColoringVariantDTO,
          actorId: string,
        ) => {
          publications.push({ coloringId, target, input, actorId });
          return response;
        },
        save: async (
          coloringId: string,
          input: SaveColoringVariantDTO,
          files: VariantUploadFiles | undefined,
        ) => {
          if (files?.outline?.length !== 1 || files?.colored?.length !== 1)
            throw new BadRequestException("Images required");
          calls.push({ coloringId, input, files });
          return response;
        },
      },
    },
  ],
})
class TestVariantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes("*");
  }
}

function form(
  palette = JSON.stringify([
    { symbolPosition: 1, hex: "#AABBCC" },
    { symbolPosition: 7, hex: "#DDEEFF" },
  ]),
) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    target: "original",
    expectedToken: "new",
    outlineAlt: "  Контуры  ",
    imageAlt: "Цветная картинка",
    palette,
  }))
    data.set(key, value);
  data.append(
    "outline",
    new Blob(["outline"], { type: "image/png" }),
    "outline.png",
  );
  data.append(
    "colored",
    new Blob(["colored"], { type: "image/png" }),
    "colored.png",
  );
  return data;
}

describe("Admin coloring variants HTTP contract", () => {
  let app: INestApplication;
  let url: string;
  before(async () => {
    app = await NestFactory.create(TestVariantsModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    url = `${await app.getUrl()}/admin/colorings/coloring-1/variants`;
  });
  after(async () => {
    await app.close();
  });
  const headers = { authorization: "Bearer admin", "x-artmate-csrf": "1" };

  it("publishes the exact target with a validated token and authenticated actor", async () => {
    const result = await fetch(`${url}/original/publish`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ expectedToken: "current-token" }),
    });
    assert.equal(result.status, 200, await result.text());
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    const call = publications.at(-1)!;
    assert.equal(call.coloringId, "coloring-1");
    assert.equal(call.target, "original");
    assert.equal(call.actorId, "user-1");
    assert.ok(call.input instanceof PublishColoringVariantDTO);
    assert.equal(call.input.expectedToken, "current-token");
  });

  it("rejects missing tokens and unknown publication fields", async () => {
    for (const input of [
      {},
      { expectedToken: "" },
      { expectedToken: "new", actorId: "other" },
    ]) {
      const count = publications.length;
      const result = await fetch(`${url}/original/publish`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      assert.equal(result.status, 400, await result.text());
      assert.equal(publications.length, count);
    }
  });

  it("protects publication with authentication, admin role and CSRF", async () => {
    for (const [requestHeaders, status] of [
      [{ "x-artmate-csrf": "1" }, 401],
      [{ authorization: "Bearer customer", "x-artmate-csrf": "1" }, 403],
      [{ authorization: "Bearer admin" }, 403],
    ] as Array<[Record<string, string>, number]>) {
      const count = publications.length;
      const result = await fetch(`${url}/original/publish`, {
        method: "POST",
        headers: { ...requestHeaders, "content-type": "application/json" },
        body: JSON.stringify({ expectedToken: "new" }),
      });
      assert.equal(result.status, status, await result.text());
      assert.equal(publications.length, count);
    }
  });

  it("accepts multipart JSON palette as validated nested DTOs and returns 200", async () => {
    const beforeCalls = calls.length;
    const result = await fetch(url, { method: "POST", headers, body: form() });
    assert.equal(result.status, 200, await result.text());
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    assert.equal(calls.length, beforeCalls + 1);
    const call = calls.at(-1)!;
    assert.equal(call.coloringId, "coloring-1");
    assert.ok(call.input instanceof SaveColoringVariantDTO);
    assert.ok(
      call.input.palette.every((row) => row instanceof VariantPaletteInputDTO),
    );
    assert.deepEqual(
      call.input.palette.map((row) => row.symbolPosition),
      [1, 7],
    );
    assert.equal(call.input.outlineAlt, "Контуры");
    assert.equal(call.files.outline![0]!.buffer.toString(), "outline");
  });

  for (const [title, palette] of [
    ["malformed JSON", "{broken"],
    [
      "duplicate symbols",
      '[{"symbolPosition":1,"hex":"#AABBCC"},{"symbolPosition":1,"hex":"#FFFFFF"}]',
    ],
    [
      "unknown nested fields",
      '[{"symbolPosition":1,"hex":"#AABBCC","unexpected":"value"}]',
    ],
    ["out-of-range symbols", '[{"symbolPosition":20,"hex":"#AABBCC"}]'],
  ]) {
    it(`rejects ${title} before calling the service`, async () => {
      const beforeCalls = calls.length;
      const result = await fetch(url, {
        method: "POST",
        headers,
        body: form(palette),
      });
      assert.equal(result.status, 400, await result.text());
      assert.equal(calls.length, beforeCalls);
    });
  }

  it("rejects unknown fields, unexpected files and duplicate file parts", async () => {
    const extraField = form();
    extraField.set("unexpected", "value");
    const extraFile = form();
    extraFile.delete("colored");
    extraFile.append("source", new Blob(["file"]), "source.png");
    const duplicateFile = form();
    duplicateFile.append("outline", new Blob(["file"]), "second.png");
    for (const body of [extraField, extraFile, duplicateFile]) {
      const beforeCalls = calls.length;
      const result = await fetch(url, { method: "POST", headers, body });
      assert.equal(result.status, 400, await result.text());
      assert.equal(calls.length, beforeCalls);
    }
  });

  it("requires authentication, the admin role and the CSRF header", async () => {
    for (const [requestHeaders, status] of [
      [{ "x-artmate-csrf": "1" }, 401],
      [{ authorization: "Bearer customer", "x-artmate-csrf": "1" }, 403],
      [{ authorization: "Bearer admin" }, 403],
    ] as Array<[Record<string, string>, number]>) {
      const beforeCalls = calls.length;
      const result = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: form(),
      });
      assert.equal(result.status, status, await result.text());
      assert.equal(calls.length, beforeCalls);
    }
  });

  it("serves assets only to admins with private cache headers", async () => {
    const path = `${url}/assets/original/card/content`;
    assert.equal((await fetch(path)).status, 401);
    assert.equal(
      (await fetch(path, { headers: { authorization: "Bearer customer" } }))
        .status,
      403,
    );
    const result = await fetch(path, { headers });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("content-type"), "image/webp");
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    assert.equal(await result.text(), "protected-webp");
  });
});
