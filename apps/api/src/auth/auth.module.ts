import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { MailerModule } from "../mailer/mailer.module";
import { NotificationQueueModule } from "../notifications/notification-queue.module";
import { UsersModule } from "../users/users.module";

import { AuthCompletionController } from "./completion.controller";
import { AuthCompletionService } from "./completion.service";
import { CompletionSessionCheck } from "./completion-session-check";
import { AuthCompletionWorker } from "./completion.worker";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CredentialsAuthService } from "./credentials-auth.service";
import { SiteActionGuard } from "./site-action.guard";
import { LoginThrottleService } from "./login-throttle.service";
import { OAuthProvidersService } from "./oauth-providers.service";
import { OrderActivationService } from "./order-activation.service";
import { PasswordResetService } from "./password-reset.service";
import { TelegramLinkService } from "./telegram-link.service";
import { YandexFlowService } from "./yandex-flow.service";
import { AuthYandexFlowController } from "./yandex-flow.controller";
import { YandexOAuthService } from "./yandex-oauth.service";

import { FlowLifecycleService } from "./flow-lifecycle.service";
import { AuthLinkFlowController } from "./link-flow.controller";
import { ActivationFlowService } from "./activation-flow.service";
import { RecoveryFlowService } from "./recovery-flow.service";
import { AuthFlowController } from "./flow.controller";
import { AuthFlowStore } from "./flow.store";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { PasswordFlowService } from "./password-flow.service";
import { RegistrationCodeService } from "./registration-code.service";
import { RegistrationDraftService } from "./registration-draft.service";
import { ProfileDraftService } from "./profile-draft.service";
import { SessionFlowService } from "./session-flow.service";
import { AuthSessionFlowController } from "./session-flow.controller";
import { PendingCleanupService } from "./pending-cleanup.service";

@Module({
  imports: [
    JwtModule.register({}),
    MailerModule,
    NotificationQueueModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    AuthController,
    AuthFlowController,
    AuthLinkFlowController,
    AuthCompletionController,
    AuthSessionFlowController,
    AuthYandexFlowController,
  ],
  providers: [
    AuthGuard,
    AuthCompletionService,
    CompletionSessionCheck,
    AuthCompletionWorker,
    AuthFlowStore,
    ActivationFlowService,
    RecoveryFlowService,
    FlowLifecycleService,
    CustomerDirectoryReader,
    PasswordFlowService,
    RegistrationCodeService,
    RegistrationDraftService,
    ProfileDraftService,
    SessionFlowService,
    PendingCleanupService,
    AuthService,
    CredentialsAuthService,
    SiteActionGuard,
    LoginThrottleService,
    OAuthProvidersService,
    OrderActivationService,
    PasswordResetService,
    TelegramLinkService,
    YandexOAuthService,
    YandexFlowService,
  ],
  exports: [
    AuthGuard,
    SiteActionGuard,
    AuthService,
    CustomerDirectoryReader,
    OrderActivationService,
  ],
})
export class AuthModule {}
