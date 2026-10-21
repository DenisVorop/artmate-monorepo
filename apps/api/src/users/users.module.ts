import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { UsersController } from "./users.controller";
import { CustomerProfileCommandHandler } from "./customer-profile-command.handler";
import { CustomerProfileCommandWorker } from "./customer-profile-command.worker";
import { UsersService } from "./users.service";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [
    UsersService,
    CustomerProfileCommandHandler,
    CustomerProfileCommandWorker,
  ],
  exports: [UsersService],
})
export class UsersModule {}
