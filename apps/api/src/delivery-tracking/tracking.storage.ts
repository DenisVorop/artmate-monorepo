import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "../generated/prisma/client";

export type TrackingLease = {
  orderId: string;
  revision: string;
  externalNumbers: string[];
  leaseToken: string;
};
export type PostingState = {
  externalNumber: string;
  state: "pending" | "in_transit" | "delivered" | "cancelled" | "unknown";
};

const checkIntervalMs = 5 * 60 * 1000;
// At most 50 sequential requests, each with an 8-second timeout.
const leaseDurationMs = 10 * 60 * 1000;

@Injectable()
export class TrackingStorage {
  constructor(private readonly prisma: PrismaService) {}

  async claimNext(): Promise<TrackingLease | null> {
    return this.prisma.$transaction(async (tx) => {
      const [request] = await tx.$queryRaw<
        Array<{ orderId: string; revision: string; externalNumbers: string[] }>
      >`
        SELECT r.order_id AS "orderId", r.revision, r.external_numbers AS "externalNumbers"
        FROM delivery_tracking_requests r
        LEFT JOIN delivery_tracking_observations o ON o.order_id = r.order_id
        WHERE r.enabled AND r.provider = 'ozon' AND cardinality(r.external_numbers) > 0
          AND (o.order_id IS NULL OR o.revision <> r.revision OR
            (NOT o.all_delivered AND o.next_check_at <= clock_timestamp()
              AND (o.locked_until IS NULL OR o.locked_until <= clock_timestamp())))
        ORDER BY COALESCE(o.next_check_at, r.updated_at), r.order_id
        LIMIT 1 FOR UPDATE OF r SKIP LOCKED
      `;
      if (!request) return null;
      const leaseToken = randomUUID();
      const now = await databaseNow(tx);
      const lease = { ...request, leaseToken };
      await tx.deliveryTrackingObservation.upsert({
        where: { orderId: request.orderId },
        create: {
          orderId: request.orderId,
          revision: request.revision,
          leaseToken,
          lockedUntil: new Date(now.getTime() + leaseDurationMs),
        },
        update: {
          revision: request.revision,
          leaseToken,
          lockedUntil: new Date(now.getTime() + leaseDurationMs),
          allDelivered: false,
          states: [],
          checkedAt: null,
          lastError: null,
        },
      });
      return lease;
    });
  }

  async settle(
    lease: TrackingLease,
    states: PostingState[] | null,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT order_id FROM delivery_tracking_requests WHERE order_id = ${lease.orderId} FOR UPDATE`;
      const request = await tx.deliveryTrackingRequest.findUnique({
        where: { orderId: lease.orderId },
      });
      const observation = await tx.deliveryTrackingObservation.findUnique({
        where: { orderId: lease.orderId },
      });
      const now = await databaseNow(tx);
      if (
        !request?.enabled ||
        request.revision !== lease.revision ||
        observation?.leaseToken !== lease.leaseToken ||
        !observation.lockedUntil ||
        observation.lockedUntil <= now
      )
        return false;

      const matches =
        states !== null &&
        states.length === request.externalNumbers.length &&
        new Set(states.map((state) => state.externalNumber)).size ===
          states.length &&
        request.externalNumbers.every((number) =>
          states.some((state) => state.externalNumber === number),
        );
      const allDelivered =
        matches && states.every((state) => state.state === "delivered");
      await tx.deliveryTrackingObservation.update({
        where: { orderId: lease.orderId },
        data: {
          states: matches ? states : [],
          allDelivered,
          checkedAt: now,
          nextCheckAt: new Date(now.getTime() + checkIntervalMs),
          leaseToken: null,
          lockedUntil: null,
          lastError: matches ? null : "provider_unavailable",
        },
      });
      if (allDelivered) {
        await tx.deliveryCompletionEvent.upsert({
          where: { id: lease.revision },
          create: {
            id: lease.revision,
            orderId: lease.orderId,
            externalNumbers: request.externalNumbers,
            observedAt: now,
          },
          update: {},
        });
      }
      return true;
    });
  }
}

async function databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
  const [clock] = await tx.$queryRaw<
    Array<{ now: Date }>
  >`SELECT clock_timestamp() AS now`;
  if (
    !clock ||
    !(clock.now instanceof Date) ||
    !Number.isFinite(clock.now.getTime())
  )
    throw new Error("Database clock is unavailable");
  return clock.now;
}
