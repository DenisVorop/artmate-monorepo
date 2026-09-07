import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { MailerModule } from "../mailer/mailer.module";
import { NotificationQueueModule } from "../notifications/notification-queue.module";
import { UsersModule } from "../users/users.module";

import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CredentialsAuthService } from "./credentials-auth.service";
import { EmailVerificationService } from "./email-verification.service";
import { LoginThrottleService } from "./login-throttle.service";
import { OAuthProvidersService } from "./oauth-providers.service";
import { OrderActivationService } from "./order-activation.service";
import { PasswordResetService } from "./password-reset.service";
import { TelegramLinkService } from "./telegram-link.service";
import { YandexOAuthService } from "./yandex-oauth.service";

@Module({
  imports: [
    JwtModule.register({}),
    MailerModule,
    NotificationQueueModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthGuard,
    AuthService,
    CredentialsAuthService,
    EmailVerificationService,
    LoginThrottleService,
    OAuthProvidersService,
    OrderActivationService,
    PasswordResetService,
    TelegramLinkService,
    YandexOAuthService,
  ],
  exports: [AuthGuard, AuthService, OrderActivationService],
})
export class AuthModule {}
