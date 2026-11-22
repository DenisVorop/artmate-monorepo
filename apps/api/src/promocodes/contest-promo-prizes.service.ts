import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { promoPrizeWinnerPublicationSelect } from "../contests/contracts/promo-prize-winners.publication";
import type { PromoPrizeTerms } from "./contracts/prize-template.publication";

@Injectable()
export class ContestPromoPrizesService {
  constructor(private readonly prisma: PrismaService) {}

  async issueForWinners(userId?: string) {
    const winners = await this.prisma.contestDrawWinner.findMany({
      where: {
        promoPrize: { is: null },
        ...(userId ? { entry: { userId } } : {}),
        draw: { contest: { prizePromoTerms: { not: Prisma.DbNull } } },
      },
      select: promoPrizeWinnerPublicationSelect,
      take: 500,
      orderBy: { id: "asc" },
    });
    if (!winners.length) return 0;
    const result = await this.prisma.promoCode.createMany({
      skipDuplicates: true,
      data: winners.map((winner) => {
        const contest = winner.draw.contest;
        // This JSON is written only from the validated promo template publication.
        const terms = contest.prizePromoTerms as unknown as PromoPrizeTerms;
        return {
          code: `PRIZE-${randomBytes(12).toString("hex").toUpperCase()}`,
          kind: "CONTEST_PRIZE" as const,
          name: terms.name,
          type: terms.type,
          basisPoints: terms.basisPoints,
          amountKopecks:
            terms.amountKopecks === null ? null : BigInt(terms.amountKopecks),
          maxDiscountKopecks:
            terms.maxDiscountKopecks === null
              ? null
              : BigInt(terms.maxDiscountKopecks),
          minSubtotalKopecks: BigInt(terms.minSubtotalKopecks),
          startsAt: terms.startsAt ? new Date(terms.startsAt) : null,
          endsAt: terms.endsAt ? new Date(terms.endsAt) : null,
          maxUses: 1,
          maxUsesPerUser: 1,
          isActive: true,
          prizeWinnerId: winner.id,
          recipientUserId: winner.entry.userId,
          prizeContestTitle: contest.title,
          prizeContestSlug: contest.slug,
          awardedAt: winner.draw.createdAt,
        };
      }),
    });
    return result.count;
  }

  async list(userId: string) {
    await this.issueForWinners(userId);
    const promos = await this.prisma.promoCode.findMany({
      where: { kind: "CONTEST_PRIZE", recipientUserId: userId },
      include: {
        redemptions: {
          where: { status: { in: ["RESERVED", "USED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, orderId: true, usedAt: true },
        },
      },
      orderBy: [{ awardedAt: "desc" }, { id: "desc" }],
    });
    return promos.map((promo) => {
      const redemption = promo.redemptions[0];
      const now = Date.now();
      const status =
        redemption?.status === "USED"
          ? "used"
          : redemption?.status === "RESERVED"
            ? "reserved"
            : !promo.isActive
              ? "disabled"
              : promo.endsAt && promo.endsAt.getTime() <= now
                ? "expired"
                : promo.startsAt && promo.startsAt.getTime() > now
                  ? "upcoming"
                  : "available";
      return {
        id: promo.id,
        kind: "promocode" as const,
        code: promo.code,
        contestTitle: promo.prizeContestTitle!,
        contestSlug: promo.prizeContestSlug!,
        awardedAt: promo.awardedAt!.toISOString(),
        status,
        discountPercent:
          promo.basisPoints === null ? null : promo.basisPoints / 100,
        amount:
          promo.amountKopecks === null
            ? null
            : Number(promo.amountKopecks) / 100,
        maxDiscount:
          promo.maxDiscountKopecks === null
            ? null
            : Number(promo.maxDiscountKopecks) / 100,
        minSubtotal: Number(promo.minSubtotalKopecks) / 100,
        startsAt: promo.startsAt?.toISOString() ?? null,
        endsAt: promo.endsAt?.toISOString() ?? null,
        orderId: redemption?.orderId ?? null,
        usedAt: redemption?.usedAt?.toISOString() ?? null,
      };
    });
  }
}
