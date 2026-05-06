import { Module } from "@nestjs/common";

import { BlogModule } from "../blog/blog.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import {
  AdminContentAssistantController,
  TelegramContentAssistantController,
} from "./content-assistant.controller";
import { ContentAssistantService } from "./content-assistant.service";
import { OpenAiContentService } from "./openai-content.service";
import { TelegramApprovalService } from "./telegram-approval.service";

@Module({
  imports: [AuthModule, BlogModule, UsersModule],
  controllers: [
    AdminContentAssistantController,
    TelegramContentAssistantController,
  ],
  providers: [
    ContentAssistantService,
    OpenAiContentService,
    TelegramApprovalService,
  ],
})
export class ContentAssistantModule {}
