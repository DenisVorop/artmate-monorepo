import { Global, Module } from "@nestjs/common";

import { AnalyticsOutboxService } from "./analytics-outbox.service";
import { YandexOfflineConversionsService } from "./yandex-offline-conversions.service";

@Global()
@Module({
  providers: [AnalyticsOutboxService, YandexOfflineConversionsService],
  exports: [AnalyticsOutboxService],
})
export class AnalyticsModule {}
