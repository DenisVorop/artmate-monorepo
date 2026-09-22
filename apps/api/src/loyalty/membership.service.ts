import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import {
  Prisma,
  type LoyaltyMember,
  type LoyaltyOperation,
  type LoyaltyWallet,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  EnrollLoyaltyDTO,
  LoyaltyDashboardDTO,
  LoyaltyHistoryDTO,
  LoyaltyHistoryQueryDTO,
  LoyaltyOverviewDTO,
} from "./dto";
import { readLoyaltyDashboard } from "./dashboard";

export const loyaltyTermsVersion = "loyalty-v1";
const memberInclude = { wallet: true } as const;

@Injectable()
export class LoyaltyMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string): Promise<LoyaltyDashboardDTO> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertActiveUser(tx, userId);
        const member = await tx.loyaltyMember.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!member) return { tier: null };
        return readLoyaltyDashboard(tx, userId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getMine(userId: string): Promise<LoyaltyOverviewDTO> {
    await this.assertActiveUser(this.prisma, userId);
    const member = await this.prisma.loyaltyMember.findUnique({
      where: { userId },
      include: memberInclude,
    });
    return overview(member);
  }

  async enroll(
    userId: string,
    input: EnrollLoyaltyDTO,
  ): Promise<LoyaltyOverviewDTO> {
    if (input.acceptedTerms !== true)
      throw new BadRequestException("Loyalty terms must be accepted");
    if (input.termsVersion !== loyaltyTermsVersion)
      throw new ConflictException("Loyalty terms have changed");
    return this.prisma.$transaction(async (tx) => {
      // Enrollment is opt-in and serialized with account mutations, never email lookup.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`,
      );
      await this.assertActiveUser(tx, userId);
      const existing = await tx.loyaltyMember.findUnique({
        where: { userId },
        include: memberInclude,
      });
      if (existing) return overview(existing);
      const member = await tx.loyaltyMember.create({
        data: {
          userId,
          termsVersion: loyaltyTermsVersion,
          wallet: { create: {} },
        },
        include: memberInclude,
      });
      // Domain history workers discover this opt-in through the database.
      // Purchase restoration alone must not mark all history READY or enable spending.
      return overview(member);
    });
  }

  async listOperations(
    userId: string,
    query: LoyaltyHistoryQueryDTO,
  ): Promise<LoyaltyHistoryDTO> {
    const limit = query.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException("Invalid history page size");
    let cursor: bigint | undefined;
    if (query.cursor !== undefined) {
      if (
        typeof query.cursor !== "string" ||
        !/^[1-9]\d{0,15}$/.test(query.cursor)
      )
        throw new BadRequestException("Invalid history cursor");
      cursor = BigInt(query.cursor);
      if (cursor > BigInt(Number.MAX_SAFE_INTEGER))
        throw new BadRequestException("Invalid history cursor");
    }
    await this.assertActiveUser(this.prisma, userId);
    const member = await this.prisma.loyaltyMember.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!member) return { items: [], nextCursor: null };
    const operations = await this.prisma.loyaltyOperation.findMany({
      where: {
        memberId: member.id,
        ...(cursor === undefined ? {} : { sequence: { lt: cursor } }),
      },
      orderBy: { sequence: "desc" },
      take: limit + 1,
    });
    const items = operations.slice(0, limit).map((operation) => ({
      id: operation.id,
      title: operationTitle(operation),
      sequence: safeNumber(operation.sequence),
      kind: operation.kind.toLowerCase(),
      balanceDelta: safeNumber(operation.balanceDelta),
      reservedDelta: safeNumber(operation.reservedDelta),
      balanceAfter: safeNumber(operation.balanceAfter),
      reservedAfter: safeNumber(operation.reservedAfter),
      occurredAt: operation.occurredAt.toISOString(),
      recordedAt: operation.recordedAt.toISOString(),
    }));
    return {
      items,
      nextCursor:
        operations.length > limit ? String(items.at(-1)!.sequence) : null,
    };
  }

  private async assertActiveUser(
    tx: Pick<Prisma.TransactionClient, "user">,
    userId: string,
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true, deletedAt: true },
    });
    if (!user || user.status !== "ACTIVE" || user.deletedAt)
      throw new ForbiddenException("Account is unavailable");
  }
}

function overview(
  member: (LoyaltyMember & { wallet: LoyaltyWallet | null }) | null,
): LoyaltyOverviewDTO {
  if (!member)
    return { enrolled: false, termsVersion: loyaltyTermsVersion, member: null };
  if (!member.wallet) throw new Error("Loyalty wallet is missing");
  const { balancePoints, reservedPoints, revision } = member.wallet;
  if (
    balancePoints < 0n ||
    reservedPoints < 0n ||
    reservedPoints > balancePoints ||
    revision < 0n
  )
    throw new Error("Loyalty wallet is inconsistent");
  return {
    enrolled: true,
    termsVersion: loyaltyTermsVersion,
    member: {
      id: member.id,
      termsVersion: member.termsVersion,
      joinedAt: member.joinedAt.toISOString(),
      status: member.status === "ACTIVE" ? "active" : "blocked",
      historyState:
        member.historyState === "READY"
          ? "ready"
          : member.historyState === "FAILED"
            ? "failed"
            : "pending",
      wallet: {
        balancePoints: safeNumber(balancePoints),
        reservedPoints: safeNumber(reservedPoints),
        availablePoints: safeNumber(balancePoints - reservedPoints),
        revision: safeNumber(revision),
      },
    },
  };
}

function safeNumber(value: bigint): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < -BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new RangeError("Loyalty value exceeds safe integer range");
  return Number(value);
}

function operationTitle(operation: LoyaltyOperation): string {
  switch (operation.kind) {
    case "RESERVE":
      return "Баллы зарезервированы для заказа";
    case "CONSUME":
      return "Оплата заказа баллами";
    case "RELEASE":
      return "Резерв баллов освобождён";
    case "RESTORE":
      return "Возврат потраченных баллов";
    case "REVERSAL":
      return operation.purchaseOrderId
        ? "Возврат начисленных за покупку баллов"
        : "Корректировка начисленных баллов";
    case "CREDIT":
      if (operation.achievementAwardId) return "Награда за достижение";
      if (operation.workRewardId) return "Награда за опубликованную работу";
      if (operation.purchaseOrderId) return "Баллы за покупку";
      return "Начисление баллов";
  }
}
