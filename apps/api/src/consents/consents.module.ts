import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EmailAdvertisingController } from "./email-advertising.controller";
import { EmailAdvertisingSettingsGrantService } from "./email-advertising-settings-grant.service";
import { EmailAdvertisingService } from "./email-advertising.service";
import { UnsubscribeTokenIssuer } from "./unsubscribe-token-issuer.service";
import { ConsentDecisionCommandHandler } from "./consent-decision-command.handler";
import { ConsentDecisionCommandWorker } from "./consent-decision-command.worker";

/** Consents' inbox is internal. Other domains consume published facts/results. */
@Module({
  imports: [AuthModule],
  controllers: [EmailAdvertisingController],
  providers: [
    ConsentDecisionCommandHandler,
    ConsentDecisionCommandWorker,
    EmailAdvertisingService,
    EmailAdvertisingSettingsGrantService,
    UnsubscribeTokenIssuer,
  ],
})
export class ConsentsModule {}
