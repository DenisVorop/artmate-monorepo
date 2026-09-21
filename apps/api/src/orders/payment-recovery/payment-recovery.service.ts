import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";

import type { Order, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type PaymentRecoveryResult = {
  state: "paid" | "closed_unpaid" | "pending" | "attention";
  reason?: string;
};
export type PaymentRecoveryLease = { orderId: string; leaseToken: string };
const maximumAttempts = 12;
const leaseMs = 120_000;
const reasons = new Set([
  "provider_pending",
  "provider_unavailable",
  "provider_error",
  "payment_not_found",
  "payment_ambiguous",
  "amount_mismatch",
  "identity_mismatch",
  "unsupported_provider",
  "retry_limit",
  "lease_expired",
  "closure_unconfirmed",
]);

@Injectable()
export class PaymentRecoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async claimNext(): Promise<PaymentRecoveryLease | null> {
    return this.prisma.$transaction(async (tx) => {
      for (let cleaned = 0; cleaned < 20; cleaned += 1) {
        // Lock order first, matching source publishers.
        // SKIP LOCKED allows independent workers without holding locks during HTTP.
        const candidates = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT o.id FROM orders o JOIN order_payment_recoveries job ON job.order_id = o.id
        WHERE (job.status = 'pending' AND job.next_attempt_at <= clock_timestamp())
          OR (job.status = 'checking' AND job.locked_until <= clock_timestamp())
        ORDER BY job.next_attempt_at, job.order_id
        LIMIT 1 FOR UPDATE OF o SKIP LOCKED
      `;
        const orderId = candidates[0]?.id;
        if (!orderId) return null;
        const job = await tx.orderPaymentRecovery.findUnique({
          where: { orderId },
        });
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!job || !order) return null;
        const now = await databaseNow(tx);
        if (
          (job.status !== "PENDING" && job.status !== "CHECKING") ||
          (job.status === "PENDING" &&
            job.nextAttemptAt.getTime() > now.getTime()) ||
          (job.status === "CHECKING" &&
            (!job.lockedUntil || job.lockedUntil.getTime() > now.getTime()))
        )
          return null;
        if (isFinal(order)) {
          await tx.orderPaymentRecovery.update({
            where: { orderId },
            data: {
              status: "RESOLVED",
              finishedAt: now,
              leaseToken: null,
              lockedUntil: null,
              lastError: null,
            },
          });
          continue;
        }
        if (job.attempts >= maximumAttempts) {
          await tx.orderPaymentRecovery.update({
            where: { orderId },
            data: {
              status: "ATTENTION",
              leaseToken: null,
              lockedUntil: null,
              lastError: "retry_limit",
            },
          });
          continue;
        }
        const leaseToken = randomUUID();
        await tx.orderPaymentRecovery.update({
          where: { orderId },
          data: {
            status: "CHECKING",
            attempts: { increment: 1 },
            leaseToken,
            lockedUntil: new Date(now.getTime() + leaseMs),
            finishedAt: null,
          },
        });
        return { orderId, leaseToken };
      }
      return null;
    });
  }

  async settle(
    lease: PaymentRecoveryLease,
    result: PaymentRecoveryResult,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${lease.orderId} FOR UPDATE`;
      const now = await databaseNow(tx);
      const job = await tx.orderPaymentRecovery.findUnique({
        where: { orderId: lease.orderId },
      });
      if (
        !job ||
        job.status !== "CHECKING" ||
        job.leaseToken !== lease.leaseToken ||
        !job.lockedUntil ||
        job.lockedUntil.getTime() <= now.getTime()
      )
        return false;
      const order = await tx.order.findUnique({ where: { id: lease.orderId } });
      if (!order) throw new NotFoundException("Order not found");
      // A worker response cannot manufacture a final fact or overwrite a newer one.
      const final = isFinal(order);
      const exhausted = job.attempts >= maximumAttempts;
      const attention =
        result.state === "attention" ||
        exhausted ||
        (!final &&
          (result.state === "paid" || result.state === "closed_unpaid"));
      const reason = exhausted
        ? "retry_limit"
        : sanitizeReason(
            result.reason ??
              (result.state === "pending"
                ? "provider_pending"
                : "provider_error"),
          );
      const delayMs = Math.min(
        60_000 * 2 ** Math.min(Math.max(job.attempts - 1, 0), 6),
        3_600_000,
      );
      await tx.orderPaymentRecovery.update({
        where: { orderId: lease.orderId },
        data: {
          status: final ? "RESOLVED" : attention ? "ATTENTION" : "PENDING",
          lastCheckedAt: now,
          nextAttemptAt: new Date(now.getTime() + delayMs),
          finishedAt: final ? now : null,
          leaseToken: null,
          lockedUntil: null,
          lastError: final ? null : reason,
        },
      });
      return true;
    });
  }
}

async function databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
  const [result] = await tx.$queryRaw<
    Array<{ now: Date }>
  >`SELECT clock_timestamp() AS now`;
  if (
    !result ||
    !(result.now instanceof Date) ||
    !Number.isFinite(result.now.getTime())
  )
    throw new Error("Database clock is unavailable");
  return result.now;
}

function isFinal(order: Order) {
  return (
    order.paymentStatus === "PAID" ||
    order.paymentStatus === "CLOSED_UNPAID" ||
    order.paidAt !== null
  );
}

function sanitizeReason(reason: string) {
  return reasons.has(reason) ? reason : "provider_error";
}
