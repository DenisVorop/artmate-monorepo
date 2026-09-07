import type { UserRole } from "../users/users.types";

export type AuthProvider = "credentials" | "yandex";

export type AuthUser = {
  id: string;
  provider: AuthProvider;
  providerUserId: string;
  email?: string;
  name?: string;
  phone?: string;
  image?: string;
  roles: UserRole[];
};

export type AuthPrincipal = AuthUser & {
  authVersion: number;
  envCredentialBinding?: string;
};

export type AuthTokenPayload = {
  sub: string;
  provider: AuthProvider;
  providerUserId: string;
  email?: string;
  name?: string;
  phone?: string;
  image?: string;
  roles: UserRole[];
  authVersion?: number;
  envCredentialBinding?: string;
};

export type YandexTokenResponse = {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
};

export type YandexProfileResponse = {
  id?: unknown;
  default_email?: unknown;
  display_name?: unknown;
  real_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  login?: unknown;
  default_avatar_id?: unknown;
  is_avatar_empty?: unknown;
};
