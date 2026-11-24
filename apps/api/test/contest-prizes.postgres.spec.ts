import { ConsentDecisionCommandHandler } from "../src/consents/consent-decision-command.handler";
import { ConsentDecisionCommandWorker } from "../src/consents/consent-decision-command.worker";
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
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { DeliveryProxyThrottleService } from "../src/delivery/delivery-proxy-throttle.service";
import { DeliveryService } from "../src/delivery/delivery.service";
import { AuthService } from "../src/auth/auth.service";
import { PromocodesService } from "../src/promocodes/promocodes.service";
import { ContestPromoPrizesService } from "../src/promocodes/contest-promo-prizes.service";
import { OrderPrizesService } from "../src/orders/prizes/prizes.service";
import { OrderPrizesController } from "../src/orders/prizes/prizes.controller";
import type { OrderDTO } from "../src/orders/dto/order.dto";
import { OrdersStorage } from "../src/orders/orders.storage";
import { ContestsService } from "../src/contests/contests.service";
import { ContestDrawService } from "../src/contests/contest-draw.service";
import { CreateContestRequestDTO } from "../src/contests/dto/contest-request.dto";
import { CsrfMiddleware } from "../src/common/csrf.middleware";

// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.ARTMATE_CONTESTS_TEST_DATABASE_URL;
describe(
  "contest album prizes and free orders with PostgreSQL and HTTP",
  { skip: !databaseUrl && "isolated database not configured" },
  () => {
    let db: PrismaClient,
      prizes: OrderPrizesService,
      storage: OrdersStorage,
      contests: ContestsService,
      draws: ContestDrawService;
    let app: INestApplication, base: string, owner: string, other: string;
    const users: string[] = [],
      contestIds: string[] = [],
      productIds: string[] = [],
      promoIds: string[] = [],
      promoOrderIds: string[] = [];
    let deliveryCalls = 0,
      deliveryFail = false,
      financialCalls = 0;
    const uid = () => randomBytes(16).toString("hex");
    const delivery = {
      calculatePickupPointDelivery: async (selection: {
        provider: string;
        pickupPointId: string;
      }) => {
        deliveryCalls++;
        if (deliveryFail) throw Error("provider unavailable");
        assert.equal(selection.provider, "ozon");
        assert.equal(selection.pickupPointId, "ozon-test-point");
        return {
          provider: "ozon",
          deliveryPrice: 350,
          pickupPoint: {
            id: selection.pickupPointId,
            title: "ПВЗ Ozon",
            address: "Тестовый адрес",
            workHours: "10:00–20:00",
            deliveryPrice: 350,
          },
        };
      },
    };
    let consentWorker: ConsentDecisionCommandWorker;
    before(async () => {
      const url = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
      assert.match(url.pathname, /^\/artmate_contests_test[a-z0-9_]*$/);
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.href }),
      });
      await db.$connect();
      for (let i = 0; i < 6; i++)
        users.push(
          (
            await db.user.create({
              data: { name: "Победитель", roles: ["CUSTOMER"] },
            })
          ).id,
        );
      [owner, other] = users as [string, string];
      for (let i = 0; i < 3; i++)
        productIds.push(
          (
            await db.product.create({
              data: {
                slug: `prize-album-${uid()}`,
                title: `Альбом ${i}`,
                status: "PUBLISHED",
                price: 100000,
                images: { create: { url: "https://example.test/cover.jpg" } },
              },
            })
          ).id,
        );
      const prisma = db as unknown as PrismaService;
      const financial = {
        recordCompletionInTransaction: async () => {
          financialCalls++;
        },
        recordEligibilityLossInTransaction: async () => {
          financialCalls++;
        },
      };
      storage = new OrdersStorage(
        prisma,
        {} as never,
        {} as never,
        {} as never,
        financial as never,
        {} as never,
      );
      prizes = new OrderPrizesService(
        prisma,
        delivery as unknown as DeliveryService,
        storage,
      );
      contests = new ContestsService(prisma);
      consentWorker = new ConsentDecisionCommandWorker(
        prisma,
        new ConsentDecisionCommandHandler(prisma),
      );
      consentWorker.onModuleInit();
      draws = new ContestDrawService(prisma);
      @Module({
        controllers: [OrderPrizesController],
        providers: [
          DeliveryProxyThrottleService,
          { provide: OrderPrizesService, useValue: prizes },
          {
            provide: AuthService,
            useValue: {
              getTokenFromRequest: (header?: string) =>
                header?.replace("Bearer ", ""),
              verifyAccessToken: async (token: string) => {
                if (![owner, other].includes(token))
                  throw new UnauthorizedException();
                return { id: token, roles: ["customer"], status: "active" };
              },
            },
          },
        ],
      })
      class TestModule {}
      app = await NestFactory.create(TestModule, { logger: false });
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      const csrf = new CsrfMiddleware();
      app.use(csrf.use.bind(csrf));
      await app.listen(0, "127.0.0.1");
      base = await app.getUrl();
    });
    after(async () => {
      if (!db) return;
      await app?.close();
      await consentWorker?.onModuleDestroy();
      const grants = await db.orderPrizeGrant.findMany({
        where: { userId: { in: users } },
      });
      await db.orderPrizeGrant.deleteMany({ where: { userId: { in: users } } });
      await db.promoRedemption.deleteMany({
        where: { orderId: { in: promoOrderIds } },
      });
      await db.order.deleteMany({ where: { id: { in: promoOrderIds } } });
      await db.promoCode.deleteMany({
        where: {
          OR: [{ recipientUserId: { in: users } }, { id: { in: promoIds } }],
        },
      });
      const ids = grants.flatMap((grant) =>
        grant.orderId ? [grant.orderId] : [],
      );
      const deliveryEvents = await db.deliveryCompletionEvent.findMany({
        where: { orderId: { in: ids } },
        select: { id: true },
      });
      await db.orderDeliveryCompletionReceipt.deleteMany({
        where: { eventId: { in: deliveryEvents.map((event) => event.id) } },
      });
      await db.deliveryCompletionEvent.deleteMany({
        where: { orderId: { in: ids } },
      });
      await db.deliveryTrackingRequest.deleteMany({
        where: { orderId: { in: ids } },
      });
      await db.order.deleteMany({ where: { id: { in: ids } } });
      await db.contestPrizeAward.deleteMany({
        where: { draw: { contestId: { in: contestIds } } },
      });
      await db.contestPrizeProductBinding.deleteMany({
        where: { contestId: { in: contestIds } },
      });
      await db.contestDrawWinner.deleteMany({
        where: { draw: { contestId: { in: contestIds } } },
      });
      await db.contestDraw.deleteMany({
        where: { contestId: { in: contestIds } },
      });
      await db.$transaction(async (tx) => {
        await tx.contestEntryRevision.deleteMany({
          where: { entry: { contestId: { in: contestIds } } },
        });
        await tx.contestEntry.deleteMany({
          where: { contestId: { in: contestIds } },
        });
      });
      // Retain immutable legal snapshots in the opt-in disposable test database.
      await db.contest.deleteMany({
        where: { id: { in: contestIds }, legalDocumentId: null },
      });
      await db.product.deleteMany({ where: { id: { in: productIds } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.$disconnect();
    });
    async function winner(
      quantity = 2,
      mode: "AUTOMATIC" | "MANUAL" = "AUTOMATIC",
      prizePromoCodeId: string | null = null,
    ) {
      const contest = await contests.create({
        slug: `prize-${uid()}`,
        title: "Конкурс",
        description: "Задание",
        task: "Фото",
        rules: ["Одна работа"],
        appearance: "winter",
        prize: "Альбомы",
        prizeDetail: "На выбор",
        winnersCount: 1,
        selectionMode: mode,
        manualCriteria: mode === "MANUAL" ? "Соответствие теме" : "",
        manualTieBreak: mode === "MANUAL" ? "Решение организатора" : "",
        manualEvaluator: mode === "MANUAL" ? "Организатор" : "",
        published: true,
        opensAt: new Date(Date.now() - 900000).toISOString(),
        closesAt: new Date(Date.now() - 600000).toISOString(),
        drawAt: new Date(Date.now() - 300000).toISOString(),
        prizePromoCodeId,
        prizeAlbumQuantity: quantity,
        prizeAlbumIds: productIds,
      });
      contestIds.push(contest.id);
      const entry = await db.$transaction(async (tx) => {
        const entry = await tx.contestEntry.create({
          data: {
            id: uid(),
            publicId: randomBytes(12).toString("hex"),
            contestId: contest.id,
            userId: owner,
            status: "APPROVED",
            publishedAt: new Date(),
            contestSnapshot: {},
          },
        });
        await tx.contestEntryRevision.create({
          data: {
            id: uid(),
            entryId: entry.id,
            sequence: 1,
            productId: productIds[0]!,
            caption: "Работа",
            assets: {},
          },
        });
        return entry;
      });
      if (mode === "AUTOMATIC") await draws.selectAutomatic(contest.id);
      else {
        const roster = await draws.getAdmin(contest.id);
        await draws.selectManual(contest.id, owner, {
          rosterToken: roster.rosterToken!,
          entryIds: [entry.id],
        });
      }
      await prizes.issueAwards(owner);
      return await db.orderPrizeGrant.findFirstOrThrow({
        where: { award: { draw: { contestId: contest.id } } },
      });
    }
    async function template(type: "percentage" | "fixed" = "percentage") {
      const promo = await new PromocodesService(
        db as unknown as PrismaService,
      ).createAdmin({
        code: `TEST-${uid().slice(0, 20)}`,
        name: "Призовая скидка",
        type,
        basisPoints: type === "percentage" ? 1500 : null,
        amountKopecks: type === "fixed" ? 10000 : null,
        minSubtotalKopecks: 50000,
        isActive: true,
      });
      promoIds.push(promo.id);
      return promo;
    }
    const promoService = () =>
      new PromocodesService(db as unknown as PrismaService);
    const promoPrizes = () =>
      new ContestPromoPrizesService(db as unknown as PrismaService);
    async function promoOrder() {
      const id = uid();
      promoOrderIds.push(id);
      return db.order.create({
        data: {
          id,
          userId: owner,
          cartId: `promo-${id}`,
          customerName: "Победитель",
          customerPhone: "+79990000000",
          customerEmail: "prize@example.test",
          pickupPointId: "ozon-test",
          pickupPointTitle: "ПВЗ",
          pickupPointAddress: "Адрес",
          pickupPointWorkHours: "10–20",
          deliveryPrice: 0,
          paymentRedirectUrl: "/checkout",
          paymentMethod: "TBANK_ACQUIRING",
          itemsCount: 1,
          subtotal: 1000,
          total: 1000,
          discount: 0,
        },
      });
    }
    const input = () => ({
      productIds: productIds.slice(0, 2),
      customer: {
        name: "Иван Иванов",
        phone: "+7 (999) 000-00-00",
        email: "winner@example.test",
      },
      pickupPointId: "ozon-test-point",
      acceptedLegal: true,
      acceptedPersonalDataConsent: true,
    });
    async function http(
      path: string,
      user = owner,
      body?: unknown,
      csrf = true,
    ) {
      const response = await fetch(`${base}/orders/prizes${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          ...(user ? { authorization: `Bearer ${user}` } : {}),
          "content-type": "application/json",
          ...(csrf
            ? { "x-artmate-csrf": "1", "x-requested-with": "XMLHttpRequest" }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        body: (await response.json()) as OrderDTO,
      };
    }
    it("issues one entitlement per automatic and manual winner under concurrent retries", async () => {
      const a = await winner(),
        b = await winner(1, "MANUAL");
      await Promise.all(
        Array.from({ length: 6 }, () => prizes.issueAwards(owner)),
      );
      assert.equal(
        await db.orderPrizeGrant.count({
          where: { awardId: { in: [a.awardId, b.awardId] } },
        }),
        2,
      );
      assert.equal((await prizes.list(other)).available.length, 0);
    });
    it("requires authentication and hides another winner's entitlement", async () => {
      const grant = await winner();
      assert.equal((await http("", "")).status, 401);
      assert.equal((await http(`/${grant.id}`, other)).status, 404);
      assert.equal(
        (await http(`/${grant.id}/order`, other, input())).status,
        404,
      );
    });
    it("rejects quantity, duplicate and foreign products, missing consents, price injection and CSRF", async () => {
      const grant = await winner();
      for (const body of [
        { ...input(), productIds: [] },
        { ...input(), productIds: [productIds[0], productIds[0]] },
        { ...input(), productIds: [productIds[0], uid()] },
        { ...input(), acceptedLegal: false },
        { ...input(), total: 0 },
        { ...input(), delivery: { provider: "cdek" } },
      ]) {
        assert.equal(
          (await http(`/${grant.id}/order`, owner, body)).status,
          400,
        );
      }
      assert.equal(
        (await http(`/${grant.id}/order`, owner, input(), false)).status,
        403,
      );
      assert.equal(
        (
          await db.orderPrizeGrant.findUniqueOrThrow({
            where: { id: grant.id },
          })
        ).orderId,
        null,
      );
    });
    it("keeps the entitlement available after delivery failure and stock changes", async () => {
      const grant = await winner();
      deliveryFail = true;
      assert.equal(
        (await http(`/${grant.id}/order`, owner, input())).status,
        503,
      );
      deliveryFail = false;
      await db.product.update({
        where: { id: productIds[0] },
        data: { isOutOfStock: true },
      });
      assert.equal(
        (await http(`/${grant.id}/order`, owner, input())).status,
        409,
      );
      assert.equal(
        (
          await db.orderPrizeGrant.findUniqueOrThrow({
            where: { id: grant.id },
          })
        ).orderId,
        null,
      );
      assert.equal(
        (await prizes.get(owner, grant.id)).groups
          .flatMap((group) => group.products)
          .find((album) => album.id === productIds[0])?.available,
        false,
      );
      await db.product.update({
        where: { id: productIds[0] },
        data: { isOutOfStock: false },
      });
      await db.product.update({
        where: { id: productIds[0] },
        data: { status: "DRAFT", title: "Неопубликованное название" },
      });
      assert.equal(
        (await prizes.get(owner, grant.id)).groups
          .flatMap((group) => group.products)
          .some((album) => album.id === productIds[0]),
        false,
      );
      assert.equal(
        (await http(`/${grant.id}/order`, owner, input())).status,
        409,
      );
      assert.equal(
        (
          await db.orderPrizeGrant.findUniqueOrThrow({
            where: { id: grant.id },
          })
        ).orderId,
        null,
      );
      await db.product.update({
        where: { id: productIds[0] },
        data: { status: "PUBLISHED", title: "Альбом 0" },
      });
    });
    it("creates one zero-total order under concurrent submissions and leaves the cart intact", async () => {
      const grant = await winner();
      const before = await db.cartItem.findMany();
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          http(`/${grant.id}/order`, owner, input()),
        ),
      );
      assert.ok(
        results.every((result) => result.status === 201),
        JSON.stringify(results),
      );
      const ids = [...new Set(results.map((result) => result.body.id))];
      assert.equal(ids.length, 1);
      const order = await db.order.findUniqueOrThrow({
        where: { id: ids[0]! },
        include: { items: true, paymentEvents: true, paymentRecovery: true },
      });
      assert.equal(order.paymentStatus, "NOT_REQUIRED");
      assert.equal(order.paymentMethod, "CONTEST_PRIZE");
      assert.equal(order.crmStatus, "IN_PROGRESS");
      assert.equal(order.status, "FULFILLMENT_READY");
      assert.equal(Number(order.total), 0);
      assert.equal(Number(order.subtotal), 0);
      assert.equal(Number(order.deliveryPrice), 0);
      assert.equal(Number(order.sponsoredDeliveryPrice), 350);
      assert.equal(order.paidAt, null);
      assert.equal(order.paymentEvents.length, 0);
      assert.equal(order.paymentRecovery, null);
      assert.ok(
        order.items.every(
          (item) =>
            Number(item.price) === 0 &&
            Number(item.lineTotal) === 0 &&
            item.quantity === 1,
        ),
      );
      assert.deepEqual(await db.cartItem.findMany(), before);
      const calls = deliveryCalls;
      const replay = await http(`/${grant.id}/order`, owner, {
        ...input(),
        productIds: productIds.slice(1),
        pickupPointId: "changed-after-success",
      });
      assert.equal(replay.body.id, order.id);
      assert.equal(deliveryCalls, calls);
      const list = await prizes.list(owner);
      assert.ok(!list.available.some((item) => item.id === grant.id));
      assert.equal(
        list.history.find((item) => item.id === grant.id)?.orderId,
        order.id,
      );
      assert.equal(financialCalls, 0);
    });
    it("allows delivery/completion without bank payment and blocks paid statuses and financial accrual", async () => {
      const grant = await winner();
      const order = await prizes.redeem(owner, grant.id, input());
      await assert.rejects(
        storage.updateAdminOrderStatus(order.id, "paid", owner),
      );
      await assert.rejects(
        storage.updateAdminOrderStatus(order.id, "waiting_payment", owner),
      );
      await storage.updateAdminOrderStatus(order.id, "delivering", owner);
      await storage.updateAdminOrderStatus(order.id, "completed", owner);
      assert.equal(financialCalls, 0);
      assert.equal(
        (await storage.getOrder(order.id, owner)).payment.status,
        "not_required",
      );
    });
    it("tracks Ozon delivery and consumes completion once without paid facts or loyalty", async () => {
      const grant = await winner();
      const order = await prizes.redeem(owner, grant.id, input());
      const number = `0121544692-${Date.now()}-3`;
      await storage.updateAdminOrderOzonPostings(
        order.id,
        [{ number, scheme: "fbs" }],
        owner,
      );
      await storage.updateAdminOrderStatus(order.id, "delivering", owner);
      const request = await db.deliveryTrackingRequest.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      assert.equal(request.enabled, true);
      await db.deliveryCompletionEvent.create({
        data: {
          id: request.revision,
          orderId: order.id,
          externalNumbers: [number],
          observedAt: new Date(),
        },
      });
      assert.equal(
        await storage.applyDeliveryCompletion(request.revision, async () => {}),
        true,
      );
      assert.equal(
        await storage.applyDeliveryCompletion(request.revision, async () => {}),
        false,
      );
      const completed = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          completionFact: true,
          purchaseAccount: true,
          loyaltyReservation: true,
          affiliateCommission: true,
          paymentEvents: true,
        },
      });
      assert.equal(completed.crmStatus, "COMPLETED");
      assert.equal(completed.paymentStatus, "NOT_REQUIRED");
      assert.equal(completed.paidAt, null);
      assert.equal(completed.completionFact, null);
      assert.equal(completed.purchaseAccount, null);
      assert.equal(completed.loyaltyReservation, null);
      assert.equal(completed.affiliateCommission, null);
      assert.equal(completed.paymentEvents.length, 0);
      assert.equal(financialCalls, 0);
    });
    it("freezes album prizes after publication even when an older contest had no configured prize", async () => {
      const grant = await winner();
      const record = await db.contest.findFirstOrThrow({
        where: { draw: { prizeAwards: { some: { id: grant.awardId } } } },
      });
      const payload = {
        ...record,
        prizePlaces: [],
        opensAt: record.opensAt.toISOString(),
        closesAt: record.closesAt.toISOString(),
        drawAt: record.drawAt.toISOString(),
        appearance: "winter",
        selectionMode: record.selectionMode,
        prizeAlbumQuantity: 1,
        prizeAlbumIds: productIds,
      } as CreateContestRequestDTO;
      await assert.rejects(
        contests.update(record.id, { ...payload, version: record.version }),
        /зафиксирован/,
      );
      await db.contest.update({
        where: { id: record.id },
        data: { prizeAlbumQuantity: null, prizeAlbumIds: [] },
      });
      await assert.rejects(
        contests.update(record.id, { ...payload, version: record.version }),
        /зафиксирован/,
      );
      await assert.rejects(
        contests.update(record.id, {
          ...payload,
          prizeAlbumQuantity: 2,
          version: record.version,
        }),
        /зафиксирован/,
      );
    });
    it("issues distinct personal codes once for automatic and manual winners and keeps them private over HTTP", async () => {
      const source = await template();
      const first = await winner(1, "AUTOMATIC", source.id);
      const second = await winner(1, "MANUAL", source.id);
      await Promise.all(
        Array.from({ length: 6 }, () => promoPrizes().issueAwards(owner)),
      );
      const promos = await db.promoCode.findMany({
        where: { prizeAwardId: { in: [first.awardId, second.awardId] } },
      });
      assert.equal(promos.length, 2);
      assert.notEqual(promos[0]!.code, promos[1]!.code);
      assert.ok(
        promos.every(
          (p) =>
            p.recipientUserId === owner &&
            p.maxUses === 1 &&
            p.maxUsesPerUser === 1,
        ),
      );
      const own = await http("");
      const foreign = await http("", other);
      assert.equal(own.status, 200);
      assert.equal(foreign.status, 200);
      assert.ok(JSON.stringify(own.body).includes(promos[0]!.code));
      assert.ok(!JSON.stringify(foreign.body).includes(promos[0]!.code));
      assert.equal((await http(`/${promos[0]!.id}`, other)).status, 404);
    });
    it("checks the recipient for both pricing and transactional reservation", async () => {
      const source = await template("fixed");
      const grant = await winner(1, "AUTOMATIC", source.id);
      await promoPrizes().issueAwards(owner);
      const promo = await db.promoCode.findUniqueOrThrow({
        where: { prizeAwardId: grant.awardId },
      });
      const items = [
        { id: productIds[0]!, quantity: 1, unitPriceKopecks: 100000 },
      ];
      assert.equal(
        (
          await promoService().calculate({
            code: promo.code,
            userId: owner,
            items,
          })
        ).pricing.discountKopecks,
        10000,
      );
      for (const userId of [undefined, other]) {
        await assert.rejects(
          promoService().calculate({ code: promo.code, userId, items }),
          /только победителю/,
        );
        const order = await promoOrder();
        await assert.rejects(
          db.$transaction((tx) =>
            promoService().reserveInTransaction(tx, {
              code: promo.code,
              userId,
              items,
              orderId: order.id,
            }),
          ),
          /только победителю/,
        );
      }
      await assert.rejects(
        promoService().calculate({
          code: promo.code,
          userId: owner,
          items: [{ ...items[0]!, unitPriceKopecks: 40000 }],
        }),
        /минимальной/,
      );
      assert.equal(
        await db.promoRedemption.count({ where: { promoCodeId: promo.id } }),
        0,
      );
    });
    it("reserves a personal code in one order, restores it after release, and consumes it once after payment", async () => {
      const source = await template();
      const grant = await winner(1, "AUTOMATIC", source.id);
      await promoPrizes().issueAwards(owner);
      const promo = await db.promoCode.findUniqueOrThrow({
        where: { prizeAwardId: grant.awardId },
      });
      const orders = await Promise.all(
        Array.from({ length: 4 }, () => promoOrder()),
      );
      const items = [
        { id: productIds[0]!, quantity: 1, unitPriceKopecks: 100000 },
      ];
      const attempts = await Promise.allSettled(
        orders.map((order) =>
          db.$transaction((tx) =>
            promoService().reserveInTransaction(tx, {
              code: promo.code,
              userId: owner,
              items,
              orderId: order.id,
            }),
          ),
        ),
      );
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      const reserved = await db.promoRedemption.findFirstOrThrow({
        where: { promoCodeId: promo.id, status: "RESERVED" },
      });
      assert.equal(
        (await promoPrizes().list(owner)).find((p) => p.id === promo.id)
          ?.status,
        "reserved",
      );
      await db.$transaction((tx) =>
        promoService().releaseInTransaction(tx, reserved.orderId, {
          provider: "test",
          source: "test",
          actorId: owner,
        }),
      );
      assert.equal(
        (await promoPrizes().list(owner)).find((p) => p.id === promo.id)
          ?.status,
        "available",
      );
      const next = orders.find((o) => o.id !== reserved.orderId)!;
      await db.$transaction((tx) =>
        promoService().reserveInTransaction(tx, {
          code: promo.code,
          userId: owner,
          items,
          orderId: next.id,
        }),
      );
      await db.$transaction((tx) =>
        promoService().consumeInTransaction(tx, next.id, {
          provider: "test",
          source: "test",
        }),
      );
      await db.$transaction((tx) =>
        promoService().consumeInTransaction(tx, next.id, {
          provider: "test",
          source: "test",
        }),
      );
      const used = await db.promoCode.findUniqueOrThrow({
        where: { id: promo.id },
      });
      assert.equal(used.usedCount, 1);
      assert.equal(used.reservedCount, 0);
      assert.equal(
        (await promoPrizes().list(owner)).find((p) => p.id === promo.id)
          ?.status,
        "used",
      );
      await assert.rejects(
        promoService().calculate({ code: promo.code, userId: owner, items }),
        /исчерпан/,
      );
    });
    it("preserves promised terms after the source changes and locks the contest prize after entries", async () => {
      const source = await template();
      const grant = await winner(1, "AUTOMATIC", source.id);
      await db.promoCode.update({
        where: { id: source.id },
        data: { basisPoints: 3000, isActive: false },
      });
      await promoPrizes().issueAwards(owner);
      const promo = await db.promoCode.findUniqueOrThrow({
        where: { prizeAwardId: grant.awardId },
      });
      assert.equal(promo.basisPoints, 1500);
      assert.equal(promo.isActive, true);
      const record = await contests.getAdmin(
        (
          await db.contestPrizeAward.findUniqueOrThrow({
            where: { id: grant.awardId },
            include: { draw: true },
          })
        ).draw.contestId,
      );
      await assert.rejects(
        contests.update(record.id, { ...record, prizePromoCodeId: null }),
        /нельзя менять/,
      );
      await assert.rejects(
        promoService().updateAdmin(promo.id, { ...source, code: undefined }),
        /менять нельзя/,
      );
      await db.promoCode.update({
        where: { id: promo.id },
        data: { endsAt: new Date(Date.now() - 1000) },
      });
      const list = await prizes.list(owner);
      assert.ok(
        list.history.some(
          (p) =>
            p.id === promo.id &&
            p.kind === "promocode" &&
            p.status === "expired",
        ),
      );
      assert.ok(!list.available.some((p) => p.id === promo.id));
    });
    it("rejects inactive, welcome and expired templates and a draw moved past the promised expiry", async () => {
      const source = await template();
      const grant = await winner(1, "AUTOMATIC", source.id);
      const original = await db.contest.findFirstOrThrow({
        where: { draw: { prizeAwards: { some: { id: grant.awardId } } } },
      });
      const payload: CreateContestRequestDTO = {
        ...original,
        prizePlaces: [],
        slug: `promo-settings-${uid()}`,
        appearance: "winter",
        opensAt: original.opensAt.toISOString(),
        closesAt: original.closesAt.toISOString(),
        drawAt: original.drawAt.toISOString(),
      };
      await assert.rejects(
        contests.create({ ...payload, prizePromoCodeId: "welcome-artmstart" }),
        /активный обычный/,
      );
      await db.promoCode.update({
        where: { id: source.id },
        data: { isActive: false },
      });
      await assert.rejects(contests.create(payload), /активный обычный/);
      await db.promoCode.update({
        where: { id: source.id },
        data: {
          isActive: true,
          endsAt: new Date(original.drawAt.getTime() - 1000),
        },
      });
      await assert.rejects(contests.create(payload), /после подведения/);
      const expiry = new Date(Date.now() + 86400000);
      await db.promoCode.update({
        where: { id: source.id },
        data: { endsAt: expiry },
      });
      const saved = await contests.create(payload);
      contestIds.push(saved.id);
      await assert.rejects(
        contests.update(saved.id, {
          ...payload,
          version: saved.version,
          drawAt: new Date(expiry.getTime() + 1000).toISOString(),
        }),
        /После публикации/,
      );
    });

    async function configuredContest(
      prizeMode: "EQUAL" | "PLACES",
      participationId: string | null,
      winnerPromoId: string | null = null,
      deferThirdPlace = false,
    ) {
      const category = await db.productCategory.upsert({
        where: { slug: "markery" },
        update: {},
        create: { slug: "markery", title: "Маркеры" },
      });
      const marker = await db.product.create({
        data: {
          slug: `markers-${uid()}`,
          title: "Набор маркеров",
          status: "PUBLISHED",
          price: 100000,
          categoryId: category.id,
          isOzonDeliveryAvailable: true,
          images: { create: { url: "https://example.test/markers.jpg" } },
        },
      });
      productIds.push(marker.id);
      const place = (
        title: string,
        albumIds: string[],
        markerIds: string[],
        promoId: string | null = null,
      ) => ({
        prize: title,
        prizeDetail: "",
        prizeAlbumQuantity: albumIds.length ? 1 : null,
        prizeAlbumIds: albumIds,
        prizeMarkerQuantity: markerIds.length ? 1 : null,
        prizeMarkerIds: markerIds,
        prizePromoCodeId: promoId,
      });
      const places = [
        place("Маркеры", [], [marker.id], winnerPromoId),
        place("Котики", [productIds[0]!], []),
        deferThirdPlace
          ? { ...place("Новый альбом Artmate", [], []), deferredProduct: true }
          : place("Альбом на выбор", productIds.slice(1, 3), [], winnerPromoId),
      ];
      const contest = await contests.create({
        slug: `ranked-${uid()}`,
        title: "Конкурс с призами",
        description: "Работы",
        task: "Фото",
        rules: ["Одна работа"],
        appearance: "winter",
        prize: "Товарный приз",
        prizeDetail: "Альбомы и маркеры",
        published: true,
        selectionMode: prizeMode === "PLACES" ? "MANUAL" : "AUTOMATIC",
        manualCriteria: "Соответствие теме",
        manualTieBreak: "Сравнение композиции",
        manualEvaluator: "Artmate",
        opensAt: new Date(Date.now() - 900000).toISOString(),
        closesAt: new Date(Date.now() - 600000).toISOString(),
        drawAt: new Date(Date.now() - 300000).toISOString(),
        prizeMode,
        prizePlaces: prizeMode === "PLACES" ? places : [],
        winnersCount: prizeMode === "PLACES" ? 3 : 1,
        participationPromoCodeId: participationId,
        ...(prizeMode === "EQUAL"
          ? place("Альбом и маркеры", [productIds[0]!], [marker.id])
          : {}),
      });
      contestIds.push(contest.id);
      const entries = [];
      for (let i = 0; i < users.length; i++)
        entries.push(
          await db.$transaction(async (tx) => {
            const entry = await tx.contestEntry.create({
              data: {
                id: uid(),
                publicId: randomBytes(12).toString("hex"),
                contestId: contest.id,
                userId: users[i]!,
                status: i === 5 ? "REJECTED" : "APPROVED",
                publishedAt: new Date(),
                contestSnapshot: {},
              },
            });
            await tx.contestEntryRevision.create({
              data: {
                id: uid(),
                entryId: entry.id,
                sequence: 1,
                productId: productIds[0]!,
                caption: "Работа",
                assets: {},
              },
            });
            return entry;
          }),
        );
      return { contest, entries, marker };
    }
    it("assigns explicit manual places, freezes different prizes and issues consolation only to eligible non-winners", async () => {
      const winnerTemplate = await template(),
        participationTemplate = await template("fixed");
      const { contest, entries, marker } = await configuredContest(
        "PLACES",
        participationTemplate.id,
        winnerTemplate.id,
      );
      await db.contestEntry.update({
        where: { id: entries[4]!.id },
        data: { status: "PENDING" },
      });
      let roster = await draws.getAdmin(contest.id);
      const order = [entries[2]!.id, entries[0]!.id, entries[1]!.id];
      await assert.rejects(
        draws.selectManual(contest.id, owner, {
          rosterToken: roster.rosterToken!,
          entryIds: order,
        }),
        /Проверьте/,
      );
      await db.contestEntry.update({
        where: { id: entries[4]!.id },
        data: { status: "APPROVED", version: { increment: 1 } },
      });
      roster = await draws.getAdmin(contest.id);
      await Promise.all(
        [1, 2, 3].map(() =>
          draws.selectManual(contest.id, owner, {
            rosterToken: roster.rosterToken!,
            entryIds: order,
          }),
        ),
      );
      const result = (await draws.getAdmin(contest.id)).result!;
      assert.deepEqual(
        result.winners.map((winner) => ({
          entryId: winner.entryId,
          place: winner.place,
          title: winner.prizeTitle,
        })),
        order.map((entryId, index) => ({
          entryId,
          place: index + 1,
          title: ["Маркеры", "Котики", "Альбом на выбор"][index],
        })),
      );
      await assert.rejects(
        draws.selectManual(contest.id, owner, {
          rosterToken: roster.rosterToken!,
          entryIds: [...order].reverse(),
        }),
        /уже опубликован/,
      );
      const awards = await db.contestPrizeAward.findMany({
        where: { drawId: result.id },
      });
      assert.equal(awards.length, 5);
      assert.deepEqual(
        awards
          .filter((a) => a.kind === "PARTICIPATION")
          .map((a) => a.userId)
          .sort(),
        [users[3], users[4]].sort(),
      );
      assert.ok(!awards.some((a) => a.userId === users[5]));
      await db.promoCode.update({
        where: { id: winnerTemplate.id },
        data: { basisPoints: 7500, isActive: false },
      });
      await Promise.all(
        [1, 2, 3, 4].map(async () => {
          await prizes.issueAwards();
          await promoPrizes().issueAwards();
        }),
      );
      const grants = await db.orderPrizeGrant.findMany({
        where: { awardId: { in: awards.map((a) => a.id) } },
      });
      const codes = await db.promoCode.findMany({
        where: { prizeAwardId: { in: awards.map((a) => a.id) } },
      });
      assert.equal(grants.length, 3);
      assert.equal(codes.length, 4);
      assert.equal(new Set(codes.map((c) => c.code)).size, 4);
      assert.ok(
        codes
          .filter((c) => [users[1], users[2]].includes(c.recipientUserId!))
          .every((c) => c.basisPoints === 1500),
      );
      assert.ok(
        !(await prizes.list(users[3]!)).available.some(
          (p) => p.kind === "products" && p.contestSlug === contest.slug,
        ),
      );
      assert.ok(
        (await prizes.list(users[3]!)).available.some(
          (p) =>
            p.kind === "promocode" &&
            p.contestSlug === contest.slug &&
            p.award?.kind === "participation",
        ),
      );
      const first = grants.find((grant) => grant.place === 1)!;
      assert.equal(first.userId, users[2]);
      await assert.rejects(
        prizes.redeem(first.userId, first.id, {
          ...input(),
          productIds: [productIds[0]!],
        }),
        /каждой части/,
      );
      await assert.rejects(prizes.get(owner, first.id), /не найден/);
      const orders = await Promise.all(
        [1, 2, 3].map(() =>
          prizes.redeem(first.userId, first.id, {
            ...input(),
            productIds: [marker.id],
          }),
        ),
      );
      assert.equal(new Set(orders.map((order) => order.id)).size, 1);
      const saved = await db.order.findUniqueOrThrow({
        where: { id: orders[0]!.id },
        include: { items: true },
      });
      assert.equal(Number(saved.total), 0);
      assert.equal(Number(saved.deliveryPrice), 0);
      assert.equal(saved.paymentStatus, "NOT_REQUIRED");
      assert.deepEqual(
        saved.items.map((item) => item.productId),
        [marker.id],
      );
      const publicContest = await contests.getPublic(contest.slug);
      for (const code of codes)
        assert.ok(!JSON.stringify(publicContest).includes(code.code));
      const document = await db.contestLegalDocument.findUniqueOrThrow({
        where: { id: contest.legalDocumentId! },
      });
      const text = JSON.stringify(document.content);
      assert.match(text, /1-е место/);
      assert.match(text, /Приз за участие/);
      assert.match(text, /Маркеры/);
    });

    it("keeps one deferred prize visible until its free order can be claimed", async () => {
      const { contest, entries } = await configuredContest(
        "PLACES",
        null,
        null,
        true,
      );
      const roster = await draws.getAdmin(contest.id);
      await draws.selectManual(contest.id, owner, {
        rosterToken: roster.rosterToken!,
        entryIds: [entries[1]!.id, entries[2]!.id, entries[0]!.id],
      });
      const award = await db.contestPrizeAward.findFirstOrThrow({
        where: { draw: { contestId: contest.id }, userId: owner },
      });
      const [pending] = (await prizes.list(owner)).available.filter(
        (prize) => prize.contestSlug === contest.slug,
      );
      assert.deepEqual(pending, {
        id: award.id,
        kind: "pendingProduct",
        title: "Новый альбом Artmate",
        award: { kind: "place", place: 3 },
        contestTitle: contest.title,
        contestSlug: contest.slug,
        awardedAt: award.awardedAt.toISOString(),
      });
      assert.ok(
        !(await prizes.list(other)).available.some((p) => p.id === award.id),
      );
      const claim = { ...input(), productIds: [productIds[0]!] };
      assert.equal((await http(`/${award.id}`, owner)).status, 404);
      assert.equal(
        (await http(`/${award.id}/order`, owner, claim)).status,
        404,
      );

      const [, duringBinding] = await Promise.all([
        contests.bindPrizeProduct(contest.id, 3, productIds[0]!, owner),
        Promise.all(Array.from({ length: 6 }, () => prizes.list(owner))),
      ]);
      for (const list of duringBinding) {
        const matching = list.available.filter(
          (prize) => prize.contestSlug === contest.slug,
        );
        assert.deepEqual(
          matching.map((prize) => prize.id),
          [award.id],
        );
      }
      const [ready] = (await prizes.list(owner)).available.filter(
        (prize) => prize.contestSlug === contest.slug,
      );
      assert.ok(ready?.kind === "products");
      assert.equal(ready.id, award.id);
      assert.equal(ready.title, pending.title);
      assert.deepEqual(ready.award, pending.award);
      assert.deepEqual(
        ready.groups.flatMap((group) => group.products.map(({ id }) => id)),
        claim.productIds,
      );
      assert.equal(
        await db.orderPrizeGrant.count({ where: { awardId: award.id } }),
        1,
      );
      const order = await prizes.redeem(owner, ready.id, claim);
      assert.equal(Number(order.total), 0);
      const list = await prizes.list(owner);
      assert.ok(!list.available.some((prize) => prize.id === award.id));
      assert.ok(list.history.some((prize) => prize.id === award.id));
    });

    it("keeps automatic draw order stable and enforces independent quotas in a mixed free order", async () => {
      const { contest, marker } = await configuredContest("EQUAL", null);
      const results = await Promise.all(
        [1, 2, 3, 4].map(() => draws.selectAutomatic(contest.id)),
      );
      assert.equal(results.filter(Boolean).length, 1);
      const draw = await db.contestDraw.findUniqueOrThrow({
        where: { contestId: contest.id },
        include: { winners: true, prizeAwards: true },
      });
      assert.equal(draw.winners[0]!.place, null);
      assert.equal(draw.prizeAwards.length, 1);
      assert.deepEqual(
        (draw.selectionOrder as string[]).slice(0, 1),
        draw.winners.map((w) => w.entryId),
      );
      await prizes.issueAwards();
      const grant = await db.orderPrizeGrant.findUniqueOrThrow({
        where: { awardId: draw.prizeAwards[0]!.id },
      });
      await assert.rejects(
        prizes.redeem(grant.userId, grant.id, {
          ...input(),
          productIds: productIds.slice(0, 2),
        }),
        /каждой части/,
      );
      const order = await prizes.redeem(grant.userId, grant.id, {
        ...input(),
        productIds: [productIds[0]!, marker.id],
      });
      const saved = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      assert.equal(saved.items.length, 2);
      assert.equal(Number(saved.total), 0);
    });

    it("fills only the first places when there are fewer entries and creates no awards for an empty draw", async () => {
      const participation = await template();
      for (const count of [2, 0]) {
        const { contest, entries } = await configuredContest(
          "PLACES",
          participation.id,
        );
        await db.contestEntry.updateMany({
          where: {
            contestId: contest.id,
            id: { notIn: entries.slice(0, count).map((entry) => entry.id) },
          },
          data: { status: "REJECTED" },
        });
        const roster = await draws.getAdmin(contest.id);
        await draws.selectManual(contest.id, owner, {
          rosterToken: roster.rosterToken!,
          entryIds: entries.slice(0, count).map((entry) => entry.id),
        });
        const result = (await draws.getAdmin(contest.id)).result!;
        assert.deepEqual(
          result.winners.map((winner) => winner.place),
          Array.from({ length: count }, (_, index) => index + 1),
        );
        assert.equal(
          await db.contestPrizeAward.count({ where: { drawId: result.id } }),
          count,
        );
      }
    });
  },
);
