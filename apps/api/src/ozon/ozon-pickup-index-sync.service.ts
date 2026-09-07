import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";

import { OzonLogisticsService } from "./ozon-logistics.service";
import {
  LostOzonPickupIndexLeaseError,
  OzonPickupIndexIntegrityError,
  OzonPickupIndexRepository,
  type OzonPickupEligibleSnapshot,
  type OzonPickupIndexRepositoryPort,
} from "./ozon-pickup-index.repository";
import {
  getOzonPickupRetryDelayMs,
  isOzonPickupSourceCountSafe,
  isOzonPickupSyncDue,
  isOzonPickupTransientStatus,
} from "./ozon-pickup-index.policy";

const schedulerIntervalMs = 60 * 60_000;
const pointInfoBatchSize = 100;
const pointInfoConcurrency = 2;
const maxTransientRetries = 3;

@Injectable()
export class OzonPickupIndexSyncService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OzonPickupIndexSyncService.name);
  private interval: ReturnType<typeof setInterval> | undefined;
  private currentRun: Promise<void> | undefined;
  private destroying = false;
  private readonly shutdown = new AbortController();

  constructor(
    @Inject(OzonPickupIndexRepository)
    private readonly repository: OzonPickupIndexRepositoryPort,
    private readonly logistics: OzonLogisticsService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) return;

    void this.syncIfDue();
    this.interval = setInterval(
      () => void this.syncIfDue(),
      schedulerIntervalMs,
    );
    this.interval.unref?.();
  }

  async onModuleDestroy() {
    this.destroying = true;
    this.shutdown.abort();
    if (this.interval) clearInterval(this.interval);
    await this.currentRun;
  }

  syncIfDue(): Promise<void> {
    if (!this.isEnabled() || this.destroying) return Promise.resolve();
    if (this.currentRun) return this.currentRun;

    const run = this.runSync()
      .catch(() => {
        this.logger.error(
          "Ozon pickup-index refresh could not complete; it will be retried",
        );
      })
      .finally(() => {
        if (this.currentRun === run) this.currentRun = undefined;
      });
    this.currentRun = run;
    return run;
  }

  private async runSync() {
    await this.repository.pruneExpiredGeneration().catch(() => {
      this.logger.warn(
        "Ozon pickup-index cleanup could not complete; it will be retried",
      );
    });
    const now = await this.repository.getDatabaseNow();
    const previous = await this.repository.getLatestPublished();

    if (!isOzonPickupSyncDue(previous?.publishedAt, now)) return;

    await this.repository.recoverStaleBuilder();
    const generation = await this.repository.tryCreateBuilding();
    if (!generation) return;

    try {
      const list = await this.withTransientRetries(generation.id, () =>
        this.logistics.getDeliveryPointListForSync(),
      );

      if (
        !isOzonPickupSourceCountSafe(list.length, previous?.sourcePointCount)
      ) {
        throw new OzonPickupIndexIntegrityError(
          "Ozon pickup-index source point count is unsafe",
        );
      }

      const coordinates = new Map(
        list.map((point) => [point.mapPointId, point] as const),
      );
      const batches = chunk(
        list.map((point) => point.mapPointId),
        pointInfoBatchSize,
      );
      let nextBatch = 0;
      let stopped = false;
      let firstError: unknown;
      let eligible = 0;
      let excluded = 0;

      const workers = Array.from(
        { length: Math.min(pointInfoConcurrency, batches.length) },
        async () => {
          while (!stopped && !this.destroying && nextBatch < batches.length) {
            const batch = batches[nextBatch++];
            if (!batch) return;

            try {
              const info = await this.withTransientRetries(generation.id, () =>
                this.logistics.getDeliveryPointInfoForSync(batch),
              );
              const snapshots: OzonPickupEligibleSnapshot[] = [];

              for (const point of info) {
                if (!point.eligible) {
                  excluded += 1;
                  continue;
                }

                const coordinate = coordinates.get(point.mapPointId);
                if (!coordinate) {
                  throw new OzonPickupIndexIntegrityError(
                    "Ozon pickup-index point-info has no list coordinate",
                  );
                }

                snapshots.push({
                  ...point,
                  latitude: coordinate.latitude,
                  longitude: coordinate.longitude,
                });
              }

              await this.requireHeartbeat(generation.id);
              await this.repository.appendSnapshots(generation.id, snapshots);
              eligible += snapshots.length;
            } catch (error) {
              stopped = true;
              firstError ??= error;
            }
          }
        },
      );

      await Promise.all(workers);
      if (firstError) throw firstError;
      this.assertRunning();
      if (eligible === 0) {
        throw new OzonPickupIndexIntegrityError(
          "Ozon pickup-index eligible snapshot is empty",
        );
      }

      await this.repository.markReady(generation.id, {
        source: list.length,
        eligible,
        excluded,
      });
      await this.repository.publishReady(generation.id);
    } catch (error) {
      await this.repository.markFailedIfOwned(generation.id, error);
      if (
        !(error instanceof LostOzonPickupIndexLeaseError) &&
        !(error instanceof OzonPickupSyncStoppedError)
      ) {
        this.logger.error(
          "Ozon pickup-index sync failed; previous published data retained",
        );
      }
    }
  }

  private async withTransientRetries<T>(
    generationId: string,
    request: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      await this.requireHeartbeat(generationId);

      try {
        return await request();
      } catch (error) {
        if (attempt >= maxTransientRetries || !isTransientOzonError(error)) {
          throw error;
        }

        await delay(
          getOzonPickupRetryDelayMs(attempt, Math.random()),
          this.shutdown.signal,
        );
      }
    }
  }

  private async requireHeartbeat(generationId: string) {
    this.assertRunning();
    if (!(await this.repository.heartbeat(generationId))) {
      throw new LostOzonPickupIndexLeaseError();
    }
    this.assertRunning();
  }

  private assertRunning() {
    if (this.destroying) throw new OzonPickupSyncStoppedError();
  }

  private isEnabled() {
    return (
      process.env.OZON_PICKUP_INDEX_SYNC_ENABLED === "true" &&
      process.env.OZON_LOGISTICS_MODE === "real"
    );
  }
}

function isTransientOzonError(error: unknown) {
  const status =
    error instanceof HttpException
      ? error.getStatus()
      : typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;

  return typeof status === "number" && isOzonPickupTransientStatus(status);
}

function chunk<T>(items: readonly T[], size: number) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_unused, index) => items.slice(index * size, (index + 1) * size),
  );
}

class OzonPickupSyncStoppedError extends Error {
  constructor() {
    super("Ozon pickup-index sync stopped during shutdown");
  }
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}
