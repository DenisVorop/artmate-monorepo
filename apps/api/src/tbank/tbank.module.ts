import { Module } from "@nestjs/common";

import { TBankAcquiringService } from "./tbank-acquiring.service";

@Module({
  providers: [TBankAcquiringService],
  exports: [TBankAcquiringService],
})
export class TBankModule {}
