import { ConsentDecisionCommandHandler } from "../src/consents/consent-decision-command.handler";
import { ConsentDecisionCommandWorker } from "../src/consents/consent-decision-command.worker";
import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdtemp, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  saveContestLegalDocument,
  waitForContestDocuments,
} from "../src/contests/legal/contest-legal-documents";
import { ContestLegalController } from "../src/contests/legal/contest-legal.controller";
import { setTimeout } from "node:timers/promises";
import { after, before, describe, it } from "node:test";
import {
  Injectable,
  Module,
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
  type ExecutionContext,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthService } from "../src/auth/auth.service";
import { AuthGuard } from "../src/auth/auth.guard";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { UsersService } from "../src/users/users.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { UserPhotoMediaService } from "../src/user-photos/user-photo-media.service";
import { WorkshopStorageService } from "../src/workshops/workshop-storage.service";
import { PublicWorkshopService } from "../src/workshops/public-workshop.service";
import { ContestEntriesService } from "../src/contests/contest-entries.service";
import { ContestPhotoStorageService } from "../src/contests/contest-photo-storage.service";
import {
  ContestAdminGuard,
  ContestEntriesController,
  MyContestEntriesController,
  ContestEntryModerationController,
} from "../src/contests/contest-entries.controller";
import { ContestDrawService } from "../src/contests/contest-draw.service";
import { ContestsService } from "../src/contests/contests.service";
import {
  AdminContestsController,
  PublicContestsController,
} from "../src/contests/contests.controller";

// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.ARTMATE_CONTESTS_TEST_DATABASE_URL;
type EntryResponse = NonNullable<
  Awaited<ReturnType<ContestEntriesService["mine"]>>
