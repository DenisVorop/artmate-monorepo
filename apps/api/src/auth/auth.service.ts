import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from "@nestjs/common";
import crypto from "node:crypto";

import { JwtService } from "@nestjs/jwt";

import {
  AuthProvider as PrismaAuthProvider,
  UserStatus as PrismaUserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { isUserRole } from "../users/users.types";
import { UsersService } from "../users/users.service";

import {
  AUTH_ACCESS_TOKEN_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_EXPIRES_IN,
} from "./auth.constants";
import type { AuthPrincipal, AuthTokenPayload, AuthUser } from "./auth.types";
import { CredentialsAuthService } from "./credentials-auth.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly credentialsAuthService: CredentialsAuthService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async createAccessToken(user: AuthPrincipal) {
    if (!Number.isSafeInteger(user.authVersion) || user.authVersion < 0) {
      throw new InternalServerErrorException("Invalid user auth version");
    }

    const payload: AuthTokenPayload = {
      sub: user.id,
      provider: user.provider,
      providerUserId: user.providerUserId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      image: user.image,
      roles: user.roles,
      authVersion: user.authVersion,
      envCredentialBinding: user.envCredentialBinding,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getJwtSecret(),
      expiresIn: AUTH_ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  async getSession(authorizationHeader?: string, cookieHeader?: string) {
    const token = this.getTokenFromRequest(authorizationHeader, cookieHeader);

    if (!token) {
      return { user: null };
    }

    try {
      return { user: await this.verifyAccessToken(token) };
    } catch {
      return { user: null };
    }
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        token,
        {
          secret: this.getJwtSecret(),
        },
      );
      const authVersion = this.getPayloadAuthVersion(payload);

      return await this.getUserFromPayload(payload, authVersion);
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }

  getTokenFromRequest(authorizationHeader?: string, cookieHeader?: string) {
    const bearerToken = this.getBearerToken(authorizationHeader);

    if (bearerToken) {
      return bearerToken;
    }

    return this.getCookieValue(cookieHeader, AUTH_ACCESS_TOKEN_COOKIE_NAME);
  }

  getCookieValue(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) {
      return undefined;
    }

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const cookie = cookies.find((item) => item.startsWith(`${name}=`));
    const rawValue = cookie?.slice(name.length + 1);

    if (!rawValue) {
      return undefined;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return undefined;
    }
  }

  private getBearerToken(authorizationHeader?: string) {
    if (!authorizationHeader) {
      return undefined;
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return undefined;
    }

    return token;
  }

  private async getUserFromPayload(
    payload: AuthTokenPayload,
    authVersion: number,
  ): Promise<AuthUser> {
    const user = this.getPayloadUser(payload);
    const storedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        image: true,
        name: true,
        phone: true,
        roles: true,
        status: true,
        authVersion: true,
      },
    });

    if (!storedUser) {
      if (user.id === `${user.provider}:${user.providerUserId}`) {
        const legacyUser = await this.getLegacyProviderUser(user, authVersion);

        if (legacyUser) {
          await this.assertCredentialsTokenBinding(
            user,
            legacyUser.id,
            payload.envCredentialBinding,
          );
          return legacyUser;
        }
      }

      throw new UnauthorizedException("Invalid access token");
    }

    if (storedUser.status !== PrismaUserStatus.ACTIVE) {
      throw new UnauthorizedException("User account is not active");
    }

    if (storedUser.authVersion !== authVersion) {
      throw new UnauthorizedException("Invalid access token");
    }

    await this.assertCredentialsTokenBinding(
      user,
      user.id,
      payload.envCredentialBinding,
    );

    return {
      ...user,
      email: storedUser.email ?? user.email,
      name: storedUser.name ?? user.name,
      phone: storedUser.phone ?? user.phone,
      image: storedUser.image ?? user.image,
      roles: this.usersService.mapPrismaRoles(storedUser.roles),
    };
  }

  private async getLegacyProviderUser(
    user: AuthUser,
    authVersion: number,
  ): Promise<AuthUser | undefined> {
    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: this.mapPrismaAuthProvider(user.provider),
          providerUserId: user.providerUserId,
        },
      },
      include: {
        user: true,
      },
    });

    if (
      !account ||
      account.user.status !== PrismaUserStatus.ACTIVE ||
      account.user.authVersion !== authVersion
    ) {
      return undefined;
    }

    return {
      id: account.user.id,
      provider: user.provider,
      providerUserId: account.providerUserId,
      email: account.user.email ?? account.providerEmail ?? user.email,
      name: account.user.name ?? user.name,
      phone: account.user.phone ?? user.phone,
      image: account.user.image ?? user.image,
      roles: this.usersService.mapPrismaRoles(account.user.roles),
    };
  }

  private getPayloadUser(payload: AuthTokenPayload): AuthUser {
    if (
      !this.isAuthProvider(payload.provider) ||
      typeof payload.sub !== "string" ||
      typeof payload.providerUserId !== "string" ||
      !Array.isArray(payload.roles) ||
      !payload.roles.every(isUserRole)
    ) {
      throw new UnauthorizedException("Invalid access token payload");
    }

    return {
      id: payload.sub,
      provider: payload.provider,
      providerUserId: payload.providerUserId,
      email: payload.email,
      name: payload.name,
      phone: payload.phone,
      image: payload.image,
      roles: payload.roles,
    };
  }

  private getPayloadAuthVersion(payload: AuthTokenPayload) {
    const authVersion =
      payload.authVersion === undefined ? 0 : payload.authVersion;

    if (!Number.isSafeInteger(authVersion) || authVersion < 0) {
      throw new UnauthorizedException("Invalid access token payload");
    }

    return authVersion;
  }

  private async assertCredentialsTokenBinding(
    user: AuthUser,
    resolvedUserId: string,
    tokenBinding: unknown,
  ) {
    if (user.provider !== "credentials") {
      return;
    }

    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: PrismaAuthProvider.CREDENTIALS,
          providerUserId: user.providerUserId,
        },
      },
      select: {
        credential: { select: { id: true } },
        userId: true,
      },
    });

    if (!account || account.userId !== resolvedUserId) {
      throw new UnauthorizedException("Invalid access token");
    }

    if (account.credential) {
      return;
    }

    const currentBinding =
      this.credentialsAuthService.getEnvCredentialBinding(
        user.providerUserId,
      );

    if (
      typeof tokenBinding !== "string" ||
      !currentBinding ||
      !this.safeCompare(tokenBinding, currentBinding)
    ) {
      throw new UnauthorizedException("Invalid access token");
    }
  }

  private safeCompare(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);

    return (
      actualBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  private isAuthProvider(provider: unknown): provider is AuthUser["provider"] {
    return provider === "credentials" || provider === "yandex";
  }

  private mapPrismaAuthProvider(provider: AuthUser["provider"]) {
    switch (provider) {
      case "credentials":
        return PrismaAuthProvider.CREDENTIALS;
      case "yandex":
        return PrismaAuthProvider.YANDEX;
    }
  }

  private getJwtSecret() {
    const secret = process.env.AUTH_JWT_SECRET;

    if (!secret) {
      throw new InternalServerErrorException(
        "AUTH_JWT_SECRET is not configured",
      );
    }

    return secret;
  }
}
