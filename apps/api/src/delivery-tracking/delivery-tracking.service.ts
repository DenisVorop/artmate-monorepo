import { Injectable, Logger } from "@nestjs/common";

import { OzonPostingClient, OzonPostingError } from "./ozon-posting.client";
import { TrackingStorage, type PostingState } from "./tracking.storage";

@Injectable()
export class DeliveryTrackingService {
  private readonly logger = new Logger(DeliveryTrackingService.name);

  constructor(
    private readonly storage: TrackingStorage,
    private readonly ozon: OzonPostingClient,
  ) {}

  async synchronize(): Promise<void> {
    if (!this.ozon.isConfigured()) return;
    // Bounded batch; persistent due times preserve fairness across cron runs.
    const deadline = Date.now() + 50_000;
    for (let count = 0; count < 20 && Date.now() < deadline; count += 1) {
      const lease = await this.storage.claimNext();
      if (!lease) return;
      let states: PostingState[] | null = [];
      let failureReason: "access_denied" | "provider_unavailable" =
        "provider_unavailable";
      try {
        for (const posting of lease.ozonPostings) {
          states.push({
            externalNumber: posting.number,
            state: await this.ozon.getState(posting.number, posting.scheme),
          });
        }
      } catch (error) {
        states = null;
        if (error instanceof OzonPostingError) failureReason = error.reason;
        this.logger.warn(
          "Delivery tracking request failed; retry is scheduled",
        );
      }
      await this.storage.settle(lease, states, failureReason);
    }
  }
}