>;
describe(
  "contest uploads, moderation and public publication",
  { skip: !databaseUrl && "ARTMATE_CONTESTS_TEST_DATABASE_URL is not set" },
  () => {
    let app: INestApplication,
      db: PrismaClient,
      url: string,
      root: string,
      photo: Buffer;
    let admin: string,
      customer: string,
      other: string,
      albumId: string,
      categoryId: string;
    const contests: string[] = [];
    const extraUsers: string[] = [],
      extraAlbums: string[] = [];
    const id = () => randomBytes(16).toString("hex");
    const valid = () => ({
      slug: `test-entry-${id()}`,
      title: "Зимняя фотография",
      description: "Готовая работа",
      task: "Сфотографируйте свою раскраску",
      rules: ["Одна заявка, публикация после проверки"],
      appearance: "winter",
      prize: "Альбом",
      prizeDetail: "На выбор",
      winnersCount: 3,
      opensAt: new Date("2020-01-01"),
      closesAt: new Date("2099-01-01"),
      drawAt: new Date("2099-01-03"),
      prizeAlbumQuantity: 1,
      prizeAlbumIds: [albumId],
      published: true,
      publishedAt: new Date(),
    });
    const submitHandler = ContestEntriesController.prototype.submit;
    const productionGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      submitHandler,
    );
    const prepareHandler = ContestEntriesController.prototype.prepareConsent;
    const prepareGuards = Reflect.getMetadata(GUARDS_METADATA, prepareHandler);
    @Injectable()
    class SubmissionIdentityGuard extends AuthGuard {
      constructor(auth: AuthService) {
        super(auth);
      }
      async canActivate(context: ExecutionContext) {
        await super.canActivate(context);
        const req = context
          .switchToHttp()
          .getRequest<{ user: { id: string }; siteAction: unknown }>();
        req.siteAction = { actor: { userId: req.user.id } };
        return true;
      }
    }
    before(async () => {
      const parsed = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
      assert.match(parsed.pathname, /^\/artmate_contests_test[a-z0-9_]*$/);
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: parsed.href }),
      });
      await db.$connect();
      root = await mkdtemp(join(tmpdir(), "artmate-contest-entries-"));
      const media = new UserPhotoMediaService();
      admin = (
        await db.user.create({
          data: { id: id(), roles: ["ADMIN"], name: "Модератор" },
        })
      ).id;
      customer = (
        await db.user.create({
          data: {
            id: id(),
            name: "Участник",
            phone: "+79990000009",
            email: `${id()}@example.test`,
            emailVerifiedAt: new Date(),
          },
        })
      ).id;
      other = (
        await db.user.create({
          data: {
            id: id(),
            name: "Другой участник",
            email: `${id()}@example.test`,
            emailVerifiedAt: new Date(),
          },
        })
      ).id;
      const category = await db.productCategory.create({
        data: { slug: `contest-cats-${id()}`, title: "Котики" },
      });
      categoryId = category.id;
      albumId = (
        await db.product.create({
          data: {
            slug: `entry-album-${id()}`,
            title: "Альбом Artmate",
            isOzonDeliveryAvailable: true,
            images: {
              create: { url: "https://example.test/album.webp", sortOrder: 0 },
            },
            price: 100000,
            status: "PUBLISHED",
            categoryId: category.id,
          },
        })
      ).id;
      photo = await sharp({
        create: { width: 240, height: 160, channels: 3, background: "#f07a84" },
      })
        .png()
        .withMetadata({ orientation: 1 })
        .toBuffer();
      // Exercise multipart/controllers/domain storage with verified test identities.
      // The production consent/profile boundary is tested independently in site-action.spec.ts.
      Reflect.defineMetadata(
        GUARDS_METADATA,
        [SubmissionIdentityGuard],
        submitHandler,
      );
      Reflect.defineMetadata(
        GUARDS_METADATA,
        [SubmissionIdentityGuard],
        prepareHandler,
      );
      @Module({
        controllers: [
          ContestEntriesController,
          ContestLegalController,
          MyContestEntriesController,
          ContestEntryModerationController,
          AdminContestsController,
          PublicContestsController,
        ],
        providers: [
          ConsentDecisionCommandHandler,
          ConsentDecisionCommandWorker,
          ContestEntriesService,
          ContestsService,
          ContestAdminGuard,
          { provide: PrismaService, useValue: db },
          { provide: UserPhotoMediaService, useValue: media },
          {
            provide: ContestPhotoStorageService,
            useValue: new ContestPhotoStorageService(media, root),
          },
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
                if (![admin, customer, other].includes(token))
                  throw new UnauthorizedException();
                return {
                  id: token,
                  roles: [token === admin ? "admin" : "customer"],
                };
              },
            },
          },
          SubmissionIdentityGuard,
        ],
      })
      class TestModule {}
      app = await NestFactory.create(TestModule, {
        logger: false,
        abortOnError: false,
      });
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
      Reflect.defineMetadata(GUARDS_METADATA, productionGuards, submitHandler);
      Reflect.defineMetadata(GUARDS_METADATA, prepareGuards, prepareHandler);
      await app?.close();
      if (db) {
        // The deferred current-revision FK permits deleting a test entry and its history atomically.
        await db.$transaction(async (tx) => {
          await tx.contestEntryEvent.deleteMany({
            where: { entry: { contestId: { in: contests } } },
          });
          await tx.contestEntryRevision.deleteMany({
            where: { entry: { contestId: { in: contests } } },
          });
          await tx.contestEntry.deleteMany({
            where: { contestId: { in: contests } },
          });
          // Legal evidence is append-only, including in opt-in disposable databases.
          await tx.contest.deleteMany({
            where: { id: { in: contests }, legalDocumentId: null },
          });
        });
        await db.product.deleteMany({
          where: { id: { in: [albumId, ...extraAlbums] } },
        });
        await db.productCategory.deleteMany({ where: { id: categoryId } });
        await db.user.deleteMany({
          where: { id: { in: [admin, customer, other, ...extraUsers] } },
        });
        await db.$disconnect();
      }
      if (root) await rm(root, { recursive: true, force: true });
    });
    async function contest(overrides: Partial<Prisma.ContestCreateInput> = {}) {
      const row = await db.$transaction(
        async (tx) => {
          const draft = await tx.contest.create({
            data: { ...valid(), ...overrides },
          });
          await saveContestLegalDocument(tx, draft);
          return tx.contest.findUniqueOrThrow({ where: { id: draft.id } });
        },
        { timeout: 20_000 },
      );
      contests.push(row.id);
      await waitForContestDocuments(
        db as unknown as PrismaService,
        row.legalDocumentId,
      );
      return row;
    }
    function request(path: string, token?: string, init: RequestInit = {}) {
      return fetch(`${url}${path}`, {
        ...init,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "x-artmate-csrf": "1",
          ...init.headers,
        },
      });
    }
    async function consentPayload(slug: string, token?: string) {
      const response = token
        ? await request(`/contests/${slug}/entry-consent`, token, {
            method: "POST",
          })
        : null;
      const offer =
        response?.status === 201
          ? ((await response.json()) as { id: string })
          : null;
      return {
        albumId,
        caption: "Снег за окном",
        consentOfferId: offer?.id ?? "0".repeat(32),
        personalDataAccepted: true,
        publicationAccepted: true,
      };
    }
    async function upload(
      slug: string,
      token: string | undefined,
      values: object = {},
      file: Buffer | null = photo,
      mime = "image/png",
    ) {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          ...(Object.hasOwn(values, "consentOfferId")
            ? {}
            : await consentPayload(slug, token)),
          ...values,
        }),
      );
      if (file)
        form.append(
          "photo",
          new Blob([new Uint8Array(file)], { type: mime }),
          "work.png",
        );
      return request(`/contests/${slug}/entry`, token, {
        method: "POST",
        body: form,
      });
    }
    async function submitted(slug: string, token = customer) {
      const response = await upload(slug, token);
      assert.equal(response.status, 201, await response.clone().text());
      return (await response.json()) as EntryResponse;
    }
    function decision(
      entry: { id: string; version: number },
      status: string,
      reason?: string,
    ) {
      return request(`/admin/contest-entries/${entry.id}/decision`, admin, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, reason, version: entry.version }),
      });
    }
    const ownerPath = (entry: { id: string; revisionId: string }) =>
      `/contest-entries/me/${entry.id}/revisions/${entry.revisionId}/photo`;
    const publicPath = (entry: { publicId: string }) =>
      `/contests/works/${entry.publicId}/photo/web`;
    it("uses the shared Consents registry and serves the frozen PDF, while keeping draft documents private", async () => {
      const c = await contest();
      const document = await db.contestLegalDocument.findUniqueOrThrow({
        where: { id: c.legalDocumentId! },
      });
      const response = await request(
        `/contests/${c.slug}/legal/${document.id}/file`,
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/pdf");
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        document.sha256,
      );
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      const registry = await db.consentRevision.findMany({
        where: {
          purpose: { in: ["contest_entry", `contest_conditions:${c.id}`] },
        },
      });
      assert.equal(registry.length, 4);
      assert.ok(
        registry.some((r) => Buffer.from(r.documentBytes).equals(bytes)),
      );
      for (const r of registry)
        assert.equal(
          createHash("sha256").update(r.documentBytes).digest("hex"),
          r.documentSha256,
        );
      await assert.rejects(
        db.contestLegalDocument.update({
          where: { id: document.id },
          data: { title: "Подмена" },
        }),
        /append-only/i,
      );
      const output = resolve(
        __dirname,
        "../../../outputs/contest-legal-integration-20261122",
      );
      await mkdir(output, { recursive: true });
      await writeFile(join(output, "generated-conditions.pdf"), bytes);
      const draft = await contest({ published: false, publishedAt: null });
      const path = `/contests/${draft.slug}/legal/${draft.legalDocumentId}/file`;
      assert.equal((await request(path)).status, 404);
      assert.equal((await request(path, customer)).status, 404);
      assert.equal((await request(path, admin)).status, 200);
    });
    it("requires both decisions, rejects foreign and expired offers, and leaves failed uploads unaccepted", async () => {
      const c = await contest();
      const payload = await consentPayload(c.slug, customer);
      for (const field of ["personalDataAccepted", "publicationAccepted"]) {
        assert.equal(
          (await upload(c.slug, customer, { ...payload, [field]: false }))
            .status,
          400,
          field,
        );
      }
      assert.equal((await upload(c.slug, other, payload)).status, 409);
      assert.equal(
        (await upload(c.slug, customer, { ...payload, albumId: "missing" }))
          .status,
        400,
      );
      assert.equal(
        (
          await db.contextualConsentOffer.findUniqueOrThrow({
            where: { id: payload.consentOfferId },
          })
        ).usedAt,
        null,
      );
      assert.equal(
        await db.contextualConsentAcceptance.count({
          where: { offerId: payload.consentOfferId },
        }),
        0,
      );
      await db.contextualConsentOffer.update({
        where: { id: payload.consentOfferId },
        data: { validUntil: new Date(0) },
      });
      assert.equal((await upload(c.slug, customer, payload)).status, 409);
      assert.equal(
        await db.contestEntry.count({ where: { contestId: c.id } }),
        0,
      );
    });
    it("rejects client-supplied identity and publication settings without recording consent", async () => {
      const c = await contest();
      const payload = await consentPayload(c.slug, customer);
      for (const [field, value] of Object.entries({
        fullName: "Другое имя",
        publicName: "Псевдоним",
        email: "other@example.test",
        phone: "+79990000000",
        ageConfirmed: true,
        rulesAccepted: false,
        publicationFields: ["photo"],
        publicationResources: ["site"],
        publicationRestrictions: "Иные условия",
      })) {
        const response = await upload(c.slug, customer, {
          ...payload,
          [field]: value,
        });
        assert.equal(response.status, 400, field);
      }
      assert.equal(
        await db.contextualConsentAcceptance.count({
          where: { offerId: payload.consentOfferId },
        }),
        0,
      );
      assert.equal(
        await db.contestEntry.count({ where: { contestId: c.id } }),
        0,
      );
    });
    it("records profile identity and fixed publication policy with four immutable acceptances", async () => {
      const c = await contest();
      const payload = await consentPayload(c.slug, customer);
      const profile = await db.user.update({
        where: { id: customer },
        data: { name: "Имя из профиля" },
      });
      const response = await upload(c.slug, customer, payload);
      assert.equal(response.status, 201, await response.clone().text());
      const entry = (await response.json()) as EntryResponse;
      const revision = await db.contestEntryRevision.findUniqueOrThrow({
        where: { id: entry.revisionId },
      });
      assert.equal(revision.consentAcceptanceIds.length, 4);
      const facts = await db.contextualConsentAcceptance.findMany({
        where: { id: { in: revision.consentAcceptanceIds } },
        include: { revision: true },
      });
      assert.equal(facts.length, 4);
      const individual = facts[0]!.individualPart as {
        actor: {
          userId: string;
          name: string | null;
          email: string;
          phone: string | null;
        };
        object: { photoSha256: string };
        publication: {
          resources: { id: string }[];
          publicName: string | null;
          fields: string[];
        };
      };
      assert.equal(individual.actor.userId, customer);
      assert.equal(individual.actor.name, profile.name);
      assert.equal(individual.actor.email, profile.email);
      assert.equal(individual.actor.phone, profile.phone);
      assert.equal(individual.publication.publicName, profile.name);
      assert.equal(
        individual.object.photoSha256,
        (revision.assets as { normalized: { checksum: string } }).normalized
          .checksum,
      );
      assert.deepEqual(
        individual.publication.resources.map((r) => r.id),
        ["site", "media", "telegram", "ozon", "wildberries"],
      );
      assert.deepEqual(individual.publication.fields, [
        "photo",
        "contest",
        "album",
        "winner",
        "author",
        "caption",
        "number",
      ]);
      assert.ok(!("additionalRestrictions" in individual.publication));
      for (const fact of facts) {
        assert.match(fact.revision.version, /:form3$/);
        const savedForm = JSON.parse(
          Buffer.from(fact.revision.formSnapshotBytes).toString(),
        );
        assert.equal(savedForm.identitySource, "customer_profile");
        assert.deepEqual(savedForm.rulesAcceptance, {
          method: "submit",
          buttonLabel: "Отправить работу",
          notice:
            "Нажимая «Отправить работу», вы принимаете правила и условия конкурса.",
        });
        assert.deepEqual(
          (fact.individualPart as { confirmations: { rules: unknown } })
            .confirmations.rules,
          { accepted: true, method: "submit", buttonLabel: "Отправить работу" },
        );
        assert.deepEqual(savedForm.requiredConfirmations, [
          "personalDataAccepted",
          "publicationAccepted",
        ]);
        assert.ok(
          !(
            "age18" in
            (fact.individualPart as { confirmations: object }).confirmations
          ),
        );
        assert.equal(fact.actorUserIdSnapshot, customer);
        assert.equal(fact.contextKey, c.legalDocumentId);
        assert.equal(
          fact.endsAt.getUTCFullYear() - fact.startsAt.getUTCFullYear(),
          15,
        );
        assert.ok(
          !JSON.stringify(fact.requestContext).includes(customer),
          "Bearer credential must be redacted",
        );
      }
      await assert.rejects(
        db.contextualConsentAcceptance.update({
          where: { id: facts[0]!.id },
          data: { individualPart: {} },
        }),
        /append-only/i,
      );
      assert.equal((await upload(c.slug, customer, payload)).status, 409);
      assert.equal(
        await db.contextualConsentAcceptance.count({
          where: { subjectId: c.id },
        }),
        4,
      );
      const adminDetail = (await (
        await request(`/admin/contest-entries/${entry.id}`, admin)
      ).json()) as { legalAcceptance: unknown; consentAcceptances: unknown[] };
      assert.ok(adminDetail.legalAcceptance);
      assert.equal(adminDetail.consentAcceptances.length, 4);
      assert.equal((await decision(entry, "APPROVED")).status, 201);
      const publicDetail = (await (
        await request(`/contests/${c.slug}`)
      ).json()) as { works: { author: string; title: string }[] };
      assert.equal(publicDetail.works[0]!.author, profile.name);
      assert.equal(publicDetail.works[0]!.title, payload.caption);
      assert.ok(!JSON.stringify(publicDetail).includes(profile.email!));
      await db.contestEntry.update({
        where: { id: entry.id },
        data: { publicationEndsAt: new Date(0) },
      });
      assert.equal((await request(publicPath(entry))).status, 404);
      const afterExpiry = (await (
        await request(`/contests/${c.slug}`)
      ).json()) as { works: unknown[] };
      assert.equal(afterExpiry.works.length, 0);
      const visibility = await db.$queryRaw<
        { is_public: boolean }[]
      >`SELECT is_public FROM contest_like_subjects_v1 WHERE subject_id = ${entry.publicId}`;
      assert.equal(visibility[0]!.is_public, false);
    });
    it("requires identity, admin rights and CSRF before upload or moderation", async () => {
      const c = await contest();
      assert.equal((await upload(c.slug, undefined)).status, 401);
      assert.equal((await request(`/contests/${c.slug}/entry`)).status, 401);
      assert.deepEqual(
        await (await request(`/contests/${c.slug}/entry`, customer)).json(),
        { entry: null },
      );
      assert.equal(
        (await request(`/admin/contests/${c.id}/entries`, customer)).status,
        403,
      );
      const form = new FormData();
      form.append("payload", "{}");
      assert.equal(
        (
          await request(`/contests/${c.slug}/entry`, customer, {
            method: "POST",
            body: form,
            headers: { "x-artmate-csrf": "" },
          })
        ).status,
        403,
      );
      assert.equal(
        await db.contestEntry.count({ where: { contestId: c.id } }),
        0,
      );
    });
    it("stores one private whole photo, checks MIME, album and contest dates", async () => {
      const c = await contest();
      assert.equal(
        (await upload(c.slug, customer, {}, Buffer.from("not an image")))
          .status,
        400,
      );
      assert.equal(
        (await upload(c.slug, customer, {}, photo, "image/jpeg")).status,
        400,
      );
      assert.equal(
        (await upload(c.slug, customer, { number: 1 })).status,
        400,
        "picture must belong to the selected album",
      );
      assert.equal(
        (await upload(c.slug, customer, { albumId: "missing" })).status,
        400,
      );
      const entry = await submitted(c.slug);
      assert.equal((await request(ownerPath(entry))).status, 401);
      assert.equal((await request(ownerPath(entry), other)).status, 404);
      const image = await request(ownerPath(entry), customer);
      assert.equal(image.status, 200);
      assert.match(image.headers.get("cache-control")!, /no-store/);
      const metadata = await sharp(
        Buffer.from(await image.arrayBuffer()),
      ).metadata();
      assert.equal(metadata.width, 240);
      assert.equal(metadata.height, 160);
      assert.equal(metadata.exif, undefined);
      assert.equal((await request(publicPath(entry))).status, 404);
      assert.deepEqual(
        (
          (await (await request(`/contests/${c.slug}`)).json()) as {
            works: unknown[];
          }
        ).works,
        [],
      );
      assert.equal(
        (
          (await (
            await request(`/contests/${c.slug}/entry`, customer)
          ).json()) as { entry: EntryResponse }
        ).entry.id,
        entry.id,
      );
      assert.equal((await upload(c.slug, customer)).status, 409);
      const closed = await contest({ closesAt: new Date("2021-01-01") });
      assert.equal((await upload(closed.slug, customer)).status, 409);
      const draft = await contest({ published: false });
      assert.equal((await upload(draft.slug, customer)).status, 404);
    });
    it("handles concurrent first submissions with a unique entry and cleans losing uploads", async () => {
      const c = await contest();
      const responses = await Promise.all([
        upload(c.slug, customer),
        upload(c.slug, customer),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      const entry = await db.contestEntry.findFirstOrThrow({
        where: { contestId: c.id },
      });
      assert.equal(
        await db.contestEntry.count({ where: { contestId: c.id } }),
        1,
      );
      assert.equal(
        await db.contestEntryRevision.count({ where: { entryId: entry.id } }),
        1,
      );
      const files = await readdir(join(root, entry.id), { recursive: true });
      assert.equal(
        files.filter((name) => String(name).endsWith(".webp")).length,
        3,
      );
    });
    it("retains revisions and reasons, rejects stale edits, publishes in both places and revokes direct photos on hide", async () => {
      const c = await contest();
      let entry = await submitted(c.slug);
      assert.equal(
        (await decision(entry, "CHANGES_REQUESTED", " ")).status,
        400,
      );
      assert.equal(
        (
          await decision(
            entry,
            "CHANGES_REQUESTED",
            "Покажите раскраску целиком",
          )
        ).status,
        201,
      );
      const { entry: changes } = (await (
        await request(`/contests/${c.slug}/entry`, customer)
      ).json()) as { entry: EntryResponse };
      assert.equal(changes.reason, "Покажите раскраску целиком");
      assert.equal(
        (await upload(c.slug, customer, { version: entry.version })).status,
        409,
      );
      const revised = await upload(c.slug, customer, {
        version: changes.version,
        caption: "Новая фотография",
      });
      assert.equal(revised.status, 201);
      const oldEntry = entry;
      entry = (await revised.json()) as EntryResponse;
      assert.notEqual(entry.revisionId, oldEntry.revisionId);
      assert.equal((await request(ownerPath(oldEntry), customer)).status, 200);
      assert.equal((await decision(changes, "APPROVED")).status, 409);
      const withoutReplacement = await upload(
        c.slug,
        customer,
        { version: entry.version, caption: "Та же фотография" },
        null,
      );
      assert.equal(withoutReplacement.status, 201);
      entry = (await withoutReplacement.json()) as EntryResponse;
      assert.equal((await request(ownerPath(entry), customer)).status, 200);
      const approvals = await Promise.all([
        decision(entry, "APPROVED"),
        decision(entry, "REJECTED", "Повтор"),
      ]);
      assert.deepEqual(approvals.map((r) => r.status).sort(), [201, 409]);
      const final = await db.contestEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      // If the rejection wins the race, use a separate pending participant to verify publication.
      if (final.status === "REJECTED") {
        entry = await submitted(c.slug, other);
        assert.equal((await decision(entry, "APPROVED")).status, 201);
      }
      const image = await request(publicPath(entry));
      assert.equal(image.status, 200);
      assert.match(image.headers.get("cache-control")!, /no-store/);
      const publicContest = (await (
        await request(`/contests/${c.slug}`)
      ).json()) as { works: { id: string }[] };
      assert.equal(publicContest.works[0]!.id, entry.publicId);
      assert.equal("email" in publicContest.works[0]!, false);
      const gallery = new PublicWorkshopService(
        db as unknown as PrismaService,
        {} as WorkshopStorageService,
      );
      const works = await gallery.getGalleryWorks();
      const published = works.works.find(
        (work) => work.publicId === entry.publicId,
      );
      assert.equal(published?.source, "contest");
      assert.ok(published && !("official" in published));
      const filters = await gallery.getGalleryFilters();
      assert.ok(
        filters.collections.some((album) => album.numbers.length === 0),
      );
      assert.equal(
        (await upload(c.slug, customer, { version: final.version }, null))
          .status,
        409,
      );
      const approved = await db.contestEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      assert.equal(
        (await decision(approved, "HIDDEN", "Фотография другого автора"))
          .status,
        201,
      );
      assert.equal((await request(publicPath(entry))).status, 404);
      assert.equal(
        (await gallery.getGalleryWorks()).works.some(
          (work) => work.publicId === entry.publicId,
        ),
        false,
      );
      const subjects = await db.$queryRaw<
        Array<{ is_public: boolean }>
      >`SELECT is_public FROM contest_like_subjects_v1 WHERE subject_id = ${entry.publicId}`;
      assert.equal(subjects[0]!.is_public, false);
      const hidden = await db.contestEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      assert.equal((await decision(hidden, "APPROVED")).status, 201);
      assert.equal((await request(publicPath(entry))).status, 200);
      assert.equal(
        (
          await db.contestEntry.findUniqueOrThrow({ where: { id: entry.id } })
        ).publishedAt!.getTime(),
        approved.publishedAt!.getTime(),
      );
      const detail = (await (
        await request(`/admin/contest-entries/${oldEntry.id}`, admin)
      ).json()) as { events: { reason: string | null }[] };
      assert.ok(detail.events.length >= 4);
      assert.equal(
        detail.events.some(
          (event) => event.reason === "Покажите раскраску целиком",
        ),
        true,
      );
    });
    it("freezes conditions after the first entry while allowing appearance changes", async () => {
      const c = await contest();
      await submitted(c.slug);
      const contestId = c.id;
      const apiInput = {
        title: c.title,
        slug: c.slug,
        description: c.description,
        task: c.task,
        rules: c.rules,
        appearance: c.appearance,
        prize: c.prize,
        prizeDetail: c.prizeDetail,
        winnersCount: c.winnersCount,
        prizeAlbumQuantity: c.prizeAlbumQuantity,
        prizeAlbumIds: c.prizeAlbumIds,
        selectionMode: c.selectionMode,
        published: c.published,
        opensAt: c.opensAt.toISOString(),
        closesAt: c.closesAt.toISOString(),
        drawAt: c.drawAt.toISOString(),
        version: c.version,
      };
      const patch = (extra: object) =>
        request(`/admin/contests/${contestId}`, admin, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...apiInput, ...extra }),
        });
      assert.equal(
        (await patch({ task: "Совсем другое задание" })).status,
        409,
      );
      assert.equal((await patch({ appearance: "new-year" })).status, 200);
      assert.equal(
        (await db.contestEntry.findFirstOrThrow({ where: { contestId } }))
          .contestSnapshot && true,
        true,
      );
    });
    it("rejects edits and correction requests once submissions close, but allows a final decision", async () => {
      const c = await contest();
      const entry = await submitted(c.slug);
      await db.contest.update({
        where: { id: c.id },
        data: { closesAt: new Date(Date.now() - 1000) },
      });
      assert.equal(
        (await upload(c.slug, customer, { version: entry.version })).status,
        409,
      );
      assert.equal(
        (await decision(entry, "CHANGES_REQUESTED", "Замените фото")).status,
        409,
      );
      assert.equal((await decision(entry, "APPROVED")).status, 201);
      assert.equal((await decision(entry, "APPROVED")).status, 409);
    });
    it("recovers a disconnected submission from persisted consent results, including after the deadline", async () => {
      const c = await contest();
      const payload = await consentPayload(c.slug, customer);
      const worker = app.get(ConsentDecisionCommandWorker);
      await worker.onModuleDestroy();
      const controller = new AbortController();
      const form = new FormData();
      form.append("payload", JSON.stringify(payload));
      form.append(
        "photo",
        new Blob([new Uint8Array(photo)], { type: "image/png" }),
        "work.png",
      );
      const disconnected = request(`/contests/${c.slug}/entry`, customer, {
        method: "POST",
        body: form,
        signal: controller.signal,
      }).then(
        () => null,
        (error) => error,
      );
      try {
        const until = Date.now() + 5000;
        let staged = await db.contestEntrySubmission.findFirst({
          where: { contestId: c.id },
        });
        while (!staged && Date.now() < until) {
          await setTimeout(25);
          staged = await db.contestEntrySubmission.findFirst({
            where: { contestId: c.id },
          });
        }
        assert.ok(
          staged,
          "the request must save its photo and command before waiting for Consents",
        );
        controller.abort();
        assert.ok(await disconnected);
        assert.equal(
          await db.contestEntry.count({ where: { contestId: c.id } }),
          0,
        );
        assert.equal(
          await db.contextualConsentAcceptance.count({
            where: { subjectId: c.id },
          }),
          0,
        );
        assert.equal(
          (await readdir(join(root, staged.entryId), { recursive: true }))
            .length > 0,
          true,
        );
        await db.contest.update({
          where: { id: c.id },
          data: {
            closesAt: new Date(Date.now() - 2000),
            drawAt: new Date(Date.now() - 1000),
          },
        });
        assert.equal(
          await new ContestDrawService(
            db as unknown as PrismaService,
          ).selectAutomatic(c.id),
          false,
          "a draw must wait for a durable submission even before an entry exists",
        );
        await new ConsentDecisionCommandHandler(
          db as unknown as PrismaService,
        ).process(staged.consentCommandId);
        const restarted = new ContestEntriesService(
          db as unknown as PrismaService,
          new UserPhotoMediaService(),
          app.get(ContestPhotoStorageService),
        );
        await Promise.all([
          restarted.processPendingSubmissions(),
          app.get(ContestEntriesService).processPendingSubmissions(),
        ]);
        assert.equal(
          (
            await db.contestEntrySubmission.findUniqueOrThrow({
              where: { id: staged.id },
            })
          ).status,
          "COMPLETED",
        );
        const entry = await db.contestEntry.findUniqueOrThrow({
          where: { id: staged.entryId },
        });
        assert.equal(entry.revision, 1);
        assert.equal(
          await db.contestEntryRevision.count({ where: { entryId: entry.id } }),
          1,
        );
        assert.equal(
          await db.contextualConsentAcceptance.count({
            where: { subjectId: c.id },
          }),
          4,
        );
        await restarted.processPendingSubmissions();
        const response = await request(`/contests/${c.slug}/entry`, customer);
        assert.equal(
          ((await response.json()) as { entry: EntryResponse }).entry.id,
          entry.id,
        );
      } finally {
        controller.abort();
        worker.onModuleInit();
      }
    });
    it("paginates approved contest photos with the same timestamp without gaps or duplicates", async () => {
      const c = await contest();
      const product = await db.product.create({
        data: {
          slug: `contest-pages-${id()}`,
          title: "Альбом без цифровых картинок",
          price: 100000,
          status: "PUBLISHED",
          categoryId: (
            await db.product.findUniqueOrThrow({ where: { id: albumId } })
          ).categoryId,
        },
      });
      extraAlbums.push(product.id);
      const userIds = Array.from({ length: 66 }, id);
      extraUsers.push(...userIds);
      await db.user.createMany({
        data: userIds.map((userId) => ({ id: userId, name: "Автор" })),
      });
      const prefix = randomBytes(12).toString("hex"),
        publishedAt = new Date("2026-11-01T12:00:00Z");
      const entries = userIds.map((userId, index) => ({
        id: `${prefix}${index.toString(16).padStart(8, "0")}`,
        publicId: randomBytes(12).toString("hex"),
        userId,
        contestId: c.id,
        status: "APPROVED" as const,
        publishedAt,
        contestSnapshot: {},
      }));
      await db.$transaction(async (tx) => {
        await tx.contestEntry.createMany({ data: entries });
        await tx.contestEntryRevision.createMany({
          data: entries.map((entry) => ({
            id: id(),
            entryId: entry.id,
            sequence: 1,
            productId: product.id,
            caption: "",
            assets: {},
          })),
        });
      });
      const gallery = new PublicWorkshopService(
        db as unknown as PrismaService,
        {} as WorkshopStorageService,
      );
      const first = await gallery.getGalleryWorks(undefined, [product.slug]);
      assert.equal(first.works.length, 60);
      assert.ok(first.nextCursor);
      const second = await gallery.getGalleryWorks(first.nextCursor!, [
        product.slug,
      ]);
      assert.equal(second.works.length, 6);
      assert.equal(second.nextCursor, null);
      const ids = [...first.works, ...second.works].map(
        (work) => work.publicId,
      );
      assert.equal(new Set(ids).size, 66);
      assert.deepEqual(
        ids,
        [...entries].reverse().map((entry) => entry.publicId),
      );
      assert.equal(
        (await gallery.getGalleryWorks(undefined, [product.slug], 1)).works
          .length,
        0,
        "photos without a picture number are not assigned a synthetic number",
      );
    });
  },
);
