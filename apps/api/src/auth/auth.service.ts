import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import {
  AUTH_ACCESS_TOKEN_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_EXPIRES_IN,
} from "./auth.constants";
import type { AuthTokenPayload, AuthUser } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async createAccessToken(user: AuthUser) {
    const payload: AuthTokenPayload = {
      sub: user.id,
      provider: user.provider,
      providerUserId: user.providerUserId,
      email: user.email,
      name: user.name,
      image: user.image,
      roles: user.roles,
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

      return this.getUserFromPayload(payload);
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

    return decodeURIComponent(rawValue);
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

  private getUserFromPayload(payload: AuthTokenPayload): AuthUser {
    if (
      !this.isAuthProvider(payload.provider) ||
      typeof payload.sub !== "string" ||
      typeof payload.providerUserId !== "string" ||
      !Array.isArray(payload.roles)
    ) {
      throw new UnauthorizedException("Invalid access token payload");
    }

    return {
      id: payload.sub,
      provider: payload.provider,
      providerUserId: payload.providerUserId,
      email: payload.email,
      name: payload.name,
      image: payload.image,
      roles: payload.roles,
    };
  }

  private isAuthProvider(provider: unknown): provider is AuthUser["provider"] {
    return provider === "credentials" || provider === "yandex";
  }

  private getJwtSecret() {
    const secret = process.env.AUTH_JWT_SECRET;

    if (!secret) {
      throw new InternalServerErrorException("AUTH_JWT_SECRET is not configured");
    }

    return secret;
  }
}
