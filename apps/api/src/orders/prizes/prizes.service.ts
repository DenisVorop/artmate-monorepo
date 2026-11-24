import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import {
  prizeAwardPublicationSelect,
  mapProductPrizeAward,
  mapPrizeAwardLabel,
  readPrizeGroups,
} from "../../contests/contracts/prize-awards.publication";
import { PrismaService } from "../../prisma/prisma.service";
import { DeliveryService } from "../../delivery/delivery.service";
import { OrdersStorage } from "../orders.storage";
import {
  isPrizeProductAvailable,
  mapPrizeProduct,
  prizeProductInclude,
} from "./catalog";
import type { CreatePrizeOrderRequestDTO } from "./prize-order.dto";
import { readPersonalPrizeCodes } from "../../promocodes/contracts/personal-prizes.publication";

@Injectable()
export class OrderPrizesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryService,
    private readonly orders: OrdersStorage,
  ) {}

  // Finalized awards are the contests publication.
  // Orders consumes it idempotently, and owns all subsequent grant/order writes.
  async issueAwards(userId?: string) {
    const winners = await this.prisma.contestPrizeAward.findMany({
      where: {
        productPrize: { is: null },
        ...(userId ? { userId } : {}),
        NOT: { productGroups: { equals: [] } },
      },
      select: prizeAwardPublicationSelect,
      take: 500,
      orderBy: { id: "asc" },
    });
    if (!winners.length) return 0;
    const result = await this.prisma.orderPrizeGrant.createMany({
      data: winners.map(mapProductPrizeAward),
      skipDuplicates: true,
    });
    return result.count;
  }

  async list(userId: string) {
    await this.issueAwards(userId);
    const promoPrizes = await readPersonalPrizeCodes(this.prisma, userId);
    // Read pending awards before grants so concurrent issuance can only produce overlap.
    const pendingAwards = await this.prisma.contestPrizeAward.findMany({
      where: { userId, deferredProduct: true, productPrize: { is: null } },
      select: {
        id: true,
        title: true,
        place: true,
        contestTitle: true,
        contestSlug: true,
        awardedAt: true,
      },
      orderBy: [{ awardedAt: "desc" }, { id: "desc" }],
    });
    const grants = await this.prisma.orderPrizeGrant.findMany({
      where: { userId },
      orderBy: [{ awardedAt: "desc" }, { id: "desc" }],
      include: { order: { include: { items: true } } },
    });
    const issuedAwardIds = new Set(grants.map((grant) => grant.awardId));
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: [
            ...new Set(
              grants.flatMap((grant) =>
                readPrizeGroups(grant.productGroups).flatMap(
                  (group) => group.productIds,
                ),
              ),
            ),
          ],
        },
        status: "PUBLISHED",
      },
      include: prizeProductInclude,
    });
    return {
      available: [
        ...grants
          .filter((grant) => !grant.orderId)
          .map((grant) => this.mapGrant(grant, products)),
        ...pendingAwards
          .filter((award) => !issuedAwardIds.has(award.id))
          .map((award) => ({
            id: award.id,
            kind: "pendingProduct" as const,
            title: award.title,
            award: mapPrizeAwardLabel(award),
            contestTitle: award.contestTitle,
            contestSlug: award.contestSlug,
            awardedAt: award.awardedAt.toISOString(),
          })),
        ...promoPrizes.filter((p) =>
          ["available", "upcoming", "reserved"].includes(p.status),
        ),
      ],
      history: [
        ...grants
          .filter((grant) => grant.order)
          .map((grant) => ({
            id: grant.id,
            kind: "products" as const,
            title: grant.title,
            award: mapPrizeAwardLabel(grant),
            contestTitle: grant.contestTitle,
            contestSlug: grant.contestSlug,
            usedAt: grant.redeemedAt!.toISOString(),
            orderId: grant.orderId!,
            awardedAt: grant.awardedAt.toISOString(),
            products: grant.order!.items.map((item) => ({
              id: item.productId,
              title: item.title,
              image: item.image,
              available: false,
            })),
          })),
        ...promoPrizes.filter((p) =>
          ["used", "expired", "disabled"].includes(p.status),
        ),
      ],
    };
  }

  async get(userId: string, id: string) {
    await this.issueAwards(userId);
    const grant = await this.grant(this.prisma, userId, id);
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: readPrizeGroups(grant.productGroups).flatMap(
            (group) => group.productIds,
          ),
        },
        status: "PUBLISHED",
      },
      include: prizeProductInclude,
    });
    return this.mapGrant(grant, products);
  }

  async redeem(userId: string, id: string, input: CreatePrizeOrderRequestDTO) {
    // Controller validates DTOs; these invariants also guard internal callers.
    if (
      input.acceptedLegal !== true ||
      input.acceptedPersonalDataConsent !== true
    )
      throw new BadRequestException(
        "Подтвердите согласие с условиями оформления",
      );
    const grant = await this.grant(this.prisma, userId, id);
    // A retry always returns the original order, even if a browser changed its draft.
    if (grant.orderId) return this.orders.getOrder(grant.orderId, userId);
    this.assertSelection(grant, input.productIds);
    let quote: Awaited<
      ReturnType<DeliveryService["calculatePickupPointDelivery"]>
    >;
    try {
      quote = await this.delivery.calculatePickupPointDelivery(
        { provider: "ozon", pickupPointId: input.pickupPointId },
        [],
      );
    } catch (error) {
      if (error instanceof BadRequestException)
        throw new BadRequestException(
          "Этот пункт выдачи Ozon недоступен. Выберите другой",
        );
      throw new ServiceUnavailableException(
        "Не удалось проверить пункт выдачи Ozon. Попробуйте ещё раз",
      );
    }
    if (
      quote.provider !== "ozon" ||
      quote.pickupPoint.id !== input.pickupPointId ||
      !quote.pickupPoint.address ||
      !Number.isFinite(quote.deliveryPrice) ||
      quote.deliveryPrice < 0
    )
      throw new BadRequestException("Выберите другой пункт выдачи Ozon");
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({ ...input, productIds: [...input.productIds].sort() }),
      )
      .digest("hex");
    const orderId = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM order_prize_grants WHERE id = ${id} FOR UPDATE`;
        const current = await this.grant(tx, userId, id);
        if (current.orderId) return current.orderId;
        this.assertSelection(current, input.productIds);
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM products WHERE id IN (${Prisma.join([...input.productIds].sort())}) ORDER BY id FOR SHARE`,
        );
        const products = await tx.product.findMany({
          where: { id: { in: input.productIds } },
          include: prizeProductInclude,
        });
        if (
          products.length !== input.productIds.length ||
          products.some(
            (product) =>
              !isPrizeProductAvailable(
                product,
                readPrizeGroups(current.productGroups).find((group) =>
                  group.productIds.includes(product.id),
                )!.kind,
              ),
          )
        )
          throw new ConflictException(
            "Один из товаров сейчас недоступен. Измените выбор",
          );
        const newOrderId = `prize_${randomUUID().replaceAll("-", "").slice(0, 26)}`;
        await tx.order.create({
          data: {
            id: newOrderId,
            userId,
            checkoutActorUserId: userId,
            // Dedicated immutable source, never a customer's cart or cart cookie.
            cartId: `prize:${current.id}`,
            checkoutAttemptId: `prize:${current.id}`,
            checkoutPayloadFingerprint: fingerprint,
            status: "FULFILLMENT_READY",
            crmStatus: "IN_PROGRESS",
            customerName: input.customer.name.trim(),
            customerPhone: input.customer.phone.trim(),
            customerEmail: input.customer.email.trim(),
            deliveryProvider: "OZON",
            pickupPointId: quote.pickupPoint.id,
            pickupPointTitle: quote.pickupPoint.title,
            pickupPointAddress: quote.pickupPoint.address,
            pickupPointWorkHours: quote.pickupPoint.workHours,
            deliveryPrice: 0,
            sponsoredDeliveryPrice: quote.deliveryPrice,
            paymentMethod: "CONTEST_PRIZE",
            paymentStatus: "NOT_REQUIRED",
            paymentRedirectUrl: "/account/orders",
            subtotal: 0,
            discount: 0,
            total: 0,
            itemsCount: products.length,
            currency: "RUB",
            comment: input.comment?.trim() || null,
            items: {
              create: products.map((product) => ({
                productId: product.id,
                title: product.title,
                slug: product.slug,
                category: product.category?.title,
                categorySlug: product.category?.slug,
                image: product.images[0]?.url ?? "",
                quantity: 1,
                price: 0,
                lineTotal: 0,
              })),
            },
            history: {
              create: {
                authorId: userId,
                eventType: "prize_order_created",
                payload: {
                  prizeId: current.id,
                  awardId: current.awardId,
                  acceptedLegal: true,
                  acceptedPersonalDataConsent: true,
                  toStatus: "in_progress",
                },
              },
            },
          },
        });
        await tx.orderPrizeGrant.update({
          where: { id: current.id },
          data: {
            orderId: newOrderId,
            checkoutFingerprint: fingerprint,
            redeemedAt: new Date(),
          },
        });
        return newOrderId;
      },
      { timeout: 15_000 },
    );
    return this.orders.getOrder(orderId, userId);
  }

  private assertSelection(
    grant: { productGroups: Prisma.JsonValue },
    ids: string[],
  ) {
    const groups = readPrizeGroups(grant.productGroups);
    const allowed = groups.flatMap((group) => group.productIds);
    if (
      !groups.length ||
      !Array.isArray(ids) ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !allowed.includes(id)) ||
      groups.some(
        (group) =>
          ids.filter((id) => group.productIds.includes(id)).length !==
          group.quantity,
      )
    )
      throw new BadRequestException("Выберите товары для каждой части приза");
  }
  private async grant(
    db: Pick<Prisma.TransactionClient, "orderPrizeGrant">,
    userId: string,
    id: string,
  ) {
    const grant = await db.orderPrizeGrant.findFirst({ where: { id, userId } });
    if (!grant) throw new NotFoundException("Приз не найден");
    return grant;
  }
  private mapGrant(
    grant: {
      id: string;
      title: string;
      awardKind: string;
      place: number | null;
      contestTitle: string;
      contestSlug: string;
      productGroups: Prisma.JsonValue;
      awardedAt: Date;
      orderId: string | null;
    },
    products: Parameters<typeof mapPrizeProduct>[0][],
  ) {
    return {
      id: grant.id,
      kind: "products" as const,
      title: grant.title,
      award: mapPrizeAwardLabel(grant),
      contestTitle: grant.contestTitle,
      contestSlug: grant.contestSlug,
      awardedAt: grant.awardedAt.toISOString(),
      orderId: grant.orderId,
      groups: readPrizeGroups(grant.productGroups).map((group) => ({
        kind: group.kind,
        quantity: group.quantity,
        products: group.productIds.flatMap((id) => {
          const product = products.find((item) => item.id === id);
          return product ? [mapPrizeProduct(product, group.kind)] : [];
        }),
      })),
    };
  }
}
