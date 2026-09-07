import crypto from "node:crypto";

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import {
  AnalyticsOutboxStatus,
  Prisma,
  type AnalyticsOutboxEvent,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  YandexOfflineConversionsService,
  YandexOfflineConversionsHttpError,
  type YandexOrderPaidPayload,
} from "./yandex-offline-conversions.service";
import {
  parseYandexAttribution,
  parseYandexAttributionIdentifier,
} from "./yandex-attribution";

type AnalyticsEventWriter = Pick<Prisma.TransactionClient, "analyticsOutboxEvent">;
type PaidOrderSnapshot = {
  readonly id: string;
  readonly subtotal: unknown;
  readonly discount: unknown;
  readonly paidAt: Date | null;
  readonly yandexClientId: string | null;
  readonly yandexYclid: string | null;
};

const analyticsPollIntervalMs = 5_000;
const analyticsLeaseTimeoutMs = 5 * 60 * 1_000;
const analyticsMaxEventsPerRun = 10;
const diagnosticMaxLength = 2_000;

@Injectable()
export class AnalyticsOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsOutboxService.name);
  private isProcessing = false;
  private processingScheduled = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly yandex: YandexOfflineConversionsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processDueEvents();
    }, analyticsPollIntervalMs);
    this.scheduleProcessing();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async enqueueOrderPaid(
    tx: AnalyticsEventWriter,
    order: PaidOrderSnapshot,
  ) {
    const { clientId, yclid } = parseYandexAttribution({
      clientId: order.yandexClientId,
      yclid: order.yandexYclid,
    });

    const revenue = Number(order.subtotal) - Number(order.discount);
    if (!Number.isFinite(revenue) || revenue < 0 || !order.paidAt) {
      throw new Error(`Cannot create order_paid analytics for order ${order.id}`);
    }
    const payload = Object.freeze({
      ...(clientId ? { clientId } : {}),
      currency: "RUB" as const,
      dateTime: Math.floor(order.paidAt.getTime() / 1_000),
      price: revenue.toFixed(2),
      purchaseId: order.id,
      target: "order_paid" as const,
      ...(yclid ? { yclid } : {}),
    });

    await tx.analyticsOutboxEvent.create({
      data: {
        aggregateId: order.id,
        eventType: "order_paid",
        payload,
      },
    });
  }

  async processDueEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      await this.releaseStaleLeases();
      for (let processed = 0; processed < analyticsMaxEventsPerRun; processed += 1) {
        const event = await this.claimDueEvent();
        if (!event) break;
        await this.processEvent(event);
      }
    } catch (error) {
      this.logger.warn(`Analytics outbox failed: ${this.errorMessage(error)}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private scheduleProcessing() {
    if (this.processingScheduled) return;
    this.processingScheduled = true;
    setImmediate(() => {
      this.processingScheduled = false;
      void this.processDueEvents();
    });
  }

  private releaseStaleLeases() {
    return this.prisma.analyticsOutboxEvent.updateMany({
      where: {
        status: AnalyticsOutboxStatus.PROCESSING,
        lockedAt: { lte: new Date(Date.now() - analyticsLeaseTimeoutMs) },
      },
      data: {
        leaseToken: null,
        lockedAt: null,
        nextAttemptAt: new Date(),
        status: AnalyticsOutboxStatus.PENDING,
      },
    });
  }

  private async claimDueEvent() {
    const now = new Date();
    const due = await this.prisma.analyticsOutboxEvent.findMany({
      where: {
        status: AnalyticsOutboxStatus.PENDING,
        nextAttemptAt: { lte: now },
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: 1,
    });
    const event = due[0];
    if (event) {
      const leaseToken = crypto.randomUUID();
      const result = await this.prisma.analyticsOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: AnalyticsOutboxStatus.PENDING,
          nextAttemptAt: { lte: now },
        },
        data: {
          leaseToken,
          lockedAt: now,
          status: AnalyticsOutboxStatus.PROCESSING,
        },
      });
      if (result.count === 1) {
        return {
          ...event,
          leaseToken,
          lockedAt: now,
          status: AnalyticsOutboxStatus.PROCESSING,
        };
      }
    }
    return undefined;
  }

  private async processEvent(event: AnalyticsOutboxEvent) {
    try {
      const payload = this.parsePayload(event);
      const comment = this.uploadComment(event.id);
      const beforeRequest = () => this.renewLease(event);
      const uploading = event.providerUploadId
        ? await this.yandex.findUploadingById(event.providerUploadId, beforeRequest)
        : await this.yandex.findUploadingByComment(comment, beforeRequest);
      const reconciled = uploading ??
        (event.providerUploadId
          ? null
          : await this.yandex.upload(payload, comment, beforeRequest));

      if (!reconciled) {
        throw new Error(`Yandex upload ${event.providerUploadId} was not found`);
      }
      if (reconciled.comment !== comment) {
        throw new Error("Yandex upload comment does not match outbox event");
      }

      await this.completeLease(event, {
        attempts: event.attempts + 1,
        failedAt: null,
        lastError: null,
        lockedAt: null,
        leaseToken: null,
        providerUploadId: reconciled.id,
        providerResponse: reconciled.providerResponse.slice(0, diagnosticMaxLength),
        sentAt: new Date(),
        status: AnalyticsOutboxStatus.SENT,
      });
    } catch (error) {
      if (error instanceof LostAnalyticsLeaseError) {
        return;
      }

      try {
        if (error instanceof InvalidAnalyticsPayloadError) {
          await this.failLease(event, error.message);
        } else if (error instanceof YandexOfflineConversionsHttpError) {
          if (
            error.status === 408 ||
            error.status === 429 ||
            error.status >= 500
          ) {
            await this.retryLease(event, error.message, error.providerResponse);
          } else {
            await this.failLease(event, error.message, error.providerResponse);
          }
        } else {
          await this.retryLease(event, this.errorMessage(error));
        }
      } catch (transitionError) {
        if (transitionError instanceof LostAnalyticsLeaseError) return;
        throw transitionError;
      }
    }
  }

  private retryLease(
    event: AnalyticsOutboxEvent,
    message: string,
    providerResponse?: string,
  ) {
    const attempts = event.attempts + 1;
    return this.completeLease(event, {
      attempts,
      lastError: message.slice(0, diagnosticMaxLength),
      leaseToken: null,
      lockedAt: null,
      nextAttemptAt: new Date(Date.now() + this.retryDelayMs(attempts)),
      providerResponse: providerResponse?.slice(0, diagnosticMaxLength),
      status: AnalyticsOutboxStatus.PENDING,
    });
  }

  private failLease(
    event: AnalyticsOutboxEvent,
    message: string,
    providerResponse?: string,
  ) {
    return this.completeLease(event, {
      attempts: event.attempts + 1,
      failedAt: new Date(),
      lastError: message.slice(0, diagnosticMaxLength),
      leaseToken: null,
      lockedAt: null,
      providerResponse: providerResponse?.slice(0, diagnosticMaxLength),
      status: AnalyticsOutboxStatus.FAILED,
    });
  }

  private async completeLease(
    event: AnalyticsOutboxEvent,
    data: Prisma.AnalyticsOutboxEventUpdateManyMutationInput,
  ) {
    const result = await this.prisma.analyticsOutboxEvent.updateMany({
      where: {
        id: event.id,
        leaseToken: event.leaseToken,
        status: AnalyticsOutboxStatus.PROCESSING,
      },
      data,
    });
    if (result.count !== 1) throw new LostAnalyticsLeaseError();
  }

  private async renewLease(event: AnalyticsOutboxEvent) {
    const result = await this.prisma.analyticsOutboxEvent.updateMany({
      where: {
        id: event.id,
        leaseToken: event.leaseToken,
        status: AnalyticsOutboxStatus.PROCESSING,
      },
      data: { lockedAt: new Date(Date.now()) },
    });
    if (result.count !== 1) throw new LostAnalyticsLeaseError();
  }

  private parsePayload(event: AnalyticsOutboxEvent): YandexOrderPaidPayload {
    if (event.eventType !== "order_paid") {
      throw new InvalidAnalyticsPayloadError("Analytics event type is invalid");
    }
    const value = event.payload;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new InvalidAnalyticsPayloadError("Analytics payload must be an object");
    }
    const payload = value as Record<string, Prisma.JsonValue>;
    const allowed = new Set([
      "clientId",
      "currency",
      "dateTime",
      "price",
      "purchaseId",
      "target",
      "yclid",
    ]);
    if (Object.keys(payload).some((key) => !allowed.has(key))) {
      throw new InvalidAnalyticsPayloadError("Analytics payload has unknown fields");
    }
    const clientId = this.optionalIdentifier(payload.clientId);
    const yclid = this.optionalIdentifier(payload.yclid);
    if (
      payload.target !== "order_paid" ||
      payload.currency !== "RUB" ||
      typeof payload.purchaseId !== "string" ||
      !payload.purchaseId ||
      typeof payload.price !== "string" ||
      !/^\d+\.\d{2}$/.test(payload.price) ||
      typeof payload.dateTime !== "number" ||
      !Number.isSafeInteger(payload.dateTime)
    ) {
      throw new InvalidAnalyticsPayloadError("Analytics payload is invalid");
    }
    if (payload.purchaseId !== event.aggregateId) {
      throw new InvalidAnalyticsPayloadError(
        "Analytics purchase id does not match aggregate",
      );
    }
    return Object.freeze({
      ...(clientId ? { clientId } : {}),
      currency: "RUB",
      dateTime: payload.dateTime,
      price: payload.price,
      purchaseId: payload.purchaseId,
      target: "order_paid",
      ...(yclid ? { yclid } : {}),
    });
  }

  private optionalIdentifier(value: Prisma.JsonValue | undefined) {
    if (value === undefined) return undefined;
    const identifier = parseYandexAttributionIdentifier(value);
    if (!identifier) {
      throw new InvalidAnalyticsPayloadError(
        "Analytics attribution identifier is invalid",
      );
    }
    return identifier;
  }

  private retryDelayMs(attempts: number) {
    return Math.min(10 * 60 * 1_000, 30_000 * 2 ** (attempts - 1));
  }

  private uploadComment(eventId: string) {
    return `artmate${crypto.createHash("sha256").update(eventId).digest("hex")}`;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

class InvalidAnalyticsPayloadError extends Error {}
export class LostAnalyticsLeaseError extends Error {}
