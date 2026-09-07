import { Injectable, NotFoundException } from "@nestjs/common";

import type { AuthPrincipal, AuthProvider } from "./auth.types";
import { YandexOAuthService } from "./yandex-oauth.service";

type OAuthProvider = Extract<AuthProvider, "yandex">;

type OAuthProviderClient = {
  createState: () => string;
  getAuthorizationUrl: (state: string) => string;
  getUserByCode: (code: string) => Promise<AuthPrincipal>;
};

@Injectable()
export class OAuthProvidersService {
  constructor(private readonly yandexOAuthService: YandexOAuthService) {}

  getProviders(): OAuthProvider[] {
    return ["yandex"];
  }

  getProvider(provider: string) {
    if (this.isOAuthProvider(provider)) {
      return this.getProviderClient(provider);
    }

    throw new NotFoundException(`OAuth provider is not supported: ${provider}`);
  }

  private getProviderClient(provider: OAuthProvider): OAuthProviderClient {
    switch (provider) {
      case "yandex":
        return this.yandexOAuthService;
    }
  }

  private isOAuthProvider(provider: string): provider is OAuthProvider {
    return provider === "yandex";
  }
}
