import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types";
import {
  AffiliatePartnerStatus,
  AffiliatePayoutOperationKind,
  AffiliatePayoutStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { defaultMinimumPayoutKopecks } from "./affiliate.types";
import { AffiliatePayoutBalanceService } from "./affiliate-payout-balance.service";
import {
  parseCreatePayoutRequest,
  parseMarkPayoutPaidRequest,
  parseRejectPayoutRequest,
} from "./payout-request";

const payoutInclude = { events: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] } };

@Injectable()
export class AffiliatePayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: AffiliatePayoutBalanceService,
  ) {}

  async createOwnPayout(user: AuthUser, value: unknown) {
    this.assertPartnerRole(user);
    const input = parseCreatePayoutRequest(value);
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lockPartner(tx, user.id);
      this.assertActive(locked);
      const retry = await this.findIdempotent(tx, locked.partner.id, input.requestId, input.requestFingerprint, AffiliatePayoutOperationKind.CREATE);
      if (retry) return this.mapPayout(retry);
      const open = await tx.affiliatePayout.findFirst({ where: { partnerId: locked.partner.id, status: AffiliatePayoutStatus.PENDING } });
      if (open) conflict("affiliate_payout_open_request", "У партнёра уже есть заявка на рассмотрении");
      const balance = await this.balanceService.calculateInTransaction(tx, locked.partner.id);
      const minimum = locked.partner.minimumPayoutKopecks === null
        ? defaultMinimumPayoutKopecks
        : safeNumber(locked.partner.minimumPayoutKopecks, "Minimum payout");
      if (input.amountKopecks < minimum) conflict("affiliate_payout_below_minimum", "Сумма заявки ниже минимальной");
      if (balance.debtKopecks > 0 || input.amountKopecks > balance.availableKopecks) {
        conflict("affiliate_payout_unavailable_balance", "Запрошенная сумма недоступна для выплаты");
      }
      const payout = await tx.affiliatePayout.create({
        data: {
          partnerId: locked.partner.id,
          status: AffiliatePayoutStatus.PENDING,
          amountKopecks: BigInt(input.amountKopecks),
          minimumPayoutKopecks: BigInt(minimum),
          contractVersion: locked.partner.contractVersion,
          contractNumber: locked.partner.contractNumber,
          contractSignedAt: locked.partner.contractSignedAt,
          contractPaymentDetails: locked.partner.contractPaymentDetails,
        },
      });
      await tx.affiliatePayoutEvent.create({ data: { payoutId: payout.id, partnerId: locked.partner.id, status: AffiliatePayoutStatus.PENDING, actorUserId: user.id } });
      await tx.affiliatePayoutJournalEntry.create({ data: { payoutId: payout.id, partnerId: locked.partner.id, kind: "RESERVE", amountKopecks: BigInt(input.amountKopecks) } });
      await tx.affiliatePayoutOperation.create({ data: { payoutId: payout.id, partnerId: locked.partner.id, requestId: input.requestId, requestFingerprint: input.requestFingerprint, kind: AffiliatePayoutOperationKind.CREATE } });
      return this.mapPayout(await this.getPayout(tx, locked.partner.id, payout.id));
    });
  }

  async listOwnPayouts(user: AuthUser, page: number, pageSize: number) {
    this.assertPartnerRole(user);
    return this.listPayouts(user.id, page, pageSize, true);
  }

  listAdminPayouts(userId: string, page: number, pageSize: number) {
    return this.listPayouts(userId, page, pageSize, false);
  }

  async markPaid(userId: string, payoutId: string, value: unknown, actor: AuthUser) {
    const input = parseMarkPayoutPaidRequest(value);
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lockPartner(tx, userId, actor.id);
      const retry = await this.findIdempotent(tx, locked.partner.id, input.requestId, input.requestFingerprint, AffiliatePayoutOperationKind.PAY, payoutId);
      if (retry) return this.mapPayout(retry);
      this.assertActive(locked);
      const payout = await this.getPayout(tx, locked.partner.id, payoutId);
      if (payout.status !== AffiliatePayoutStatus.PENDING) conflict("affiliate_payout_invalid_status", "Заявка уже завершена");
      const now = new Date();
      if (input.paidAt.getTime() < payout.createdAt.getTime() || input.paidAt.getTime() > now.getTime()) {
        throw new ConflictException({ code: "affiliate_payout_invalid_status", message: "Дата выплаты недопустима" });
      }
      const balance = await this.balanceService.calculateInTransaction(tx, locked.partner.id);
      if (balance.debtKopecks > 0) conflict("affiliate_payout_unavailable_balance", "Резерв заявки больше обеспеченного баланса");
      const duplicate = await tx.affiliatePayout.findFirst({ where: { partnerId: locked.partner.id, reference: input.reference } });
      if (duplicate) conflict("affiliate_payout_duplicate_reference", "Номер выплаты уже использован");
      await tx.affiliatePayout.update({ where: { id: payout.id }, data: { status: AffiliatePayoutStatus.PAID, paidAt: input.paidAt, reference: input.reference } });
      await tx.affiliatePayoutEvent.create({ data: { payoutId, partnerId: locked.partner.id, status: AffiliatePayoutStatus.PAID, actorUserId: actor.id } });
      await tx.affiliatePayoutJournalEntry.create({ data: { payoutId, partnerId: locked.partner.id, kind: "PAY", amountKopecks: payout.amountKopecks } });
      await tx.affiliatePayoutOperation.create({ data: { payoutId, partnerId: locked.partner.id, requestId: input.requestId, requestFingerprint: input.requestFingerprint, kind: AffiliatePayoutOperationKind.PAY } });
      return this.mapPayout(await this.getPayout(tx, locked.partner.id, payoutId));
    });
  }

  async reject(userId: string, payoutId: string, value: unknown, actor: AuthUser) {
    const input = parseRejectPayoutRequest(value);
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lockPartner(tx, userId, actor.id);
      const retry = await this.findIdempotent(tx, locked.partner.id, input.requestId, input.requestFingerprint, AffiliatePayoutOperationKind.REJECT, payoutId);
      if (retry) return this.mapPayout(retry);
      const payout = await this.getPayout(tx, locked.partner.id, payoutId);
      if (payout.status !== AffiliatePayoutStatus.PENDING) conflict("affiliate_payout_invalid_status", "Заявка уже завершена");
      await tx.affiliatePayout.update({ where: { id: payout.id }, data: { status: AffiliatePayoutStatus.REJECTED, reason: input.reason } });
      await tx.affiliatePayoutEvent.create({ data: { payoutId, partnerId: locked.partner.id, status: AffiliatePayoutStatus.REJECTED, actorUserId: actor.id, reason: input.reason } });
      await tx.affiliatePayoutJournalEntry.create({ data: { payoutId, partnerId: locked.partner.id, kind: "RELEASE", amountKopecks: payout.amountKopecks } });
      await tx.affiliatePayoutOperation.create({ data: { payoutId, partnerId: locked.partner.id, requestId: input.requestId, requestFingerprint: input.requestFingerprint, kind: AffiliatePayoutOperationKind.REJECT } });
      return this.mapPayout(await this.getPayout(tx, locked.partner.id, payoutId));
    });
  }

  async cancelPendingInTransaction(tx: Prisma.TransactionClient, partnerId: string, reason: string) {
    const payout = await tx.affiliatePayout.findFirst({ where: { partnerId, status: AffiliatePayoutStatus.PENDING } });
    if (!payout) return;
    const [clock] = await tx.$queryRaw<Array<{ now: Date }>>(
      Prisma.sql`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "now"`,
    );
    if (!clock) throw new Error("Could not capture affiliate payout cancellation time");
    await tx.affiliatePayout.update({ where: { id: payout.id }, data: { status: AffiliatePayoutStatus.CANCELLED, reason } });
    await tx.affiliatePayoutEvent.create({ data: { payoutId: payout.id, partnerId, status: AffiliatePayoutStatus.CANCELLED, reason, createdAt: clock.now } });
    await tx.affiliatePayoutJournalEntry.create({ data: { payoutId: payout.id, partnerId, kind: "RELEASE", amountKopecks: payout.amountKopecks, createdAt: clock.now } });
  }

  private async listPayouts(userId: string, page: number, pageSize: number, requireActive: boolean) {
    const offset = getOffset(page, pageSize);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const partner = await tx.affiliatePartner.findUnique({ where: { userId }, include: { user: { select: { roles: true, status: true } } } });
      if (!partner) throw new NotFoundException("Affiliate partner not found");
      if (requireActive && (partner.status !== AffiliatePartnerStatus.ACTIVE || partner.user.status !== UserStatus.ACTIVE || !partner.user.roles.includes(UserRole.PARTNER))) {
        throw new ForbiddenException("Active partner profile required");
      }
      const asOf = new Date();
      const [items, total, balance, open] = await Promise.all([
        tx.affiliatePayout.findMany({ where: { partnerId: partner.id }, include: payoutInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: offset, take: pageSize }),
        tx.affiliatePayout.count({ where: { partnerId: partner.id } }),
        this.balanceService.calculateInTransaction(tx, partner.id),
        tx.affiliatePayout.findFirst({ where: { partnerId: partner.id, status: AffiliatePayoutStatus.PENDING }, select: { id: true } }),
      ]);
      const minimumPayoutKopecks = partner.minimumPayoutKopecks === null ? defaultMinimumPayoutKopecks : safeNumber(partner.minimumPayoutKopecks, "Minimum payout");
      const active = partner.status === AffiliatePartnerStatus.ACTIVE && partner.user.status === UserStatus.ACTIVE && partner.user.roles.includes(UserRole.PARTNER);
      const blockedReason = !active ? "partner_inactive" : open ? "open_request" : balance.debtKopecks > 0 ? "debt" : balance.availableKopecks === 0 ? "no_available_balance" : balance.availableKopecks < minimumPayoutKopecks ? "below_minimum" : null;
      return {
        summary: {
          asOf: asOf.toISOString(),
          availableKopecks: balance.availableKopecks,
          reservedKopecks: balance.reservedKopecks,
          paidKopecks: balance.paidKopecks,
          debtKopecks: balance.debtKopecks,
          minimumPayoutKopecks,
          canRequest: blockedReason === null,
          blockedReason,
        },
        items: items.map((item) => this.mapPayout(item)), total, page, pageSize,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async lockPartner(tx: Prisma.TransactionClient, userId: string, actorUserId = userId) {
    const userIds = [...new Set([userId, actorUserId])].sort();
    const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "users" WHERE "id" IN (${Prisma.join(userIds)}) ORDER BY "id" FOR UPDATE`,
    );
    if (!lockedUsers.some((entry) => entry.id === userId)) throw new NotFoundException("Affiliate partner not found");
    const candidate = await tx.affiliatePartner.findUnique({ where: { userId }, select: { id: true } });
    if (!candidate) throw new NotFoundException("Affiliate partner not found");
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "affiliate_partners" WHERE "id" = ${candidate.id} FOR UPDATE`);
    const [user, partner] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { id: true, roles: true, status: true } }),
      tx.affiliatePartner.findUnique({ where: { id: candidate.id } }),
    ]);
    if (!user || !partner) throw new NotFoundException("Affiliate partner not found");
    return { user, partner };
  }

  private assertActive(locked: Awaited<ReturnType<AffiliatePayoutsService["lockPartner"]>>) {
    if (locked.user.status !== UserStatus.ACTIVE || !locked.user.roles.includes(UserRole.PARTNER) || locked.partner.status !== AffiliatePartnerStatus.ACTIVE) {
      throw new ForbiddenException("Active partner profile required");
    }
  }

  private assertPartnerRole(user: AuthUser) {
    if (!user.roles.includes("partner")) throw new ForbiddenException("Active partner profile required");
  }

  private async findIdempotent(tx: Prisma.TransactionClient, partnerId: string, requestId: string, fingerprint: string, kind: AffiliatePayoutOperationKind, payoutId?: string) {
    const operation = await tx.affiliatePayoutOperation.findUnique({ where: { partnerId_requestId: { partnerId, requestId } } });
    if (!operation) return undefined;
    if (operation.requestFingerprint !== fingerprint || operation.kind !== kind || (payoutId && operation.payoutId !== payoutId)) {
      conflict("affiliate_payout_request_conflict", "requestId уже использован с другими данными");
    }
    return this.getPayout(tx, partnerId, operation.payoutId);
  }

  private async getPayout(tx: Prisma.TransactionClient, partnerId: string, payoutId: string) {
    const payout = await tx.affiliatePayout.findFirst({ where: { id: payoutId, partnerId }, include: payoutInclude });
    if (!payout) throw new NotFoundException("Affiliate payout not found");
    return payout;
  }

  private mapPayout(payout: Awaited<ReturnType<AffiliatePayoutsService["getPayout"]>>) {
    return {
      id: payout.id,
      status: payout.status.toLowerCase(),
      amountKopecks: safeNumber(payout.amountKopecks, "Payout amount"),
      minimumPayoutKopecks: safeNumber(payout.minimumPayoutKopecks, "Payout minimum"),
      createdAt: payout.createdAt.toISOString(), updatedAt: payout.updatedAt.toISOString(),
      paidAt: payout.paidAt?.toISOString() ?? null, reference: payout.reference, reason: payout.reason,
      contract: { version: payout.contractVersion, number: payout.contractNumber, signedAt: payout.contractSignedAt.toISOString(), paymentDetails: payout.contractPaymentDetails },
      events: payout.events.map((event) => ({ id: event.id, status: event.status.toLowerCase(), createdAt: event.createdAt.toISOString(), actorUserId: event.actorUserId, reason: event.reason })),
    };
  }
}

function conflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}

function safeNumber(value: bigint, label: string) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new RangeError(`${label} is outside the safe range`);
  return result;
}

function getOffset(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > 2_147_483_647) {
    throw new BadRequestException("Pagination offset is too large");
  }
  return offset;
}
