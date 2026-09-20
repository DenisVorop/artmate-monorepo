import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  Prisma,
  type LoyaltyOperation,
  type LoyaltyWallet,
} from "../generated/prisma/client";

export type LoyaltyWalletCommand = {
  memberId: string;
  operationKey: string;
  sourceKey: string;
  rulesVersion: string;
  occurredAt: Date;
};
export type LoyaltyPointsCommand = LoyaltyWalletCommand & { points: number };
export type LoyaltyReserveCommand = LoyaltyPointsCommand & { orderId: string };
export type LoyaltySettlementCommand = LoyaltyWalletCommand & {
  orderId: string;
};
export type LoyaltyWalletResult = {
  operation: LoyaltyOperation;
  replayed: boolean;
};

const maxPoints = BigInt(Number.MAX_SAFE_INTEGER);

/** Internal commands only. The caller owns the transaction and source verification. */
@Injectable()
export class LoyaltyWalletService {
  async creditInTransaction(
    tx: Prisma.TransactionClient,
    input: LoyaltyPointsCommand,
  ): Promise<LoyaltyWalletResult> {
    return this.adjust(tx, input, "CREDIT");
  }

  async reverseInTransaction(
    tx: Prisma.TransactionClient,
    input: LoyaltyPointsCommand,
  ): Promise<LoyaltyWalletResult> {
    return this.adjust(tx, input, "REVERSAL");
  }

