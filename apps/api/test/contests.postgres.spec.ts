import { ConsentDecisionCommandHandler } from "../src/consents/consent-decision-command.handler";
import { ConsentDecisionCommandWorker } from "../src/consents/consent-decision-command.worker";
import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import {
  Module,
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthService } from "../src/auth/auth.service";
import { UsersService } from "../src/users/users.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import {
  AdminContestsController,
  PublicContestsController,
} from "../src/contests/contests.controller";
import { waitForContestDocuments } from "../src/contests/legal/contest-legal-documents";
import { ConsentOperations } from "../src/consents/contracts/consent-operations.contract";
import { ContestsService } from "../src/contests/contests.service";

// Explicit opt-in, never use a runtime database by default.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.ARTMATE_CONTESTS_TEST_DATABASE_URL;
describe(
  "contest persistence and HTTP access",
  { skip: !databaseUrl && "ARTMATE_CONTESTS_TEST_DATABASE_URL is not set" },
  () => {
    let app: INestApplication, db: PrismaClient, url: string, albumId: string;
    const valid = () => ({
      slug: `contest-${randomUUID()}`,
      title: "Конкурс",
      description: "Описание",
      task: "Сфотографируйте свою работу",
      rules: ["Одна заявка"],
      appearance: "none",
      prize: "Альбом",
      prizeDetail: "По альбому каждому",
      winnersCount: 3,
      selectionMode: "AUTOMATIC",
      opensAt: "2026-01-01T00:00:00Z",
      closesAt: "2099-12-01T20:59:00Z",
      drawAt: "2099-12-03T15:00:00Z",
      prizeAlbumQuantity: 1,
      prizeAlbumIds: [albumId],
      published: false,
    });
    before(async () => {
      const parsed = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
      assert.match(parsed.pathname, /^\/artmate_contests_test[a-z0-9_]*$/);
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: parsed.href }),
      });
      await db.$connect();
      albumId = (
        await db.product.create({
          data: {
            slug: `legal-album-${randomUUID()}`,
            title: "Альбом",
            price: 10000,
            status: "PUBLISHED",
            isOzonDeliveryAvailable: true,
            images: { create: { url: "https://example.test/album.webp" } },
          },
        })
      ).id;
      @Module({
        controllers: [AdminContestsController, PublicContestsController],
        providers: [
          ConsentDecisionCommandHandler,
          ConsentDecisionCommandWorker,
          ContestsService,
          { provide: PrismaService, useValue: db },
          {
            provide: UsersService,
            useValue: new UsersService(db as unknown as PrismaService),
          },
          {
            provide: AuthService,
            useValue: {
              getTokenFromRequest: (auth?: string) =>
                auth?.replace(/^Bearer /, ""),
              verifyAccessToken: async (token: string) => {
                if (!["admin", "customer"].includes(token))
                  throw new UnauthorizedException();
                return { id: token, roles: [token] };
              },
            },
          },
        ],
      })
      class TestModule {}
      app = await NestFactory.create(TestModule, { logger: false });
      const csrf = new CsrfMiddleware();
      app.use(csrf.use.bind(csrf));
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.listen(0, "127.0.0.1");
      url = await app.getUrl();
    });
    after(async () => {
      await app?.close();
      await db?.$disconnect();
    });
    async function request(
      path: string,
      body?: unknown,
      token: string | false = "admin",
      method = body ? "POST" : "GET",
      csrf = true,
    ) {
      return fetch(url + path, {
        method,
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-artmate-csrf": "1" } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    type Saved = ReturnType<typeof valid> & {
      id: string;
      version: number;
      stage: string;
    };
    async function create(patch = {}) {
      const response = await request("/admin/contests", {
        ...valid(),
        ...patch,
      });
      assert.equal(response.status, 201, await response.clone().text());
      return (await response.json()) as Saved;
    }
    it("denies guests, non-admins and mutations without CSRF", async () => {
      assert.equal(
        (await request("/admin/contests", undefined, false)).status,
        401,
      );
      assert.equal(
        (await request("/admin/contests", undefined, "customer")).status,
        403,
      );
      assert.equal(
        (await request("/admin/contests", valid(), "customer")).status,
        403,
      );
      assert.equal(
        (await request("/admin/contests", valid(), "admin", "POST", false))
          .status,
        403,
      );
    });
    it("persists a contest and its document command while the consent worker is unavailable", async () => {
      const worker = app.get(ConsentDecisionCommandWorker);
      await worker.onModuleDestroy();
      let documentId: string | null = null;
      try {
        const saved = await create({ published: true });
        const record = await db.contest.findUniqueOrThrow({
          where: { id: saved.id },
        });
        documentId = record.legalDocumentId;
        assert.ok(documentId);
        const document = await db.contestLegalDocument.findUniqueOrThrow({
          where: { id: documentId },
        });
        const pendingId = document.registrationCommandIds.at(-1)!;
        assert.deepEqual(await ConsentOperations.result(db, pendingId), {
          status: "PENDING",
        });
        assert.equal(record.published, true);
      } finally {
        worker.onModuleInit();
      }
      await waitForContestDocuments(db as unknown as PrismaService, documentId);
    });
    it("keeps drafts private, persists theme changes and publishes the same record", async () => {
      const saved = await create();
      assert.equal(saved.stage, "draft");
      assert.equal((await request(`/contests/${saved.slug}`)).status, 404);
      const change = await request(
        `/admin/contests/${saved.id}`,
        {
          ...valid(),
          slug: saved.slug,
          title: "Новый год",
          appearance: "new-year",
          published: true,
          version: saved.version,
        },
        "admin",
        "PATCH",
      );
      assert.equal(change.status, 200, await change.clone().text());
      const updated = (await change.json()) as Saved;
      assert.equal(updated.id, saved.id);
      assert.equal(updated.version, 2);
      const publicRecord = (await (
        await request(`/contests/${saved.slug}`)
      ).json()) as Saved;
      assert.equal(publicRecord.appearance, "new-year");
      assert.equal(publicRecord.title, "Новый год");
      assert.equal(publicRecord.stage, "open");
      assert.equal(
        ((await (await request(`/admin/contests/${saved.id}`)).json()) as Saved)
          .appearance,
        "new-year",
      );
      assert.equal(
        (
          await request(
            `/admin/contests/${saved.id}`,
            { ...valid(), slug: "changed-url", published: true, version: 2 },
            "admin",
            "PATCH",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            `/admin/contests/${saved.id}`,
            {
              ...valid(),
              title: "Новый год",
              slug: saved.slug,
              published: false,
              version: 2,
            },
            "admin",
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal((await request(`/contests/${saved.slug}`)).status, 404);
    });
    it("requires a configured prize and manual criteria before publication, and freezes published terms before entries", async () => {
      const missingPrize = await request("/admin/contests", {
        ...valid(),
        prizeAlbumQuantity: null,
        prizeAlbumIds: [],
        published: true,
      });
      assert.equal(missingPrize.status, 400);
      assert.equal(
        (
          await request("/admin/contests", {
            ...valid(),
            published: true,
            selectionMode: "MANUAL",
          })
        ).status,
        400,
      );
      const saved = await create({
        published: true,
        selectionMode: "MANUAL",
        manualCriteria: "Законченность и соответствие теме",
        manualTieBreak: "Решение организатора с обоснованием",
        manualEvaluator: "ИП Воропаев Денис Юрьевич",
      });
      assert.equal(
        (
          await request(
            `/admin/contests/${saved.id}`,
            {
              ...valid(),
              slug: saved.slug,
              published: true,
              selectionMode: "MANUAL",
              manualCriteria: "Законченность и соответствие теме",
              manualTieBreak: "Решение организатора с обоснованием",
              manualEvaluator: "ИП Воропаев Денис Юрьевич",
              title: "Подмена",
              version: saved.version,
            },
            "admin",
            "PATCH",
          )
        ).status,
        409,
      );
      const record = await db.contest.findUniqueOrThrow({
        where: { id: saved.id },
      });
      assert.ok(record.legalDocumentId);
      assert.equal(record.title, "Конкурс");
    });
    it("rejects conflicting slugs, malformed fields, unknown appearances and reversed dates", async () => {
      const saved = await create();
      assert.equal(
        (await request("/admin/contests", { ...valid(), slug: saved.slug }))
          .status,
        409,
      );
      for (const patch of [
        { appearance: "unknown" },
        { winnersCount: 0 },
        { rules: [" "] },
        { closesAt: "2020-01-01T00:00:00Z" },
        { drawAt: "2020-01-01T00:00:00Z" },
        { title: " " },
        { unexpected: true },
      ])
        assert.equal(
          (await request("/admin/contests", { ...valid(), ...patch })).status,
          400,
          JSON.stringify(patch),
        );
    });
    it("allows only one concurrent edit of the same version", async () => {
      const saved = await create();
      const change = (title: string) =>
        request(
          `/admin/contests/${saved.id}`,
          { ...valid(), slug: saved.slug, title, version: 1 },
          "admin",
          "PATCH",
        );
      const responses = await Promise.all([change("Первый"), change("Второй")]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
      const record = await db.contest.findUniqueOrThrow({
        where: { id: saved.id },
      });
      assert.equal(record.version, 2);
      assert.ok(["Первый", "Второй"].includes(record.title));
    });
    it("enforces date order and allowed appearance in PostgreSQL as well", async () => {
      const saved = await create();
      await assert.rejects(
        db.contest.update({
          where: { id: saved.id },
          data: { appearance: "unknown" },
        }),
      );
      await assert.rejects(
        db.contest.update({
          where: { id: saved.id },
          data: { closesAt: new Date("2000-01-01") },
        }),
      );
    });
  },
);
