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

  async creditWorkInTransaction(
    tx: Prisma.TransactionClient,
    input: { rewardId: string },
  ): Promise<LoyaltyWalletResult> {
    validateText(input.rewardId, 200, "rewardId");
    const reward = await tx.loyaltyWorkReward.findUnique({
      where: { id: input.rewardId },
      include: { publicationFact: true },
    });
    if (!reward) throw new NotFoundException("Loyalty work reward not found");
    const { member, wallet } = await this.lock(tx, reward.memberId);
    const key = `coloring:${member.id}:${reward.coloringId}`;
    const command: LoyaltyWalletCommand = {
      memberId: member.id,
      operationKey: key,
      sourceKey: key,
      rulesVersion: reward.rulesVersion,
      occurredAt: reward.occurredAt,
    };
    validateCommand(command);
    if (
      reward.points !== 25 ||
      reward.rulesVersion !== "work-v1" ||
      reward.publicationFact.ownerId !== member.userId ||
      reward.publicationFact.coloringId !== reward.coloringId ||
      reward.occurredAt.getTime() !==
        reward.publicationFact.qualifiedAt.getTime()
    )
      throw new ConflictException(
        "Work reward does not match publication fact",
      );
    const replay = await this.replay(
      tx,
      command,
      "CREDIT",
      25n,
      null,
      null,
      null,
      reward.id,
    );
    if (replay) return replay;
    const user = await tx.user.findUnique({ where: { id: member.userId } });
    if (
      member.status !== "ACTIVE" ||
      member.historyState === "FAILED" ||
      !user ||
      user.status !== "ACTIVE" ||
      user.deletedAt
    )
      throw new ConflictException("Work reward member is not eligible");
    return this.record(
      tx,
      command,
      wallet,
      "CREDIT",
      25n,
      25n,
      0n,
      null,
      null,
      null,
      reward.id,
    );
  }

  async creditAchievementInTransaction(
    tx: Prisma.TransactionClient,
    input: { awardId: string },
  ): Promise<LoyaltyWalletResult> {
    validateText(input.awardId, 200, "awardId");
    const award = await tx.loyaltyAchievementAward.findUnique({
      where: { id: input.awardId },
      include: {
        revision: true,
        publicationFact: true,
        completionManifest: { include: { items: true } },
        completionOrder: true,
      },
    });
    if (!award) throw new NotFoundException("Achievement award not found");
    const points = validatePoints(award.points);
    const { member, wallet } = await this.lock(tx, award.memberId);
    const key = `achievement:${member.id}:${award.definitionId}`;
    const command: LoyaltyWalletCommand = {
      memberId: member.id,
      operationKey: key,
      sourceKey: key,
      rulesVersion: "achievement-v1",
      occurredAt: award.awardedAt,
    };
    validateCommand(command);
    const completion = award.completionManifest;
    const publication = award.publicationFact;
    const orderCompletion = award.completionOrder;
    const completesOrder =
      award.revision.conditionKind === "completed_order_count";
    const completesCollection =
      award.revision.conditionKind === "completed_collection_count";
    const expectedQualifiedAt =
      completesOrder && orderCompletion
        ? orderCompletion.qualifiedAt.getTime()
        : completesCollection && completion && publication
          ? Math.max(
              completion.capturedAt.getTime(),
              publication.qualifiedAt.getTime(),
            )
          : publication?.qualifiedAt.getTime();
    if (
      award.points !== award.revision.rewardPoints ||
      ![
        "published_coloring_count",
        "distinct_collection_count",
        "completed_collection_count",
        "completed_order_count",
      ].includes(award.revision.conditionKind) ||
      (completesOrder
        ? !orderCompletion ||
          orderCompletion.userId !== member.userId ||
          publication !== null ||
          completion !== null
        : !publication ||
          publication.ownerId !== member.userId ||
          orderCompletion !== null) ||
      award.qualifiedAt.getTime() !== expectedQualifiedAt ||
      (completesCollection
        ? !completion ||
          !publication ||
          publication.collectionId !== completion.collectionId ||
          !completion.items.some(
            (item) => item.coloringId === publication.coloringId,
          )
        : award.completionCollectionId !== null)
    )
      throw new ConflictException(
        "Achievement award does not match its revision and source proof",
      );
    const replay = await this.replay(
      tx,
      command,
      "CREDIT",
      points,
      null,
      null,
      null,
      null,
      award.id,
    );
    if (replay) return replay;
    const user = await tx.user.findUnique({ where: { id: member.userId } });
    if (
      member.status !== "ACTIVE" ||
      member.historyState === "FAILED" ||
      !user ||
      user.status !== "ACTIVE" ||
      user.deletedAt
    ) {
      throw new ConflictException("Achievement member is not eligible");
    }
    return this.record(
      tx,
      command,
      wallet,
      "CREDIT",
      points,
      points,
      0n,
      null,
      null,
      null,
      null,
      award.id,
    );
  }

  async creditPurchaseInTransaction(
    tx: Prisma.TransactionClient,
    input: { orderId: string },
  ): Promise<LoyaltyWalletResult> {
    validateText(input.orderId, 32, "orderId");
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
    const account = await tx.loyaltyPurchaseAccount.findUnique({
      where: { orderId: input.orderId },
    });
    if (!account)
      throw new NotFoundException("Loyalty purchase account not found");
    const { member, wallet } = await this.lock(tx, account.memberId);
    const points = validatePoints(Number(account.grantedPoints));
    const command: LoyaltyWalletCommand = {
      memberId: account.memberId,
      operationKey: `purchase:${account.orderId}:credit`,
      sourceKey: `purchase:${account.orderId}`,
      rulesVersion: account.rulesVersion,
      occurredAt: account.occurredAt,
    };
    validateCommand(command);
    const replay = await this.replay(
      tx,
      command,
      "CREDIT",
      points,
      null,
      null,
      account.orderId,
    );
    if (replay) return replay;
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    const user = await tx.user.findUnique({ where: { id: member.userId } });
    const historyAuthorized =
      member.historyState === "READY" ||
      (member.historyState === "PENDING" &&
        (
          await tx.$queryRaw<Array<{ authorized: boolean }>>`
            SELECT EXISTS (
              SELECT 1 FROM loyalty_purchase_history_syncs
              WHERE member_id = ${member.id}
                AND active_transaction_id = txid_current()
            ) AS authorized
          `
        )[0]?.authorized === true);
    if (
      !order ||
      order.userId !== member.userId ||
      order.paymentStatus !== "PAID" ||
      !order.paidAt ||
      order.crmStatus !== "COMPLETED" ||
      !order.completedAt ||
      member.status !== "ACTIVE" ||
      !historyAuthorized ||
      !user ||
      user.status !== "ACTIVE" ||
      user.deletedAt
    )
      throw new ConflictException("Purchase reward is not eligible");
    return this.record(
      tx,
      command,
      wallet,
      "CREDIT",
      points,
      points,
      0n,
      null,
      null,
      account.orderId,
    );
  }

  async reversePurchaseInTransaction(
    tx: Prisma.TransactionClient,
    input: { orderId: string; points: number; refundedKopecks: bigint },
  ): Promise<LoyaltyWalletResult> {
    validateText(input.orderId, 32, "orderId");
    const points = validatePoints(input.points);
    assertSafe(input.refundedKopecks);
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
    const account = await tx.loyaltyPurchaseAccount.findUnique({
      where: { orderId: input.orderId },
    });
    if (!account)
      throw new NotFoundException("Loyalty purchase account not found");
    const { member, wallet } = await this.lock(tx, account.memberId);
    const operationKey = `purchase:${account.orderId}:reversal:${input.refundedKopecks}`;
    const existing = await tx.loyaltyOperation.findUnique({
      where: { operationKey },
    });
    const refunds = await tx.orderRefund.findMany({
      where: { orderId: input.orderId, event: { isNot: null } },
      select: { totalKopecks: true, deliveryKopecks: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const command: LoyaltyWalletCommand = {
      memberId: account.memberId,
      operationKey,
      sourceKey: `purchase:${account.orderId}`,
      rulesVersion: account.rulesVersion,
      // A retry remains tied to its original published refund even after later refunds.
      occurredAt:
        existing?.occurredAt ?? refunds[0]?.createdAt ?? account.occurredAt,
    };
    validateCommand(command);
    const replay = await this.replay(
      tx,
      command,
      "REVERSAL",
      points,
      null,
      null,
      account.orderId,
    );
    if (replay) return replay;
    const refundedKopecks = refunds.reduce(
      (sum, refund) => sum + refund.totalKopecks - refund.deliveryKopecks,
      0n,
    );
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (
      !order ||
      order.userId !== member.userId ||
      order.paymentStatus !== "PAID" ||
      !order.paidAt ||
      !refunds.length ||
      refundedKopecks !== input.refundedKopecks ||
      refundedKopecks <= account.refundedKopecks ||
      refundedKopecks > account.baseKopecks
    )
      throw new ConflictException(
        "Purchase reversal does not match published refunds",
      );
    const remainingReward =
      ((account.baseKopecks - refundedKopecks) *
        BigInt(account.ratePercent) *
        5n +
        9999n) /
      10000n;
    const target =
      remainingReward < account.grantedPoints
        ? remainingReward
        : account.grantedPoints;
    if (points !== account.grantedPoints - account.reversedPoints - target) {
      throw new ConflictException(
        "Purchase reversal amount does not match remaining reward",
      );
    }
    const available = wallet.balancePoints - wallet.reservedPoints;
    const removed = points < available ? points : available;
    return this.record(
      tx,
      command,
      wallet,
      "REVERSAL",
      points,
      -removed,
      0n,
      null,
      null,
      account.orderId,
    );
  }

  async restoreRefundInTransaction(
    tx: Prisma.TransactionClient,
    input: { refundId: string },
  ): Promise<LoyaltyWalletResult> {
    validateText(input.refundId, 32, "refundId");
    const refund = await tx.orderRefund.findUnique({
      where: { id: input.refundId },
    });
    if (!refund) throw new NotFoundException("Order refund not found");
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${refund.orderId} FOR UPDATE`;
    const reservation = await tx.loyaltyReservation.findUnique({
      where: { orderId: refund.orderId },
    });
    if (!reservation)
      throw new ConflictException("Refund has no loyalty reservation");
    const { member, wallet } = await this.lock(tx, reservation.memberId);
    assertSafe(refund.loyaltyPoints);
    if (refund.loyaltyPoints === 0n)
      throw new ConflictException("Refund has no spent points to restore");
    const command: LoyaltyWalletCommand = {
      memberId: member.id,
      operationKey: `refund:${refund.id}:restore`,
      sourceKey: `refund:${refund.id}`,
      rulesVersion: "order-spend-v1",
      occurredAt: refund.createdAt,
    };
    validateCommand(command);
    const replay = await this.replay(
      tx,
      command,
      "RESTORE",
      refund.loyaltyPoints,
      reservation.id,
      refund.id,
    );
    if (replay) return replay;
    const order = await tx.order.findUnique({ where: { id: refund.orderId } });
    if (
      !order ||
      order.checkoutActorUserId !== member.userId ||
      order.paymentStatus !== "PAID" ||
      !order.paidAt
    ) {
      throw new ConflictException(
        "Loyalty refund requires the original paid checkout actor",
      );
    }
    if (reservation.status !== "CONSUMED") {
      throw new ConflictException(
        "Loyalty refund requires a consumed reservation",
      );
    }
    assertSafe(reservation.points);
    const aggregate = await tx.loyaltyOperation.aggregate({
      where: { reservationId: reservation.id, kind: "RESTORE" },
      _sum: { requestedPoints: true },
    });
    const restoredPoints = aggregate._sum.requestedPoints ?? 0n;
    assertSafe(restoredPoints);
    if (restoredPoints + refund.loyaltyPoints > reservation.points) {
      throw new ConflictException(
        "Loyalty refund exceeds originally spent points",
      );
    }
    return this.record(
      tx,
      command,
      wallet,
      "RESTORE",
      refund.loyaltyPoints,
      refund.loyaltyPoints,
      0n,
      reservation.id,
      refund.id,
    );
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
    const available = wallet.balancePoints - wallet.reservedPoints;
    const removed = points < available ? points : available;
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
    refundId: string | null = null,
    purchaseOrderId: string | null = null,
    workRewardId: string | null = null,
    achievementAwardId: string | null = null,
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
      operation.refundId !== refundId ||
      operation.purchaseOrderId !== purchaseOrderId ||
      (operation.workRewardId ?? null) !== workRewardId ||
      (operation.achievementAwardId ?? null) !== achievementAwardId ||
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
    refundId: string | null = null,
    purchaseOrderId: string | null = null,
    workRewardId: string | null = null,
    achievementAwardId: string | null = null,
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
          refundId,
          purchaseOrderId,
          workRewardId,
          achievementAwardId,
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
