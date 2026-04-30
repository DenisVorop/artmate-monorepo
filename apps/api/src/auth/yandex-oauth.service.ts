import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";

import {
  AuthProvider as PrismaAuthProvider,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

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

const yandexAccountInclude = {
  user: true,
} as const;

type StoredYandexAccount = Prisma.AuthAccountGetPayload<{
  include: typeof yandexAccountInclude;
}>;

@Injectable()
export class YandexOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

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

    return this.upsertProfileUser(profile);
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

  private async upsertProfileUser(profile: YandexProfileResponse) {
    if (typeof profile.id !== "string") {
      throw new UnauthorizedException("Yandex profile is missing user id");
    }

    const providerUserId = profile.id;
    const providerEmail = this.getOptionalString(profile.default_email);
    const name = this.getProfileName(profile);
    const image = this.getProfileImage(profile);
    const providerData = this.getProviderData(profile);

    const account = await this.prisma.$transaction(async (tx) => {
      const existingAccount = await tx.authAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: PrismaAuthProvider.YANDEX,
            providerUserId,
          },
        },
        include: yandexAccountInclude,
      });

      if (existingAccount) {
        return tx.authAccount.update({
          where: { id: existingAccount.id },
          data: {
            providerEmail,
            providerData,
            lastLoginAt: new Date(),
            user: {
              update: {
                name,
                image,
              },
            },
          },
          include: yandexAccountInclude,
        });
      }

      const existingUser = providerEmail
        ? await tx.user.findUnique({ where: { email: providerEmail } })
        : null;

      return tx.authAccount.create({
        data: {
          provider: PrismaAuthProvider.YANDEX,
          providerUserId,
          providerEmail,
          providerData,
          user: existingUser
            ? {
                connect: { id: existingUser.id },
              }
            : {
                create: {
                  email: providerEmail,
                  name,
                  image,
                  roles: this.usersService.getDefaultPrismaRoles(),
                },
              },
        },
        include: yandexAccountInclude,
      });
    });

    return this.mapStoredAccount(account);
  }

  private mapStoredAccount(account: StoredYandexAccount): AuthUser {
    return {
      id: account.user.id,
      provider: "yandex",
      providerUserId: account.providerUserId,
      email: account.user.email ?? account.providerEmail ?? undefined,
      name: account.user.name ?? undefined,
      image: account.user.image ?? undefined,
      roles: this.usersService.mapPrismaRoles(account.user.roles),
    };
  }

  private getProviderData(
    profile: YandexProfileResponse,
  ): Prisma.InputJsonObject {
    const data: Record<string, Prisma.InputJsonValue> = {};

    for (const [key, value] of Object.entries(profile)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        data[key] = value;
      }
    }

    return data;
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

    return fullName || undefined;
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
