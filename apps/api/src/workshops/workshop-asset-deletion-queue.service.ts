import { randomBytes } from "node:crypto";

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import {
  Prisma,
  type WorkshopAssetDeletionJob,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WorkshopStorageService } from "./workshop-storage.service";

const deletionBatchSize = 20;
const deletionPollIntervalMs = 5000;
const deletionLockTimeoutMs = 1000 * 60 * 5;

@Injectable()
export class WorkshopAssetDeletionQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WorkshopAssetDeletionQueueService.name);
  private isProcessing = false;
  private processingScheduled = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: WorkshopStorageService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processDueJobs();
    }, deletionPollIntervalMs);
    this.scheduleProcessing();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async enqueue(tx: Prisma.TransactionClient, keys: string[]) {
    const uniqueKeys = [...new Set(keys)];

    if (uniqueKeys.length === 0) {
      return;
    }

    await tx.workshopAssetDeletionJob.createMany({
      data: uniqueKeys.map((storageKey) => ({
        id: randomBytes(16).toString("hex"),
        storageKey,
      })),
      skipDuplicates: true,
    });
    this.scheduleProcessing();
  }

  async processDueJobs() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.releaseStaleJobs();
      const jobs = await this.claimDueJobs();

      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (error) {
      this.logger.warn(
        `Workshop asset deletion queue failed: ${this.errorMessage(error)}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private scheduleProcessing() {
    if (this.processingScheduled) {
      return;
    }

    this.processingScheduled = true;
    setImmediate(() => {
      this.processingScheduled = false;
      void this.processDueJobs();
    });
  }

  private async releaseStaleJobs() {
    await this.prisma.workshopAssetDeletionJob.updateMany({
      where: {
        lockedAt: { lte: new Date(Date.now() - deletionLockTimeoutMs) },
      },
      data: { lockedAt: null, nextAttemptAt: new Date() },
    });
  }

  private async claimDueJobs() {
    const now = new Date();
    const due = await this.prisma.workshopAssetDeletionJob.findMany({
      where: { lockedAt: null, nextAttemptAt: { lte: now } },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: deletionBatchSize,
    });
    const claimed: WorkshopAssetDeletionJob[] = [];

    for (const job of due) {
      const result = await this.prisma.workshopAssetDeletionJob.updateMany({
        where: { id: job.id, lockedAt: null },
        data: { lockedAt: now },
      });

      if (result.count === 1) {
        claimed.push(job);
      }
    }

    return claimed;
  }

  private async processJob(job: WorkshopAssetDeletionJob) {
    try {
      await this.storage.deleteAsset(job.storageKey);
      await this.prisma.workshopAssetDeletionJob.delete({ where: { id: job.id } });
    } catch (error) {
      const attempts = job.attempts + 1;
      await this.prisma.workshopAssetDeletionJob.update({
        where: { id: job.id },
        data: {
          attempts,
          lastError: this.errorMessage(error).slice(0, 1000),
          lockedAt: null,
          nextAttemptAt: new Date(Date.now() + this.retryDelayMs(attempts)),
        },
      });
      this.logger.warn(
        `Workshop asset deletion ${job.id} failed on attempt ${attempts}: ${this.errorMessage(error)}`,
      );
    }
  }

  private retryDelayMs(attempts: number) {
    return Math.min(1000 * 60 * 10, 1000 * 30 * 2 ** (attempts - 1));
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
