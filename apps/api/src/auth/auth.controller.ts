import { isIP } from "node:net";

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";

import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  AUTH_ACCESS_TOKEN_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_MAX_AGE_MS,
  AUTH_OAUTH_STATE_MAX_AGE_MS,
  AUTH_OAUTH_STATE_COOKIE_PREFIX,
} from "./auth.constants";
import { AuthService } from "./auth.service";
import {
  AuthEmailVerificationResponseDTO,
  AuthPasswordResetResponseDTO,
  AuthSessionDTO,
  AuthUserDTO,
  ConfirmEmailVerificationRequestDTO,
  ConfirmPasswordResetRequestDTO,
  LoginRequestDTO,
  RegisterRequestDTO,
  RequestPasswordResetRequestDTO,
  ResendEmailVerificationRequestDTO,
} from "./dto";
import { AuthGuard } from "./auth.guard";
import type { AuthUser } from "./auth.types";
import { CredentialsAuthService } from "./credentials-auth.service";
import { EmailVerificationService } from "./email-verification.service";
import { LoginThrottleService } from "./login-throttle.service";
import { OAuthProvidersService } from "./oauth-providers.service";
import { PasswordResetService } from "./password-reset.service";

type CookieResponse = {
  cookie: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      maxAge?: number;
      path: string;
      sameSite: "lax";
      secure: boolean;
    },
  ) => void;
  clearCookie: (
    name: string,
    options: {
      path: string;
      sameSite: "lax";
      secure: boolean;
    },
  ) => void;
};

