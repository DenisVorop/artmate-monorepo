import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { AchievementBadgeService } from "./badge.service";

@Injectable()
export class AchievementBadgeWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AchievementBadgeWorker.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopped = false;

  constructor(private readonly awards: AchievementBadgeService) {}

  onModuleInit() {
    this.stopped = false;
    this.timer = setInterval(() => void this.poll(), 15_000);
    this.timer.unref();
    void this.poll();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async poll() {
    if (this.stopped || this.busy) return;
    this.busy = true;
    try {
      await this.awards.processDueUsers();
    } catch {
      this.logger.warn(
        "Badge polling failed; source facts remain in the database",
      );
    } finally {
      this.busy = false;
    }
  }
}
