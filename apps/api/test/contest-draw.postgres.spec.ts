import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import {
  Module,
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type ContestSelectionMode,
  type ContestEntryStatus,
} from "../src/generated/prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthService } from "../src/auth/auth.service";
import { UsersService } from "../src/users/users.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { ContestDrawController } from "../src/contests/contest-draw.controller";
import { ContestDrawService } from "../src/contests/contest-draw.service";
import { ContestAdminGuard } from "../src/contests/contest-entries.controller";
import { ContestEntriesService } from "../src/contests/contest-entries.service";
import { ContestsService } from "../src/contests/contests.service";
import { UserPhotoMediaService } from "../src/user-photos/user-photo-media.service";
import { ContestPhotoStorageService } from "../src/contests/contest-photo-storage.service";

// Explicit opt-in to an isolated local test database, never the runtime DB.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.ARTMATE_CONTESTS_TEST_DATABASE_URL;
describe(
  "contest winner selection with real PostgreSQL and HTTP",
  { skip: !databaseUrl && "ARTMATE_CONTESTS_TEST_DATABASE_URL is not set" },
  () => {
    let db: PrismaClient,
      draws: ContestDrawService,
      entries: ContestEntriesService,
      contestsService: ContestsService,
      app: INestApplication,
      base: string,
      adminId: string,
      productId: string;
    const contestIds: string[] = [],
      userIds: string[] = [];
    const id = () => randomBytes(16).toString("hex");
    before(async () => {
      const parsed = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
      assert.match(parsed.pathname, /^\/artmate_contests_test[a-z0-9_]*$/);
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: parsed.href }),
      });
      await db.$connect();
      adminId = (
        await db.user.create({
          data: { name: "Администратор", roles: ["ADMIN"] },
        })
      ).id;
      userIds.push(adminId);
      productId = (
        await db.product.create({
          data: {
            slug: `draw-album-${id()}`,
            title: "Альбом",
            price: 100000,
            status: "PUBLISHED",
          },
        })
      ).id;
      const prisma = db as unknown as PrismaService;
      draws = new ContestDrawService(prisma);
      entries = new ContestEntriesService(
        prisma,
        new UserPhotoMediaService(),
        new ContestPhotoStorageService(new UserPhotoMediaService()),
      );
      contestsService = new ContestsService(prisma);
      @Module({
        controllers: [ContestDrawController],
        providers: [
          { provide: ContestDrawService, useValue: draws },
          ContestAdminGuard,
          { provide: UsersService, useValue: new UsersService(prisma) },
          {
            provide: AuthService,
            useValue: {
              getTokenFromRequest: (auth?: string) =>
                auth?.replace(/^Bearer /, ""),
              verifyAccessToken: async (token: string) => {
                if (!["admin", "customer"].includes(token))
                  throw new UnauthorizedException();
                return {
                  id: token === "admin" ? adminId : "customer",
                  roles: [token],
                };
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
      base = await app.getUrl();
    });
    after(async () => {
      await app?.close();
      if (!db) return;
      const where = { contestId: { in: contestIds } };
      await db.contestPrizeAward.deleteMany({ where: { draw: where } });
      await db.contestDrawWinner.deleteMany({ where: { draw: where } });
      await db.contestDraw.deleteMany({ where });
      await db.contestEntryEvent.deleteMany({ where: { entry: where } });
      // The current-revision FK is deferred, so remove revisions and entries together.
      await db.$transaction(async (tx) => {
        await tx.contestEntryRevision.deleteMany({ where: { entry: where } });
        await tx.contestEntry.deleteMany({ where });
      });
      await db.contest.deleteMany({ where: { id: { in: contestIds } } });
      await db.product.delete({ where: { id: productId } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.$disconnect();
    });
    async function contest(
      mode: ContestSelectionMode = "AUTOMATIC",
      count = 2,
      future = false,
    ) {
      const c = await db.contest.create({
        data: {
          slug: `draw-${id()}`,
          title: "Конкурс",
          description: "Готовая работа",
          task: "Задание",
          rules: ["Одна работа"],
          prize: "Альбом",
          prizeDetail: "На выбор",
          winnersCount: count,
          selectionMode: mode,
          opensAt: new Date("2020-01-01"),
          closesAt: new Date("2020-01-02"),
          drawAt: new Date(future ? "2099-01-01" : "2020-01-03"),
          published: true,
          publishedAt: new Date(),
        },
      });
      contestIds.push(c.id);
      return c;
    }
    async function entry(
      contestId: string,
      status: ContestEntryStatus = "APPROVED",
      blocked = false,
    ) {
      const user = await db.user.create({
        data: {
          name: `Автор ${userIds.length}`,
          status: blocked ? "BLOCKED" : "ACTIVE",
        },
      });
      userIds.push(user.id);
      return db.$transaction(async (tx) =>
        tx.contestEntry.create({
          data: {
            id: id(),
            publicId: randomBytes(12).toString("hex"),
            contestId,
            userId: user.id,
            status,
            contestSnapshot: {},
            publishedAt:
              status === "APPROVED" || status === "HIDDEN" ? new Date() : null,
            revisions: {
              create: {
                id: id(),
                sequence: 1,
                productId,
                caption: "Работа",
                assets: {},
              },
            },
          },
        }),
      );
    }
    async function request(
      contestId: string,
      body?: object,
      auth = "admin",
      csrf = true,
    ) {
      return fetch(`${base}/admin/contests/${contestId}/draw`, {
        method: body ? "POST" : "GET",
        headers: {
          "content-type": "application/json",
          ...(auth ? { authorization: `Bearer ${auth}` } : {}),
          ...(csrf ? { "x-artmate-csrf": "1" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    const input = async (contestId: string, entryIds: string[]) => ({
      rosterToken: (await draws.getAdmin(contestId)).rosterToken!,
      entryIds,
    });

    it("protects result endpoints with auth, admin role, CSRF and strict DTO validation", async () => {
      const c = await contest("MANUAL");
      assert.equal((await request(c.id, undefined, "")).status, 401);
      assert.equal((await request(c.id, undefined, "customer")).status, 403);
      assert.equal(
        (await request(c.id, await input(c.id, []), "customer")).status,
        403,
      );
      assert.equal(
        (await request(c.id, await input(c.id, []), "admin", false)).status,
        403,
      );
      assert.equal(
        (await request(c.id, { rosterToken: "bad", entryIds: [] })).status,
        400,
      );
      assert.equal(
        (await request(c.id, { ...(await input(c.id, ["a", "a"])) })).status,
        400,
      );
    });

    it("waits for all moderation, excludes hidden/rejected/blocked entries, saves random order once", async () => {
      const c = await contest();
      const eligible = await Promise.all([
        entry(c.id),
        entry(c.id),
        entry(c.id),
      ]);
      await entry(c.id, "HIDDEN");
      await entry(c.id, "REJECTED");
      await entry(c.id, "APPROVED", true);
      const pending = await entry(c.id, "CHANGES_REQUESTED");
      assert.equal(await draws.selectAutomatic(c.id), false);
      assert.equal(
        (await contestsService.getPublic(c.slug)).resultsPendingModeration,
        true,
      );
      await entries.decide(pending.id, adminId, {
        version: 1,
        status: "REJECTED",
        reason: "Не выполнено задание",
      });
      const attempts = await Promise.all([
        draws.selectAutomatic(c.id),
        draws.selectAutomatic(c.id),
        draws.selectAutomatic(c.id),
      ]);
      assert.equal(attempts.filter(Boolean).length, 1);
      const saved = await db.contestDraw.findUniqueOrThrow({
        where: { contestId: c.id },
        include: { winners: true },
      });
      assert.equal(saved.winners.length, 2);
      assert.equal(saved.eligibleCount, 3);
      assert.equal(saved.actorId, null);
      assert.deepEqual(
        new Set(saved.selectionOrder as string[]),
        new Set(eligible.map((e) => e.id)),
      );
      assert.equal(new Set(saved.winners.map((w) => w.entryId)).size, 2);
      assert.match(saved.eligibilityHash, /^[a-f0-9]{64}$/);
      assert.equal(
        (await contestsService.getPublic(c.slug)).stage,
        "completed",
      );
      const publicResult = JSON.stringify(
        (await contestsService.getPublic(c.slug)).draw,
      );
      for (const forbidden of [
        "place",
        "userId",
        "entryId",
        "eligibility",
        "actor",
        "email",
      ])
        assert.ok(!publicResult.includes(`"${forbidden}"`));
      assert.equal(await draws.selectAutomatic(c.id), false);
      assert.equal(
        await db.contestDraw.count({ where: { contestId: c.id } }),
        1,
      );
    });

    it("manual choice validates eligibility and stale roster, preserves the winner set and ignores selection order", async () => {
      const c = await contest("MANUAL");
      const first = await entry(c.id),
        second = await entry(c.id),
        third = await entry(c.id),
        hidden = await entry(c.id, "HIDDEN");
      assert.equal(
        (await request(c.id, await input(c.id, [first.id]))).status,
        409,
      );
      assert.equal(
        (await request(c.id, await input(c.id, [first.id, hidden.id]))).status,
        409,
      );
      const old = await input(c.id, [second.id, first.id]);
      await entries.decide(first.id, adminId, {
        version: 1,
        status: "HIDDEN",
        reason: "Проверка",
      });
      assert.equal((await request(c.id, old)).status, 409);
      await entries.decide(first.id, adminId, {
        version: 2,
        status: "APPROVED",
      });
      const choice = await input(c.id, [second.id, first.id]);
      const concurrent = await Promise.all([
        request(c.id, choice),
        request(c.id, choice),
      ]);
      assert.ok(concurrent.every((response) => response.status === 201));
      const result = (await draws.getAdmin(c.id)).result!;
      assert.equal(result.actor?.id, adminId);
      assert.deepEqual(
        new Set(result.winners.map((w) => w.entryId)),
        new Set([first.id, second.id]),
      );
      assert.equal(
        (await request(c.id, { ...choice, entryIds: [first.id, second.id] }))
          .status,
        201,
      );
      assert.equal(
        (await request(c.id, { ...choice, entryIds: [first.id, third.id] }))
          .status,
        409,
      );
      assert.equal((await request(c.id, choice)).status, 201);
      assert.equal(
        await db.contestDraw.count({ where: { contestId: c.id } }),
        1,
      );
      const future = await contest("MANUAL", 1, true);
      const work = await entry(future.id);
      assert.equal(
        (await request(future.id, await input(future.id, [work.id]))).status,
        409,
      );
      const pending = await contest("MANUAL", 1);
      await entry(pending.id, "PENDING");
      assert.equal(
        (await request(pending.id, await input(pending.id, []))).status,
        409,
      );
    });

    it("finishes empty contests and awards everyone when there are fewer eligible entries than requested winners", async () => {
      const empty = await contest();
      assert.equal(await draws.selectAutomatic(empty.id), true);
      assert.equal((await draws.getAdmin(empty.id)).result?.winners.length, 0);
      assert.equal(
        (await contestsService.getPublic(empty.slug)).stage,
        "completed",
      );
      const few = await contest("AUTOMATIC", 3);
      await entry(few.id);
      await draws.selectAutomatic(few.id);
      assert.equal((await draws.getAdmin(few.id)).result?.winners.length, 1);
      const manualEmpty = await contest("MANUAL");
      assert.equal(
        (await request(manualEmpty.id, await input(manualEmpty.id, []))).status,
        201,
      );
    });

    it("scheduler recovers overdue automatic draws, skips manual/draft/future and never rerolls", async () => {
      const due = await contest();
      await entry(due.id);
      const manual = await contest("MANUAL"),
        future = await contest("AUTOMATIC", 1, true),
        draft = await contest();
      await db.contest.update({
        where: { id: draft.id },
        data: { published: false },
      });
      await draws.runDue();
      await draws.runDue();
      assert.equal(
        await db.contestDraw.count({ where: { contestId: due.id } }),
        1,
      );
      for (const c of [manual, future, draft])
        assert.equal(
          await db.contestDraw.count({ where: { contestId: c.id } }),
          0,
        );
      assert.equal(
        (await request(due.id, { rosterToken: "0".repeat(64), entryIds: [] }))
          .status,
        409,
      );
    });

    it("hiding a winner revokes photo exposure without replacing the saved winner or result", async () => {
      const c = await contest("AUTOMATIC", 1);
      const work = await entry(c.id);
      await draws.selectAutomatic(c.id);
      const before = (await draws.getAdmin(c.id)).result!;
      await entries.decide(work.id, adminId, {
        version: 1,
        status: "HIDDEN",
        reason: "Скрываем публикацию",
      });
      const publicContest = await contestsService.getPublic(c.slug);
      assert.equal(publicContest.draw?.winners[0]?.work, null);
      assert.equal(publicContest.works.length, 0);
      assert.equal((await draws.getAdmin(c.id)).result?.id, before.id);
      assert.deepEqual(
        (await draws.getAdmin(c.id)).result?.winners.map((w) => w.entryId),
        [work.id],
      );
      await entries.decide(work.id, adminId, {
        version: 2,
        status: "APPROVED",
      });
      assert.equal(
        (await contestsService.getPublic(c.slug)).draw?.winners[0]?.work?.id,
        work.publicId,
      );
    });

    it("serializes moderation with a draw and recovers a draw waiting for final approval", async () => {
      const c = await contest("AUTOMATIC", 1);
      const work = await entry(c.id);
      await Promise.all([
        draws.selectAutomatic(c.id),
        entries.decide(work.id, adminId, {
          version: 1,
          status: "HIDDEN",
          reason: "Скрываем работу",
        }),
      ]);
      const result = await db.contestDraw.findUniqueOrThrow({
        where: { contestId: c.id },
        include: { winners: true },
      });
      const snapshot = result.eligibility as {
        entryId: string;
        version: number;
      }[];
      assert.equal(result.winners.length, snapshot.length);
      assert.ok(snapshot.length === 0 || snapshot[0]?.version === 1);
      assert.ok(
        (await contestsService.getPublic(c.slug)).draw?.winners.every(
          (winner) => winner.work === null,
        ),
      );

      const waiting = await contest("AUTOMATIC", 1),
        pending = await entry(waiting.id, "PENDING");
      await Promise.all([
        draws.selectAutomatic(waiting.id),
        entries.decide(pending.id, adminId, { version: 1, status: "APPROVED" }),
      ]);
      await draws.selectAutomatic(waiting.id);
      assert.equal(
        (await draws.getAdmin(waiting.id)).result?.winners.length,
        1,
      );
      assert.equal(
        await db.contestDraw.count({ where: { contestId: waiting.id } }),
        1,
      );
    });

    it("freezes selection mode after the first entry and after an empty result", async () => {
      const occupied = await contest();
      await entry(occupied.id);
      const empty = await contest();
      await draws.selectAutomatic(empty.id);
      for (const c of [occupied, empty]) {
        await assert.rejects(
          contestsService.update(c.id, {
            ...c,
            prizePlaces: [],
            appearance: "none",
            selectionMode: "MANUAL",
            opensAt: c.opensAt.toISOString(),
            closesAt: c.closesAt.toISOString(),
            drawAt: c.drawAt.toISOString(),
          }),
          /нельзя менять/,
        );
      }
    });
  },
);
