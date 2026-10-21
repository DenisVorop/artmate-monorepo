import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthCompletionService } from "./completion.service";

/** Restarts resume pending Auth operations from persisted owner receipts. */
@Injectable()
export class AuthCompletionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(AuthCompletionWorker.name);
  private _timer?: ReturnType<typeof setInterval>;
  private _running: Promise<void> | null = null;
  constructor(
    private readonly prisma: PrismaService,
    private readonly completion: AuthCompletionService,
  ) {}
  public onModuleInit(): void {
    this._timer = setInterval(() => {
      void this._tick();
    }, 1000);
    this._timer.unref();
  }
  public async onModuleDestroy(): Promise<void> {
    if (this._timer) clearInterval(this._timer);
    await this._running;
  }
  public async processAvailable(): Promise<void> {
    const operations = await this.prisma.authCompletionOperation.findMany({
      where: {
        status: "PENDING",
        OR: [
          { pendingFlow: null },
          { pendingFlow: { expiresAt: { lte: new Date() } } },
          { pendingFlow: { status: { in: ["CANCELLED", "EXPIRED"] } } },
          { consentCommand: { status: "REJECTED" } },
          { consentCommand: { status: "COMPLETED" }, profileCommand: null },
          { profileCommand: { status: { in: ["COMPLETED", "REJECTED"] } } },
        ],
      },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: 20,
    });
    for (const operation of operations) {
      try {
        await this.completion.process(operation.id);
      } catch {
        this._logger.warn("Auth completion receipt processing failed");
      }
    }
  }
  private async _tick(): Promise<void> {
    if (this._running) return;
    this._running = this.processAvailable().catch(() => {
      this._logger.warn("Auth completion inbox is unavailable");
    });
    try {
      await this._running;
    } finally {
      this._running = null;
    }
  }
}
