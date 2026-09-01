import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ContactsModule } from "../contacts/contacts.module";
import { UsersModule } from "../users/users.module";

import {
  AdminPartnerApplicationsController,
  PublicPartnerApplicationsController,
} from "./partner-applications.controller";
import { PartnerApplicationsThrottleService } from "./partner-applications-throttle.service";
import { PartnerApplicationsService } from "./partner-applications.service";

@Module({
  imports: [AuthModule, ContactsModule, UsersModule],
  controllers: [
    PublicPartnerApplicationsController,
    AdminPartnerApplicationsController,
  ],
  providers: [PartnerApplicationsService, PartnerApplicationsThrottleService],
})
export class PartnerApplicationsModule {}
