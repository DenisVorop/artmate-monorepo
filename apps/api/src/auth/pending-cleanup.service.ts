import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PendingCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(PendingCleanupService.name);
  private _timer?: ReturnType<typeof setInterval>;
  constructor(private readonly prisma: PrismaService) {}
  public onModuleInit(): void {
    this._timer = setInterval(() => {
      void this.expire().catch(() =>
        this._logger.error("Pending auth cleanup failed"),
      );
    }, 60_000);
    this._timer.unref();
  }
  public onModuleDestroy(): void {
    if (this._timer) clearInterval(this._timer);
  }
  public async expire(): Promise<void> {
    const now = new Date();
    await this.prisma.authPendingFlow.updateMany({
      where: { status: "OPEN", expiresAt: { lte: now } },
      data: {
        status: "EXPIRED",
        finishedAt: now,
        credentialPasswordHash: null,
        credentialExpiresAt: null,
        credentialOperationKey: null,
        draftName: null,
        draftPhone: null,
      },
    });
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await this.prisma.authPendingFlow.deleteMany({
      where: {
        status: { in: ["EXPIRED", "CANCELLED", "COMPLETED"] },
        expiresAt: { lt: cutoff },
      },
    });
    await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    // Keep the hourly send counters until well beyond the throttle window.
    await this.prisma.authEmailChallenge.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
  }
}
