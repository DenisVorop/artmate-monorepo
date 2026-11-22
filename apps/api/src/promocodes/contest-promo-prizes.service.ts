import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { prizeAwardPublicationSelect } from "../contests/contracts/prize-awards.publication";
import { readPersonalPrizeCodes } from "./contracts/personal-prizes.publication";
import type { PromoPrizeTerms } from "./contracts/prize-template.publication";

@Injectable()
export class ContestPromoPrizesService {
  constructor(private readonly prisma: PrismaService) {}

  async issueAwards(userId?: string) {
    const winners = await this.prisma.contestPrizeAward.findMany({
      where: {
        promoPrize: { is: null },
        ...(userId ? { userId } : {}),
        promoTerms: { not: Prisma.DbNull },
      },
      select: prizeAwardPublicationSelect,
      take: 500,
      orderBy: { id: "asc" },
    });
    if (!winners.length) return 0;
    const result = await this.prisma.promoCode.createMany({
      skipDuplicates: true,
      data: winners.map((winner) => {
        // This JSON is written only from the validated promo template publication.
        const terms = winner.promoTerms as unknown as PromoPrizeTerms;
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
          prizeAwardId: winner.id,
          recipientUserId: winner.userId,
          prizeContestTitle: winner.contestTitle,
          prizeContestSlug: winner.contestSlug,
          awardedAt: winner.awardedAt,
        };
      }),
    });
    return result.count;
  }

  async list(userId: string) {
    await this.issueAwards(userId);
    return readPersonalPrizeCodes(this.prisma, userId);
  }
}
