import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerProfileCommandHandler } from "./customer-profile-command.handler";

/** Users owns its inbox. Producers enqueue only after the applicable gates;
 * the contact form itself never dispatches this command before consent. */
@Injectable()
export class CustomerProfileCommandWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly _logger = new Logger(CustomerProfileCommandWorker.name);
  private _timer?: ReturnType<typeof setInterval>;
  private _running: Promise<void> | null = null;
  constructor(
    private readonly prisma: PrismaService,
    private readonly handler: CustomerProfileCommandHandler,
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
    const commands = await this.prisma.ensureCustomerProfileCommand.findMany({
      where: {
        status: "PENDING",
        availableAt: { lte: new Date() },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }],
      },
      select: { id: true, attempts: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const command of commands) {
      try {
        await this.handler.process(command.id);
      } catch {
        this._logger.warn("Customer profile command processing failed");
        await this.prisma.ensureCustomerProfileCommand.updateMany({
          where: {
            id: command.id,
            status: "PENDING",
            attempts: command.attempts,
          },
          data: {
            attempts: { increment: 1 },
            availableAt: new Date(
              Date.now() +
                Math.min(60_000, 1000 * 2 ** Math.min(command.attempts, 6)),
            ),
          },
        });
      }
    }
  }
  private async _tick(): Promise<void> {
    if (this._running) return;
    this._running = this.processAvailable().catch(() => {
      this._logger.warn("Customer profile inbox is unavailable");
    });
    try {
      await this._running;
    } finally {
      this._running = null;
    }
  }
}