type AuthenticatedRequest = {
  user: AuthUser;
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly credentialsAuthService: CredentialsAuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly loginThrottleService: LoginThrottleService,
    private readonly oauthProvidersService: OAuthProvidersService,
    private readonly passwordResetService: PasswordResetService,
    private readonly usersService: UsersService,
  ) {}

  @Get("providers")
  getProviders() {
    return { providers: this.oauthProvidersService.getProviders() };
  }

  @ValidateResponse(AuthEmailVerificationResponseDTO)
  @Post("register")
  async register(
    @Body() request: RegisterRequestDTO,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
  ) {
    let user: AuthUser | undefined;

    try {
      user = await this.credentialsAuthService.registerUser(request);
    } catch (error) {
      if (this.isUserAlreadyExistsError(error)) {
        return {
          status: "verification_required" as const,
          verification: this.emailVerificationService.createGenericVerificationState(
            request.email,
          ),
        };
      }

      throw error;
    }

    const verification = await this.emailVerificationService.createAndSendCode({
      userId: user.id,
      email: user.email ?? request.email,
      ipAddress: this.getClientIp(requestIp, forwardedFor, realIp),
    });

    return {
      status: "verification_required" as const,
      verification,
    };
  }

  @ValidateResponse(AuthSessionDTO)
  @Post("email-verification/confirm")
  async confirmEmailVerification(
    @Body() request: ConfirmEmailVerificationRequestDTO,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const userId = await this.emailVerificationService.confirmCode(
      request.email,
      request.code,
    );
    const user =
      await this.credentialsAuthService.getCredentialsUserById(userId);

    return this.createCookieSession(response, user);
  }

  @ValidateResponse(AuthEmailVerificationResponseDTO)
  @Post("email-verification/resend")
  async resendEmailVerification(
    @Body() request: ResendEmailVerificationRequestDTO,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
  ) {
    return {
      status: "verification_required" as const,
      verification: await this.emailVerificationService.resendCode(
        request.email,
        this.getClientIp(requestIp, forwardedFor, realIp),
      ),
    };
  }

  @ValidateResponse(AuthPasswordResetResponseDTO)
  @Post("password-reset/request")
  requestPasswordReset(
    @Body() request: RequestPasswordResetRequestDTO,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
  ) {
    return this.passwordResetService.requestReset({
      email: request.email,
      ipAddress: this.getClientIp(requestIp, forwardedFor, realIp),
    });
  }

  @ValidateResponse(AuthPasswordResetResponseDTO)
  @Post("password-reset/confirm")
  confirmPasswordReset(@Body() request: ConfirmPasswordResetRequestDTO) {
    return this.passwordResetService.confirmReset(request);
  }

  @ValidateResponse(AuthSessionDTO)
  @Post("login")
  async login(
    @Body() request: LoginRequestDTO,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const user = await this.validateCredentialsLogin(
      request,
      forwardedFor,
      realIp,
      requestIp,
    );

    return this.createCookieSession(response, user);
  }

  @ValidateResponse(AuthSessionDTO)
  @Post("admin/login")
  async loginAdmin(
    @Body() request: LoginRequestDTO,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("x-real-ip") realIp: string | undefined,
    @Ip() requestIp: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const user = await this.validateCredentialsLogin(
      request,
      forwardedFor,
      realIp,
      requestIp,
    );

    this.usersService.assertRole(user, "admin");

    return this.createCookieSession(response, user);
  }

  @Get("oauth/:provider")
  @Redirect()
  signInWithOAuth(
    @Param("provider") provider: string,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const oauthProvider = this.oauthProvidersService.getProvider(provider);
    const state = oauthProvider.createState();
    const authorizationUrl = oauthProvider.getAuthorizationUrl(state);

    this.setStateCookie(response, provider, state);

    return {
      url: authorizationUrl,
    };
  }

  @Get("oauth/:provider/callback")
  @Redirect()
  async handleOAuthCallback(
    @Param("provider") provider: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const oauthProvider = this.oauthProvidersService.getProvider(provider);
    this.validateState(provider, cookieHeader, state);

    if (!code) {
      throw new BadRequestException("OAuth callback is missing code");
    }

    const user = await oauthProvider.getUserByCode(code);
    const accessToken = await this.authService.createAccessToken(user);

    this.clearStateCookie(response, provider);
    this.setAccessTokenCookie(response, accessToken);

    return {
      url: this.getSuccessRedirectUrl(),
    };
  }

  @ValidateResponse(AuthSessionDTO)
  @Get("session")
  getSession(
    @Headers("authorization") authorizationHeader: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
  ) {
    return this.authService.getSession(authorizationHeader, cookieHeader);
  }

  @ValidateResponse(AuthSessionDTO)
  @Get("admin/session")
  async getAdminSession(
    @Headers("authorization") authorizationHeader: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
  ) {
    const session = await this.authService.getSession(
      authorizationHeader,
      cookieHeader,
    );

    if (!session.user || !this.usersService.hasRole(session.user, "admin")) {
      return { user: null };
    }

    return session;
  }

  @ValidateResponse(AuthUserDTO)
  @UseGuards(AuthGuard)
  @Get("me")
  getMe(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: CookieResponse) {
    this.clearAccessTokenCookie(response);

    return { ok: true };
  }

  private async validateCredentialsLogin(
    request: LoginRequestDTO,
    forwardedFor: string | undefined,
    realIp: string | undefined,
    requestIp: string | undefined,
  ) {
    const ipAddress = this.getClientIp(requestIp, forwardedFor, realIp);

    await this.loginThrottleService.assertLoginAllowed({
      email: request.email,
      ipAddress,
    });

    try {
      const user = await this.credentialsAuthService.validateUser(
        request.email,
        request.password,
      );

      await this.loginThrottleService.recordSuccessfulLogin({
        email: request.email,
        ipAddress,
      });

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.loginThrottleService.recordFailedLogin({
          email: request.email,
          ipAddress,
        });
      }

      throw error;
    }
  }

  private async createCookieSession(response: CookieResponse, user: AuthUser) {
    const accessToken = await this.authService.createAccessToken(user);

    this.setAccessTokenCookie(response, accessToken);

    return { user };
  }

  private validateState(
    provider: string,
    cookieHeader: string | undefined,
    state?: string,
  ) {
    const expectedState = this.authService.getCookieValue(
      cookieHeader,
      this.getStateCookieName(provider),
    );

    if (!state || !expectedState || state !== expectedState) {
      throw new UnauthorizedException("OAuth state is invalid");
    }
  }

  private setStateCookie(
    response: CookieResponse,
    provider: string,
    state: string,
  ) {
    response.cookie(this.getStateCookieName(provider), state, {
      httpOnly: true,
      maxAge: AUTH_OAUTH_STATE_MAX_AGE_MS,
      path: this.getProviderCookiePath(provider),
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  private clearStateCookie(response: CookieResponse, provider: string) {
    response.clearCookie(this.getStateCookieName(provider), {
      path: this.getProviderCookiePath(provider),
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  private setAccessTokenCookie(response: CookieResponse, accessToken: string) {
    response.cookie(AUTH_ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      maxAge: AUTH_ACCESS_TOKEN_MAX_AGE_MS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  private clearAccessTokenCookie(response: CookieResponse) {
    response.clearCookie(AUTH_ACCESS_TOKEN_COOKIE_NAME, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  private isUserAlreadyExistsError(error: unknown) {
    if (!(error instanceof ConflictException)) {
      return false;
    }

    const response = error.getResponse();

    if (typeof response === "string") {
      return response === "User already exists";
    }

    return (
      typeof response === "object" &&
      response !== null &&
      "message" in response &&
      response.message === "User already exists"
    );
  }

  private getSuccessRedirectUrl() {
    return (
      process.env.AUTH_SUCCESS_REDIRECT_URL ??
      process.env.SITE_URL ??
      "http://localhost:3000"
    );
  }

  private getStateCookieName(provider: string) {
    return `${AUTH_OAUTH_STATE_COOKIE_PREFIX}_${provider}`;
  }

  private getProviderCookiePath(provider: string) {
    return `/auth/oauth/${provider}`;
  }

  private getClientIp(
    requestIp: string | undefined,
    forwardedFor: string | undefined,
    realIp: string | undefined,
  ) {
    const directIp = this.normalizeIpAddress(requestIp);

    if (directIp && !this.canTrustForwardedIp(directIp)) {
      return directIp;
    }

    return (
      this.getFirstForwardedIp(forwardedFor) ??
      this.normalizeIpAddress(realIp) ??
      directIp
    );
  }

  private getFirstForwardedIp(forwardedFor: string | undefined) {
    return this.normalizeIpAddress(forwardedFor?.split(",")[0]);
  }

  private normalizeIpAddress(ipAddress: string | undefined) {
    const rawIpAddress = ipAddress?.trim();

    if (
      !rawIpAddress ||
      rawIpAddress.toLowerCase() === "unknown" ||
      rawIpAddress.includes("\n") ||
      rawIpAddress.includes("\r")
    ) {
      return undefined;
    }

    const normalizedIpAddress = rawIpAddress.startsWith("::ffff:")
      ? rawIpAddress.slice("::ffff:".length)
      : rawIpAddress;

    return isIP(normalizedIpAddress) ? normalizedIpAddress : undefined;
  }

  private canTrustForwardedIp(ipAddress: string) {
    const normalizedIpAddress = ipAddress.toLowerCase();

    return (
      normalizedIpAddress === "::1" ||
      normalizedIpAddress === "127.0.0.1" ||
      normalizedIpAddress.startsWith("10.") ||
      normalizedIpAddress.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedIpAddress) ||
      normalizedIpAddress.startsWith("fc") ||
      normalizedIpAddress.startsWith("fd") ||
      normalizedIpAddress.startsWith("fe80:")
    );
  }
}
