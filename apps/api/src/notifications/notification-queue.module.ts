import { Module } from "@nestjs/common";

import { MailerModule } from "../mailer/mailer.module";
import { PrismaModule } from "../prisma/prisma.module";

import { NotificationQueueService } from "./notification-queue.service";

@Module({
  imports: [MailerModule, PrismaModule],
  providers: [NotificationQueueService],
  exports: [NotificationQueueService],
})
export class NotificationQueueModule {}
