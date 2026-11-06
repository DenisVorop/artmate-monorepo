import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  type INestApplication,
  MiddlewareConsumer,
  Module,
  type NestModule,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AuthGuard } from "../src/auth/auth.guard";
import { AuthService } from "../src/auth/auth.service";
import { blogLikeSubjects } from "../src/blog/contracts/like-subjects.contract";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { likeSubjectPublications } from "../src/likes/contracts";
import { LikesController } from "../src/likes/likes.controller";
import { LikesService } from "../src/likes/likes.service";
import { OptionalLikeAuthGuard } from "../src/likes/optional-auth.guard";
import { LikeSubjectRegistry } from "../src/likes/subject-registry";
import { PrismaService } from "../src/prisma/prisma.service";
import { workshopLikeSubjects } from "../src/workshops/contracts/like-subjects.contract";
import { createLikesDatabase } from "./helpers/likes-database";

let database: Awaited<ReturnType<typeof createLikesDatabase>>;
@Module({
  controllers: [LikesController],
  providers: [
    LikesService,
    LikeSubjectRegistry,
    OptionalLikeAuthGuard,
    AuthGuard,
    {
      provide: likeSubjectPublications,
      useValue: [workshopLikeSubjects, blogLikeSubjects],
    },
    { provide: PrismaService, useFactory: () => database.prisma },
    {
      provide: AuthService,
      useValue: {
        getTokenFromRequest: (authorization?: string, cookie?: string) =>
          authorization?.replace(/^Bearer\s+/i, "") ??
          cookie?.match(/artmate_access_token=([^;]+)/)?.[1],
        verifyAccessToken: async (token: string) => {
          if (token === "expired")
            throw new UnauthorizedException("Invalid access token");
          return { id: token, roles: ["customer"] };
        },
      },
    },
  ],
})
class TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes("*");
  }
}

