import { Module } from "@nestjs/common";

import { NotificationQueueModule } from "../notifications/notification-queue.module";

import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [NotificationQueueModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
