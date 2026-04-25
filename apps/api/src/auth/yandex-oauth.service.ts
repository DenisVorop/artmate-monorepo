import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";

import {
  YANDEX_AUTHORIZE_URL,
  YANDEX_PROFILE_URL,
  YANDEX_TOKEN_URL,
} from "./auth.constants";
import type {
  AuthUser,
  YandexProfileResponse,
  YandexTokenResponse,
} from "./auth.types";

@Injectable()
export class YandexOAuthService {
  createState() {
    return crypto.randomBytes(32).toString("base64url");
  }

  getAuthorizationUrl(state: string) {
    const url = new URL(YANDEX_AUTHORIZE_URL);

    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.getClientId());
    url.searchParams.set("redirect_uri", this.getRedirectUri());
    url.searchParams.set("state", state);

    return url.toString();
  }

  async getUserByCode(code: string): Promise<AuthUser> {
    const accessToken = await this.exchangeCode(code);
    const profile = await this.getProfile(accessToken);

    return this.mapProfileToUser(profile);
  }

  getRedirectUri() {
    return (
      process.env.YANDEX_OAUTH_REDIRECT_URI ??
      `${this.getApiPublicUrl()}/auth/oauth/yandex/callback`
    );
  }

  private async exchangeCode(code: string) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
    });

    const response = await fetch(YANDEX_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new BadGatewayException("Yandex token request failed");
    }

    const token = (await response.json()) as YandexTokenResponse;

    if (typeof token.access_token !== "string") {
      throw new BadGatewayException("Yandex token response is invalid");
    }

    return token.access_token;
  }

  private async getProfile(accessToken: string) {
    const response = await fetch(YANDEX_PROFILE_URL, {
      headers: {
        authorization: `OAuth ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new BadGatewayException("Yandex profile request failed");
    }

    return (await response.json()) as YandexProfileResponse;
  }

  private mapProfileToUser(profile: YandexProfileResponse): AuthUser {
    if (typeof profile.id !== "string") {
      throw new UnauthorizedException("Yandex profile is missing user id");
    }

    return {
      id: `yandex:${profile.id}`,
      provider: "yandex",
      providerUserId: profile.id,
      email: this.getOptionalString(profile.default_email),
      name: this.getProfileName(profile),
      image: this.getProfileImage(profile),
      roles: ["customer"],
    };
  }

  private getProfileName(profile: YandexProfileResponse) {
    const name =
      this.getOptionalString(profile.real_name) ??
      this.getOptionalString(profile.display_name);

    if (name) {
      return name;
    }

    const firstName = this.getOptionalString(profile.first_name);
    const lastName = this.getOptionalString(profile.last_name);
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    return fullName || this.getOptionalString(profile.login);
  }

  private getProfileImage(profile: YandexProfileResponse) {
    const avatarId = this.getOptionalString(profile.default_avatar_id);

    if (!avatarId || profile.is_avatar_empty === true) {
      return undefined;
    }

    return `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
  }

  private getOptionalString(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private getClientId() {
    return this.getRequiredEnv("YANDEX_OAUTH_CLIENT_ID");
  }

  private getClientSecret() {
    return this.getRequiredEnv("YANDEX_OAUTH_CLIENT_SECRET");
  }

  private getApiPublicUrl() {
    return (process.env.API_PUBLIC_URL ?? "http://localhost:3002").replace(
      /\/+$/,
      "",
    );
  }

  private getRequiredEnv(name: string) {
    const value = process.env[name];

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }
}
