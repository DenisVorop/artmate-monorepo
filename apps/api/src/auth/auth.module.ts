import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CredentialsAuthService } from "./credentials-auth.service";
import { OAuthProvidersService } from "./oauth-providers.service";
import { YandexOAuthService } from "./yandex-oauth.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthGuard,
    AuthService,
    CredentialsAuthService,
    OAuthProvidersService,
    YandexOAuthService,
  ],
  exports: [AuthGuard, AuthService],
})
export class AuthModule {}
