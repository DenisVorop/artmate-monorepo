import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { OzonOAuthService } from "./ozon-oauth.service";
import { OzonController } from "./ozon.controller";

@Module({
  imports: [AuthModule],
  controllers: [OzonController],
  providers: [OzonOAuthService],
  exports: [OzonOAuthService],
})
export class OzonModule {}
