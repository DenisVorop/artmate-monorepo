import type { Prisma } from "../../generated/prisma/client";
import { mapPrizeAwardLabel } from "../../contests/contracts/prize-awards.publication";
/** Recipient-scoped read publication of issued codes and persisted redemption states. No issuance side effects. */
export async function readPersonalPrizeCodes(
  db: Pick<Prisma.TransactionClient, "promoCode">,
  userId: string,
) {
  const promos = await db.promoCode.findMany({
    where: { kind: "CONTEST_PRIZE", recipientUserId: userId },
    include: {
      prizeAward: { select: { kind: true, place: true } },
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
      ...(promo.prizeAward
        ? { award: mapPrizeAwardLabel(promo.prizeAward) }
        : {}),
      code: promo.code,
      contestTitle: promo.prizeContestTitle!,
      contestSlug: promo.prizeContestSlug!,
      awardedAt: promo.awardedAt!.toISOString(),
      status,
      discountPercent:
        promo.basisPoints === null ? null : promo.basisPoints / 100,
      amount:
        promo.amountKopecks === null ? null : Number(promo.amountKopecks) / 100,
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