describe("Universal likes HTTP contract", () => {
  let app: INestApplication;
  let baseUrl: string;
  const headers = { "content-type": "application/json", "x-artmate-csrf": "1" };
  const work = { subjectType: "community-work", subjectId: "public-work" };
  const batch = (body: unknown, actor?: string) =>
    fetch(baseUrl + "/likes/batch", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        ...headers,
        ...(actor ? { authorization: `Bearer ${actor}` } : {}),
      },
    });
  const write = (
    method: "PUT" | "DELETE",
    actor = "alice",
    body?: unknown,
    path = "/likes/community-work/public-work/me",
  ) =>
    fetch(baseUrl + path, {
      method,
      headers: { ...headers, authorization: `Bearer ${actor}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  before(async () => {
    database = await createLikesDatabase();
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
  beforeEach(async () => database.reset());
  after(async () => {
    await app?.close();
    await database?.db.close();
  });

  it("allows guest counts and isolates authenticated state with private/no-store responses", async () => {
    const added = await write("PUT");
    assert.equal(added.status, 200);
    assert.equal(added.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await added.json(), {
      ...work,
      count: 1,
      viewerHasLiked: true,
      canLike: true,
    });
    const guest = await batch({ subjects: [work] });
    assert.equal(guest.status, 200);
    assert.equal(guest.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await guest.json(), {
      items: [{ ...work, count: 1, viewerHasLiked: false, canLike: false }],
    });
    const bob = await batch({ subjects: [work] }, "bob");
    assert.deepEqual(await bob.json(), {
      items: [{ ...work, count: 1, viewerHasLiked: false, canLike: true }],
    });
  });

  it("requires authentication, checks active accounts and accepts the existing auth cookie", async () => {
    for (const method of ["PUT", "DELETE"]) {
      const response = await fetch(
        baseUrl + "/likes/community-work/public-work/me",
        { method, headers },
      );
      assert.equal(response.status, 401);
    }
    for (const actor of ["expired", "blocked", "deleted", "absent"]) {
      assert.equal((await write("PUT", actor)).status, 401);
      assert.equal((await batch({ subjects: [work] }, actor)).status, 401);
    }
    const cookie = await fetch(
      baseUrl + "/likes/community-work/public-work/me",
      {
        method: "PUT",
        headers: { ...headers, cookie: "artmate_access_token=alice" },
      },
    );
    assert.equal(cookie.status, 200);
    assert.equal((await write("PUT", "author")).status, 403);
  });

  it("enforces CSRF for every endpoint and does not accept injected actor IDs or payloads", async () => {
    for (const [method, path, body] of [
      ["POST", "/likes/batch", { subjects: [work] }],
      ["PUT", "/likes/community-work/public-work/me", {}],
      ["DELETE", "/likes/community-work/public-work/me", {}],
    ] as const) {
      assert.equal(
        (
          await fetch(baseUrl + path, {
            method,
            headers: {
              "content-type": "application/json",
              authorization: "Bearer alice",
            },
            body: JSON.stringify(body),
          })
        ).status,
        403,
      );
    }
    for (const body of [
      { actorId: "bob" },
      { liked: true },
      [],
      { subjectId: "other" },
    ]) {
      assert.equal((await write("PUT", "alice", body)).status, 400);
      assert.equal((await write("DELETE", "alice", body)).status, 400);
    }
    assert.equal(
      (await batch({ subjects: [work], actorId: "bob" }, "alice")).status,
      400,
    );
    assert.equal(
      (await batch({ subjects: [{ ...work, actorId: "bob" }] })).status,
      400,
    );
    assert.equal(
      (await database.db.query("SELECT * FROM likes")).rows.length,
      0,
    );
  });

  it("validates batch size, nested subjects, identities, and registered types", async () => {
    for (const body of [
      {},
      { subjects: [] },
      { subjects: Array(101).fill(work) },
      { subjects: [null] },
      { subjects: ["work"] },
      { subjects: [{ ...work, subjectId: "" }] },
      { subjects: [{ ...work, subjectType: "Bad Type" }] },
      { subjects: [{ ...work, subjectType: "unregistered" }] },
      { subjects: [{ ...work, subjectId: "x".repeat(129) }] },
    ])
      assert.equal((await batch(body)).status, 400, JSON.stringify(body));
    assert.equal(
      (await write("PUT", "alice", undefined, "/likes/unregistered/post/me"))
        .status,
      400,
    );
    assert.equal(
      (await write("PUT", "alice", undefined, "/likes/blog-post/a%20b/me"))
        .status,
      400,
    );
  });

  it("omits unavailable objects, supports articles, and returns idempotent mutation results", async () => {
    const postPath = "/likes/blog-post/post/me";
    assert.equal((await write("PUT", "alice", {}, postPath)).status, 200);
    assert.equal(
      (await write("PUT", "alice", undefined, postPath)).status,
      200,
    );
    assert.equal(
      (await write("PUT", "alice", undefined, "/likes/blog-post/draft/me"))
        .status,
      404,
    );
    const response = await batch({
      subjects: [{ subjectType: "blog-post", subjectId: "draft" }, work, work],
    });
    assert.deepEqual(await response.json(), {
      items: [{ ...work, count: 0, viewerHasLiked: false, canLike: false }],
    });
    for (let i = 0; i < 2; i++) {
      const removed = await write("DELETE", "alice", undefined, postPath);
      assert.equal(removed.status, 200);
      assert.deepEqual(await removed.json(), {
        subjectType: "blog-post",
        subjectId: "post",
        count: 0,
        viewerHasLiked: false,
        canLike: true,
      });
    }
  });

  it("returns 429 for an exhausted persisted window and leaves the state unchanged", async () => {
    await write("PUT");
    await database.db.exec("UPDATE like_write_windows SET attempts = 120");
    assert.equal((await write("DELETE")).status, 429);
    const response = await batch({ subjects: [work] }, "alice");
    assert.equal(
      ((await response.json()) as { items: { viewerHasLiked: boolean }[] })
        .items[0]?.viewerHasLiked,
      true,
    );
  });

  it("publishes request/response schemas and authentication in OpenAPI", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    assert.ok(document.paths["/likes/batch"]?.post);
    assert.ok(
      document.paths["/likes/{subjectType}/{subjectId}/me"]?.put?.security,
    );
    assert.ok(
      document.paths["/likes/{subjectType}/{subjectId}/me"]?.delete?.security,
    );
    assert.ok(document.components?.schemas?.LikeBatchRequestDTO);
    assert.ok(document.components?.schemas?.LikeStateDTO);
  });

  it("rejects stale account preconditions without reading personal state or changing another actor's likes", async () => {
    for (const method of ["PUT", "DELETE"]) {
      const response = await fetch(
        baseUrl + "/likes/community-work/public-work/me",
        {
          method,
          headers: {
            ...headers,
            authorization: "Bearer bob",
            "x-artmate-like-actor": "alice",
          },
        },
      );
      assert.equal(response.status, 409);
    }
    const response = await fetch(baseUrl + "/likes/batch", {
      method: "POST",
      headers: {
        ...headers,
        authorization: "Bearer bob",
        "x-artmate-like-actor": "guest",
      },
      body: JSON.stringify({ subjects: [work] }),
    });
    assert.equal(response.status, 409);
    assert.equal(
      (await database.db.query("SELECT * FROM likes")).rows.length,
      0,
    );
  });
});