  async reserveInTransaction(
    tx: Prisma.TransactionClient,
    input: LoyaltyReserveCommand,
  ): Promise<LoyaltyWalletResult> {
    validateCommand(input);
    validateText(input.orderId, 32, "orderId");
    const points = validatePoints(input.points);
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
    const { member, wallet } = await this.lock(tx, input.memberId);
    const reservation = await tx.loyaltyReservation.findUnique({
      where: { orderId: input.orderId },
    });
    const replay = await this.replay(
      tx,
      input,
      "RESERVE",
      points,
      reservation?.id ?? null,
    );
    if (replay) return replay;
    if (member.status !== "ACTIVE" || member.historyState !== "READY") {
      throw new ConflictException(
        "Loyalty member is not ready to spend points",
      );
    }
    if (reservation)
      throw new ConflictException("Order already has a loyalty reservation");
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.checkoutActorUserId !== member.userId) {
      throw new ConflictException(
        "Order does not belong to this checkout actor",
      );
    }
    if (
      order.paymentStatus !== "PENDING" ||
      order.status !== "PENDING_PAYMENT" ||
      order.paidAt ||
      order.terminalPaymentFailedAt ||
      order.crmStatus === "CANCELLED"
    ) {
      throw new ConflictException("Order is not awaiting payment");
    }
    if (points > wallet.balancePoints - wallet.reservedPoints) {
      throw new ConflictException("Insufficient available loyalty points");
    }
    const created = await tx.loyaltyReservation.create({
      data: { orderId: input.orderId, memberId: input.memberId, points },
    });
    return this.record(
      tx,
      input,
      wallet,
      "RESERVE",
      points,
      0n,
      points,
      created.id,
    );
  }

  async consumeInTransaction(
    tx: Prisma.TransactionClient,
    input: LoyaltySettlementCommand,
  ): Promise<LoyaltyWalletResult> {
    return this.settle(tx, input, "CONSUME");
  }

  async releaseInTransaction(
    tx: Prisma.TransactionClient,
    input: LoyaltySettlementCommand,
  ): Promise<LoyaltyWalletResult> {
    return this.settle(tx, input, "RELEASE");
  }

  private async adjust(
    tx: Prisma.TransactionClient,
    input: LoyaltyPointsCommand,
    kind: "CREDIT" | "REVERSAL",
  ): Promise<LoyaltyWalletResult> {
    validateCommand(input);
    const points = validatePoints(input.points);
    const { member, wallet } = await this.lock(tx, input.memberId);
    const replay = await this.replay(tx, input, kind, points, null);
    if (replay) return replay;
    if (kind === "CREDIT" && member.status !== "ACTIVE") {
      throw new ConflictException("Loyalty member is blocked");
    }
    const removed =
      points < wallet.balancePoints ? points : wallet.balancePoints;
    if (
      kind === "REVERSAL" &&
      removed > wallet.balancePoints - wallet.reservedPoints
    ) {
      throw new ConflictException(
        "Loyalty correction conflicts with reserved points",
      );
    }
    return this.record(
      tx,
      input,
      wallet,
      kind,
      points,
      kind === "CREDIT" ? points : -removed,
      0n,
      null,
    );
  }

  private async settle(
    tx: Prisma.TransactionClient,
    input: LoyaltySettlementCommand,
    kind: "CONSUME" | "RELEASE",
  ): Promise<LoyaltyWalletResult> {
    validateCommand(input);
    validateText(input.orderId, 32, "orderId");
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
    const { wallet } = await this.lock(tx, input.memberId);
    const reservation = await tx.loyaltyReservation.findUnique({
      where: { orderId: input.orderId },
    });
    if (!reservation || reservation.memberId !== input.memberId) {
      throw new NotFoundException("Loyalty reservation not found");
    }
    assertSafe(reservation.points);
    if (reservation.points <= 0n)
      throw new ConflictException("Invalid loyalty reservation points");
    const replay = await this.replay(
      tx,
      input,
      kind,
      reservation.points,
      reservation.id,
    );
    if (replay) return replay;
    if (reservation.status !== "RESERVED") {
      throw new ConflictException("Loyalty reservation is already settled");
    }
    if (reservation.points > wallet.reservedPoints)
      throw new ConflictException("Invalid loyalty reserved balance");
    await tx.loyaltyReservation.update({
      where: { id: reservation.id },
      data: { status: kind === "CONSUME" ? "CONSUMED" : "RELEASED" },
    });
    return this.record(
      tx,
      input,
      wallet,
      kind,
      reservation.points,
      kind === "CONSUME" ? -reservation.points : 0n,
      -reservation.points,
      reservation.id,
    );
  }

  private async lock(tx: Prisma.TransactionClient, memberId: string) {
    await tx.$queryRaw`SELECT id FROM loyalty_members WHERE id = ${memberId} FOR UPDATE`;
    const member = await tx.loyaltyMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException("Loyalty member not found");
    const wallet = await tx.loyaltyWallet.findUnique({ where: { memberId } });
    if (!wallet) throw new ConflictException("Loyalty wallet not found");
    assertSafe(wallet.balancePoints);
    assertSafe(wallet.reservedPoints);
    assertSafe(wallet.revision);
    if (wallet.reservedPoints > wallet.balancePoints)
      throw new ConflictException("Invalid loyalty wallet balance");
    return { member, wallet };
  }

  private async replay(
    tx: Prisma.TransactionClient,
    input: LoyaltyWalletCommand,
    kind: LoyaltyOperation["kind"],
    points: bigint,
    reservationId: string | null,
  ): Promise<LoyaltyWalletResult | null> {
    const operation = await tx.loyaltyOperation.findUnique({
      where: { operationKey: input.operationKey },
    });
    if (!operation) return null;
    if (
      operation.memberId !== input.memberId ||
      operation.kind !== kind ||
      operation.requestedPoints !== points ||
      operation.reservationId !== reservationId ||
      operation.sourceKey !== input.sourceKey ||
      operation.rulesVersion !== input.rulesVersion ||
      operation.occurredAt.getTime() !== input.occurredAt.getTime()
    ) {
      throw new ConflictException(
        "Loyalty operation key belongs to a different command",
      );
    }
    return { operation, replayed: true };
  }

  private async record(
    tx: Prisma.TransactionClient,
    input: LoyaltyWalletCommand,
    wallet: LoyaltyWallet,
    kind: LoyaltyOperation["kind"],
    requestedPoints: bigint,
    balanceDelta: bigint,
    reservedDelta: bigint,
    reservationId: string | null,
  ): Promise<LoyaltyWalletResult> {
    const balanceAfter = wallet.balancePoints + balanceDelta;
    const reservedAfter = wallet.reservedPoints + reservedDelta;
    const sequence = wallet.revision + 1n;
    assertSafe(balanceAfter);
    assertSafe(reservedAfter);
    assertSafe(sequence);
    if (reservedAfter > balanceAfter)
      throw new ConflictException("Invalid loyalty operation balance");
    try {
      const operation = await tx.loyaltyOperation.create({
        data: {
          kind,
          requestedPoints,
          balanceDelta,
          reservedDelta,
          balanceAfter,
          reservedAfter,
          sequence,
          reservationId,
          // Only the command identity is persisted, not points/order transport fields.
          memberId: input.memberId,
          operationKey: input.operationKey,
          sourceKey: input.sourceKey,
          rulesVersion: input.rulesVersion,
          occurredAt: input.occurredAt,
        },
      });
      await tx.loyaltyWallet.update({
        where: { memberId: input.memberId },
        data: {
          balancePoints: balanceAfter,
          reservedPoints: reservedAfter,
          revision: sequence,
        },
      });
      return { operation, replayed: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Loyalty operation key is already in use");
      }
      throw error;
    }
  }
}

function validateCommand(input: LoyaltyWalletCommand) {
  validateText(input.memberId, 200, "memberId");
  validateText(input.operationKey, 200, "operationKey");
  validateText(input.sourceKey, 200, "sourceKey");
  validateText(input.rulesVersion, 64, "rulesVersion");
  if (
    !(input.occurredAt instanceof Date) ||
    !Number.isFinite(input.occurredAt.getTime())
  )
    throw new BadRequestException("Invalid loyalty occurredAt");
}

function validateText(value: string, maxLength: number, name: string) {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > maxLength ||
    value.trim() !== value
  )
    throw new BadRequestException(`Invalid loyalty ${name}`);
}

function validatePoints(points: number): bigint {
  if (!Number.isSafeInteger(points) || points <= 0)
    throw new BadRequestException(
      "Loyalty points must be a positive safe integer",
    );
  return BigInt(points);
}

function assertSafe(value: bigint) {
  if (typeof value !== "bigint" || value < 0n || value > maxPoints)
    throw new ConflictException("Loyalty balance exceeds safe integer bounds");
}
